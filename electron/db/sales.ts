import { randomUUID } from 'node:crypto'
import { getDb } from './index'
import { lineTotal } from '../../shared/money'
import type {
  PaymentMethod,
  Sale,
  SaleInput,
  SaleItem,
  SalePayment,
  SaleWithItems,
} from '../../shared/types'

function rowToSale(r: Record<string, unknown> | undefined): Sale | null {
  if (!r) return null
  return {
    id: r.id as string,
    number: Number(r.number),
    started_at: r.started_at as string,
    completed_at: r.completed_at as string,
    subtotal: Number(r.subtotal),
    discount: Number(r.discount),
    total: Number(r.total),
    payment_method: r.payment_method as Sale['payment_method'],
    cash_received: r.cash_received == null ? null : Number(r.cash_received),
    change_given: r.change_given == null ? null : Number(r.change_given),
    cash_session_id: (r.cash_session_id as string | null) ?? null,
    cashier_id: (r.cashier_id as string | null) ?? null,
    cashier_name: (r.cashier_name as string | null) ?? null,
    voided: Number(r.voided) === 1 ? 1 : 0,
  }
}

function loadPayments(saleId: string): SalePayment[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT method, amount, cash_received, change_given FROM sale_payments WHERE sale_id = ? ORDER BY id ASC`,
    )
    .all(saleId) as Record<string, unknown>[]
  return rows.map((r) => ({
    method: r.method as PaymentMethod,
    amount: Number(r.amount),
    cash_received: r.cash_received == null ? undefined : Number(r.cash_received),
    change_given: r.change_given == null ? undefined : Number(r.change_given),
  }))
}

export function create(input: SaleInput): SaleWithItems {
  if (!input.items.length) throw new Error('La venta no tiene productos')
  if (!input.payments || input.payments.length === 0) {
    throw new Error('Falta indicar el método de pago')
  }
  const db = getDb()

  const saleId = randomUUID()
  const now = new Date().toISOString()

  const tx = db.transaction((): SaleWithItems => {
    // Re-validamos la sesión de caja DENTRO de la transacción para evitar
    // race conditions con cierres concurrentes y para garantizar que el
    // cash_session_id que vamos a guardar realmente exista y esté abierto.
    const session = db
      .prepare(
        `SELECT id, opening_amount FROM cash_sessions WHERE closed_at IS NULL ORDER BY opened_at DESC LIMIT 1`,
      )
      .get() as { id: string; opening_amount: number } | undefined

    const hasCash = input.payments.some((p) => p.method === 'efectivo')
    if (hasCash && !session) {
      throw new Error('Debes abrir la caja antes de cobrar en efectivo')
    }

    // Resolver y validar productos contra la base
    const itemsResolved: {
      id: string
      qty: number
      price: number
      surcharge: number
      cost: number
      name: string
      stock: number
      is_weight: 0 | 1
      lineTotal: number
    }[] = []
    let subtotal = 0
    const oversold: { name: string; qty: number; stock: number; is_weight: 0 | 1 }[] = []

    const fetchProduct = db.prepare(
      `SELECT id, name, cost, price, stock, archived, is_weight FROM products WHERE id = ?`,
    )
    for (const it of input.items) {
      const p = fetchProduct.get(it.product_id) as
        | {
            id: string
            name: string
            cost: number
            price: number
            stock: number
            archived: number
            is_weight: number
          }
        | undefined
      if (!p) {
        // Buscamos el nombre cacheado en sale_items previos para dar
        // un mensaje útil. Si no hay (sale nuevo), usamos un fallback.
        throw new Error(
          'Uno de los productos del ticket ya no existe en el inventario. Sal de la pantalla y vuelve a entrar para que se actualice el ticket.',
        )
      }
      if (p.archived === 1) {
        throw new Error(`No se puede vender "${p.name}" porque está inactivo`)
      }
      const isWeight: 0 | 1 = p.is_weight === 1 ? 1 : 0
      // qty viene en gramos para items al peso o unidades enteras para
      // los demás. Si llega 0, NaN o negativo, abortamos: no debe ser el
      // backend el que adivine "querían 1" — preferimos error claro
      // antes que cobrar mal o registrar una línea fantasma.
      const qtyRaw = Math.round(Number(it.qty))
      if (!Number.isFinite(qtyRaw) || qtyRaw <= 0) {
        throw new Error(`Cantidad inválida para "${p.name}". Revisá el ticket.`)
      }
      const qty = qtyRaw
      // Defensa: si por bug del frontend o request manipulada llegan
      // price/surcharge negativos, los aplastamos a 0. Sin esto se podía
      // generar una venta con total negativo (dinero "saliendo" del cajón
      // sin trazabilidad en cash_movements).
      const price = Math.max(0, Math.round(it.price))
      const surcharge = Math.max(0, Math.round(it.surcharge ?? 0))
      if (qty > p.stock) {
        oversold.push({ name: p.name, qty, stock: p.stock, is_weight: isWeight })
      }
      const lt = lineTotal({ price, surcharge, qty, is_weight: isWeight })
      subtotal += lt
      itemsResolved.push({
        id: p.id,
        qty,
        price,
        surcharge,
        cost: Number(p.cost),
        name: p.name,
        stock: Number(p.stock),
        is_weight: isWeight,
        lineTotal: lt,
      })
    }

    if (oversold.length > 0) {
      const detail = oversold
        .map((o) => {
          const want = o.is_weight ? `${(o.qty / 1000).toFixed(3)} kg` : `${o.qty}`
          const has = o.is_weight ? `${(o.stock / 1000).toFixed(3)} kg` : `${o.stock}`
          return `${o.name} (pediste ${want}, hay ${has})`
        })
        .join('; ')
      throw new Error(`Stock insuficiente: ${detail}`)
    }

    const discount = Math.max(0, Math.round(input.discount || 0))
    if (discount > subtotal) {
      throw new Error(
        `El descuento ($${discount.toLocaleString('es-CL')}) no puede ser mayor que el subtotal ($${subtotal.toLocaleString('es-CL')}).`,
      )
    }
    const total = subtotal - discount

    // Validar pagos: la suma de amounts debe igualar el total. Para
    // métodos efectivo, cash_received debe alcanzar el amount.
    let totalPaid = 0
    let totalCashReceived = 0
    let totalChange = 0
    const cleanPayments: Required<SalePayment>[] = []
    for (const p of input.payments) {
      const amount = Math.max(0, Math.round(p.amount))
      if (amount === 0) continue
      totalPaid += amount
      if (p.method === 'efectivo') {
        const received = Math.max(0, Math.round(p.cash_received ?? amount))
        if (received < amount) {
          throw new Error('El efectivo recibido es insuficiente para cubrir el total')
        }
        const change = received - amount
        totalCashReceived += received
        totalChange += change
        cleanPayments.push({
          method: 'efectivo',
          amount,
          cash_received: received,
          change_given: change,
        })
      } else {
        cleanPayments.push({ method: p.method, amount, cash_received: 0, change_given: 0 })
      }
    }
    if (totalPaid !== total) {
      throw new Error(
        `La suma de los pagos no coincide con el total ($${totalPaid.toLocaleString(
          'es-CL',
        )} vs $${total.toLocaleString('es-CL')})`,
      )
    }

    const primaryMethod: Sale['payment_method'] =
      cleanPayments.length === 1 ? cleanPayments[0].method : 'mixto'
    const cashReceivedTotal = hasCash ? totalCashReceived : null
    const changeTotal = hasCash ? totalChange : null

    const next = db
      .prepare(
        `UPDATE sale_counter SET last_number = last_number + 1 WHERE id = 1 RETURNING last_number`,
      )
      .get() as { last_number: number }

    db.prepare(
      `INSERT INTO sales (id, number, started_at, completed_at, subtotal, discount, total,
        payment_method, cash_received, change_given, cash_session_id, cashier_id, note)
       VALUES (@id, @number, @started_at, @completed_at, @subtotal, @discount, @total,
        @pm, @cash_received, @change, @session, @cashier, @note)`,
    ).run({
      id: saleId,
      number: next.last_number,
      started_at: now,
      completed_at: now,
      subtotal,
      discount,
      total,
      pm: primaryMethod,
      cash_received: cashReceivedTotal,
      change: changeTotal,
      session: session?.id ?? null,
      cashier: input.cashier_id ?? null,
      note: input.note ?? null,
    })

    const insPayment = db.prepare(
      `INSERT INTO sale_payments (sale_id, method, amount, cash_received, change_given)
       VALUES (?, ?, ?, ?, ?)`,
    )
    for (const p of cleanPayments) {
      insPayment.run(
        saleId,
        p.method,
        p.amount,
        p.method === 'efectivo' ? p.cash_received : null,
        p.method === 'efectivo' ? p.change_given : null,
      )
    }

    const insItem = db.prepare(
      `INSERT INTO sale_items (sale_id, product_id, name_snapshot, price_snapshot, cost_snapshot, surcharge, qty, line_total, is_weight)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const decStock = db.prepare(`UPDATE products SET stock = stock - ? WHERE id = ?`)
    for (const it of itemsResolved) {
      // sale_id = saleId (NO it.id — eso es product_id y rompe la FK)
      insItem.run(
        saleId,
        it.id,
        it.name,
        it.price,
        it.cost,
        it.surcharge,
        it.qty,
        it.lineTotal,
        it.is_weight,
      )
      decStock.run(it.qty, it.id)
    }

    // Por cada pago en efectivo registramos un cash_movement con SU monto
    // (no el total de la venta). Así el cuadre de caja refleja exactamente
    // lo que entró por la caja (y no la parte que se cobró con tarjeta).
    if (session) {
      const insMov = db.prepare(
        `INSERT INTO cash_movements (id, cash_session_id, kind, amount, note, sale_id)
         VALUES (?, ?, 'sale', ?, ?, ?)`,
      )
      for (const p of cleanPayments) {
        if (p.method === 'efectivo' && p.amount > 0) {
          insMov.run(
            randomUUID(),
            session.id,
            p.amount,
            `Venta #${next.last_number}`,
            saleId,
          )
        }
      }
    }

    return getById(saleId)!
  })

  return tx()
}

