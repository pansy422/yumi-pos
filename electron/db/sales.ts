import { randomUUID } from 'node:crypto'
import { getDb } from './index'
import { current as currentCash } from './cashSessions'
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
  const session = currentCash()
  if (!session && input.payment_method === 'efectivo') {
    throw new Error('Debes abrir la caja antes de cobrar en efectivo')
  }

  const saleId = randomUUID()
  const now = new Date().toISOString()
  let subtotal = 0
  const itemsResolved: { id: string; qty: number; price: number; cost: number; name: string }[] =
    []

  const result = db.transaction((): SaleWithItems => {
    for (const it of input.items) {
      const p = db.prepare(`SELECT id, name, cost, price, stock FROM products WHERE id = ?`).get(it.product_id) as
        | { id: string; name: string; cost: number; price: number; stock: number }
        | undefined
      if (!p) throw new Error(`Producto no encontrado: ${it.product_id}`)
      const qty = Math.max(1, Math.round(it.qty))
      const price = Math.round(it.price)
      subtotal += price * qty
      itemsResolved.push({ id: p.id, qty, price, cost: p.cost, name: p.name })
    }
    const discount = Math.max(0, Math.round(input.discount || 0))
    const total = Math.max(0, subtotal - discount)
    if (input.payment_method === 'efectivo' && (input.cash_received ?? 0) < total) {
      throw new Error('El efectivo recibido es insuficiente')
    }
    const change = input.payment_method === 'efectivo' ? (input.cash_received ?? 0) - total : null

    const next = db.prepare(
      `UPDATE sale_counter SET last_number = last_number + 1 WHERE id = 1 RETURNING last_number`,
    ).get() as { last_number: number }

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
      `INSERT INTO sale_items (sale_id, product_id, name_snapshot, price_snapshot, cost_snapshot, qty, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    const decStock = db.prepare(`UPDATE products SET stock = stock - ? WHERE id = ?`)
    for (const it of itemsResolved) {
      insItem.run(it.id, it.id, it.name, it.price, it.cost, it.qty, it.price * it.qty)
      decStock.run(it.qty, it.id)
    }

    if (session && input.payment_method === 'efectivo') {
      db.prepare(
        `INSERT INTO cash_movements (id, cash_session_id, kind, amount, note, sale_id)
         VALUES (?, ?, 'sale', ?, ?, ?)`,
      ).run(randomUUID(), session.id, total, `Venta #${next.last_number}`, saleId)
    }

    return getById(saleId)!
  })()

  return result
}

export function getById(id: string): SaleWithItems | null {
  const db = getDb()
  const sale = rowToSale(
    db.prepare(`SELECT * FROM sales WHERE id = ?`).get(id) as Record<string, unknown>,
  )
  if (!sale) return null
  const items = db
    .prepare(
      `SELECT product_id, name_snapshot, price_snapshot, cost_snapshot, qty, line_total
       FROM sale_items WHERE sale_id = ? ORDER BY id ASC`,
    )
    .all(id) as SaleItem[]
  return { ...sale, items: items.map((r) => ({
    product_id: r.product_id,
    name_snapshot: r.name_snapshot,
    price_snapshot: Number(r.price_snapshot),
    cost_snapshot: Number(r.cost_snapshot),
    qty: Number(r.qty),
    line_total: Number(r.line_total),
  })) }
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
