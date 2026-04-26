import { randomUUID } from 'node:crypto'
import { getDb } from './index'
import type { Sale, SaleInput, SaleItem, SaleWithItems } from '../../shared/types'

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
    voided: Number(r.voided) === 1 ? 1 : 0,
  }
}

export function create(input: SaleInput): SaleWithItems {
  if (!input.items.length) throw new Error('La venta no tiene productos')
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

    if (input.payment_method === 'efectivo' && !session) {
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
    }[] = []
    let subtotal = 0
    const oversold: { name: string; qty: number; stock: number }[] = []

    const fetchProduct = db.prepare(
      `SELECT id, name, cost, price, stock, archived FROM products WHERE id = ?`,
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
          }
        | undefined
      if (!p) throw new Error('Uno de los productos del ticket ya no existe')
      if (p.archived === 1) {
        throw new Error(`No se puede vender "${p.name}" porque está archivado`)
      }
      const qty = Math.max(1, Math.round(it.qty))
      const price = Math.round(it.price)
      const surcharge = Math.round(it.surcharge ?? 0)
      if (qty > p.stock) {
        oversold.push({ name: p.name, qty, stock: p.stock })
      }
      subtotal += (price + surcharge) * qty
      itemsResolved.push({
        id: p.id,
        qty,
        price,
        surcharge,
        cost: Number(p.cost),
        name: p.name,
        stock: Number(p.stock),
      })
    }

    if (oversold.length > 0) {
      const detail = oversold
        .map((o) => `${o.name} (pediste ${o.qty}, hay ${o.stock})`)
        .join('; ')
      throw new Error(`Stock insuficiente: ${detail}`)
    }

    const discount = Math.max(0, Math.round(input.discount || 0))
    const total = Math.max(0, subtotal - discount)
    if (input.payment_method === 'efectivo' && (input.cash_received ?? 0) < total) {
      throw new Error('El efectivo recibido es insuficiente para cubrir el total')
    }
    const change = input.payment_method === 'efectivo' ? (input.cash_received ?? 0) - total : null

    const next = db
      .prepare(
        `UPDATE sale_counter SET last_number = last_number + 1 WHERE id = 1 RETURNING last_number`,
      )
      .get() as { last_number: number }

    db.prepare(
      `INSERT INTO sales (id, number, started_at, completed_at, subtotal, discount, total,
        payment_method, cash_received, change_given, cash_session_id, note)
       VALUES (@id, @number, @started_at, @completed_at, @subtotal, @discount, @total,
        @pm, @cash_received, @change, @session, @note)`,
    ).run({
      id: saleId,
      number: next.last_number,
      started_at: now,
      completed_at: now,
      subtotal,
      discount,
      total,
      pm: input.payment_method,
      cash_received: input.payment_method === 'efectivo' ? input.cash_received ?? null : null,
      change,
      session: session?.id ?? null,
      note: input.note ?? null,
    })

    const insItem = db.prepare(
      `INSERT INTO sale_items (sale_id, product_id, name_snapshot, price_snapshot, cost_snapshot, surcharge, qty, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const decStock = db.prepare(`UPDATE products SET stock = stock - ? WHERE id = ?`)
    for (const it of itemsResolved) {
      const lineTotal = (it.price + it.surcharge) * it.qty
      // sale_id = saleId (NO it.id — eso es product_id y rompe la FK)
      insItem.run(saleId, it.id, it.name, it.price, it.cost, it.surcharge, it.qty, lineTotal)
      decStock.run(it.qty, it.id)
    }

    if (session && input.payment_method === 'efectivo') {
      db.prepare(
        `INSERT INTO cash_movements (id, cash_session_id, kind, amount, note, sale_id)
         VALUES (?, ?, 'sale', ?, ?, ?)`,
      ).run(randomUUID(), session.id, total, `Venta #${next.last_number}`, saleId)
    }

    return getById(saleId)!
  })

  return tx()
}

export function getById(id: string): SaleWithItems | null {
  const db = getDb()
  const sale = rowToSale(
    db.prepare(`SELECT * FROM sales WHERE id = ?`).get(id) as Record<string, unknown>,
  )
  if (!sale) return null
  const items = db
    .prepare(
      `SELECT product_id, name_snapshot, price_snapshot, cost_snapshot, surcharge, qty, line_total
       FROM sale_items WHERE sale_id = ? ORDER BY id ASC`,
    )
    .all(id) as SaleItem[]
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
    })),
  }
}

export function list(
  q: { from?: string; to?: string; limit?: number; cashSessionId?: string } = {},
): Sale[] {
  const db = getDb()
  const where: string[] = []
  const params: Record<string, unknown> = {}
  if (q.from) {
    where.push('completed_at >= @from')
    params.from = q.from
  }
  if (q.to) {
    where.push('completed_at < @to')
    params.to = q.to
  }
  if (q.cashSessionId) {
    where.push('cash_session_id = @session')
    params.session = q.cashSessionId
  }
  const limit = Math.min(2000, Math.max(1, q.limit ?? 100))
  const sql = `SELECT * FROM sales ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY completed_at DESC LIMIT ${limit}`
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
    for (const it of sale.items) restore.run(it.qty, it.product_id)
  })
  tx()
}