export function getById(id: string): SaleWithItems | null {
  const db = getDb()
  const sale = rowToSale(
    db
      .prepare(
        `SELECT s.*, u.name AS cashier_name
           FROM sales s
           LEFT JOIN users u ON u.id = s.cashier_id
          WHERE s.id = ?`,
      )
      .get(id) as Record<string, unknown>,
  )
  if (!sale) return null
  const items = db
    .prepare(
      `SELECT product_id, name_snapshot, price_snapshot, cost_snapshot, surcharge, qty, line_total, is_weight, returned_qty
       FROM sale_items WHERE sale_id = ? ORDER BY id ASC`,
    )
    .all(id) as (SaleItem & { is_weight?: number; returned_qty?: number })[]
  return {
    ...sale,
    items: items.map((r) => ({
      product_id: r.product_id,
      name_snapshot: r.name_snapshot,
      price_snapshot: Number(r.price_snapshot),
      cost_snapshot: Number(r.cost_snapshot),
      surcharge: Number(r.surcharge ?? 0),
      qty: Number(r.qty),
      line_total: Number(r.line_total),
      is_weight: Number(r.is_weight ?? 0) === 1 ? 1 : 0,
      returned_qty: Number(r.returned_qty ?? 0),
    })),
    payments: loadPayments(id),
  }
}

export function list(
  q: { from?: string; to?: string; limit?: number; cashSessionId?: string } = {},
): Sale[] {
  const db = getDb()
  const where: string[] = []
  const params: Record<string, unknown> = {}
  // Las fechas q.from / q.to son YYYY-MM-DD interpretadas en hora local.
  // completed_at se guarda en UTC ISO, así que usamos date(..., 'localtime')
  // para que los rangos calcen con la fecha que ve la cajera en pantalla.
  if (q.from) {
    where.push("date(s.completed_at, 'localtime') >= @from")
    params.from = q.from
  }
  if (q.to) {
    where.push("date(s.completed_at, 'localtime') <= @to")
    params.to = q.to
  }
  if (q.cashSessionId) {
    where.push('s.cash_session_id = @session')
    params.session = q.cashSessionId
  }
  const limit = Math.min(2000, Math.max(1, q.limit ?? 100))
  const sql = `SELECT s.*, u.name AS cashier_name
                 FROM sales s
                 LEFT JOIN users u ON u.id = s.cashier_id
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY s.completed_at DESC
                 LIMIT ${limit}`
  return (db.prepare(sql).all(params) as Record<string, unknown>[])
    .map(rowToSale)
    .filter((s): s is Sale => s !== null)
}

export function nextNumber(): number {
  const db = getDb()
  const r = db.prepare(`SELECT last_number FROM sale_counter WHERE id = 1`).get() as
    | { last_number: number }
    | undefined
  return (r?.last_number ?? 0) + 1
}

export function voidSale(id: string, reason: string): void {
  const db = getDb()
  const tx = db.transaction(() => {
    const sale = getById(id)
    if (!sale) throw new Error('Venta no encontrada')
    if (sale.voided) return
    db.prepare(`UPDATE sales SET voided = 1, void_reason = ? WHERE id = ?`).run(reason, id)
    const restore = db.prepare(`UPDATE products SET stock = stock + ? WHERE id = ?`)
    // Solo restaurar la cantidad que NO había sido devuelta previamente.
    for (const it of sale.items) {
      const remaining = it.qty - it.returned_qty
      if (remaining > 0) restore.run(remaining, it.product_id)
    }
  })
  tx()
}

/**
 * Devolución parcial: la cajera marca cuántas unidades de cada línea
 * vuelven al stock. La venta NO se anula entera (queda como
 * parcialmente devuelta). Si fue en efectivo, se inserta un movimiento
 * negativo en la caja por el monto reembolsado.
 */
export function returnItems(
  saleId: string,
  returns: { product_id: string; qty: number }[],
  reason: string,
): { refunded_total: number; sale: SaleWithItems } {
  if (returns.length === 0) throw new Error('Selecciona al menos un producto a devolver')
  const db = getDb()

  const result = db.transaction((): { refunded_total: number; sale: SaleWithItems } => {
    const sale = getById(saleId)
    if (!sale) throw new Error('Venta no encontrada')
    if (sale.voided) throw new Error('La venta está anulada; no se puede devolver parcialmente')

    let refunded = 0
    const restoreStock = db.prepare(`UPDATE products SET stock = stock + ? WHERE id = ?`)
    const updateReturned = db.prepare(
      `UPDATE sale_items SET returned_qty = returned_qty + ? WHERE sale_id = ? AND product_id = ?`,
    )

    for (const r of returns) {
      const it = sale.items.find((i) => i.product_id === r.product_id)
      if (!it) throw new Error('Producto no estaba en la venta')
      const available = it.qty - it.returned_qty
      const toReturn = Math.max(0, Math.round(r.qty))
      if (toReturn === 0) continue
      if (toReturn > available) {
        throw new Error(
          `No puedes devolver más de lo pendiente: ${it.name_snapshot} (quedan ${available})`,
        )
      }
      const lineRefund = lineTotal({
        price: it.price_snapshot,
        surcharge: it.surcharge,
        qty: toReturn,
        is_weight: it.is_weight,
      })
      refunded += lineRefund
      updateReturned.run(toReturn, saleId, r.product_id)
      restoreStock.run(toReturn, r.product_id)
    }

    if (refunded === 0) throw new Error('Las cantidades a devolver son cero')

    // Si la venta tuvo efectivo y la sesión sigue abierta, agregamos un
    // ajuste negativo en la caja por el monto que efectivamente sale del
    // cajón. En pagos mixtos, el reembolso al cajón se acota al monto
    // que entró en efectivo (no podemos sacar más en cash de lo que se
    // pagó en cash). El resto del reembolso queda solo en sale_items
    // como devolución y la cajera lo gestiona aparte (anular tarjeta,
    // transferencia inversa, etc.).
    const cashInSale = sale.payments
      .filter((p) => p.method === 'efectivo')
      .reduce((a, p) => a + p.amount, 0)
    const cashRefund = Math.min(refunded, cashInSale)
    if (cashRefund > 0 && sale.cash_session_id) {
      const sessionOpen = db
        .prepare(`SELECT 1 FROM cash_sessions WHERE id = ? AND closed_at IS NULL`)
        .get(sale.cash_session_id)
      if (sessionOpen) {
        const noteSuffix =
          cashRefund < refunded
            ? ` (efectivo $${cashRefund.toLocaleString('es-CL')} de $${refunded.toLocaleString('es-CL')} reembolsado; el resto pagado por otro medio)`
            : ''
        db.prepare(
          `INSERT INTO cash_movements (id, cash_session_id, kind, amount, note, sale_id)
           VALUES (?, ?, 'adjustment', ?, ?, ?)`,
        ).run(
          randomUUID(),
          sale.cash_session_id,
          -cashRefund,
          `Devolución parcial venta #${sale.number}: ${reason}${noteSuffix}`,
          saleId,
        )
      }
    }

    return { refunded_total: refunded, sale: getById(saleId)! }
  })()

  return result
}
