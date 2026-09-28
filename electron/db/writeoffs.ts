import { getDb } from './index'
import { nowIso } from './sql'
import { applyStockMovement } from './stock'
import type {
  StockWriteoff,
  WriteoffInput,
  WriteoffReason,
  WriteoffReport,
} from '../../shared/types'

/**
 * Vencidos y mermas: reemplaza el "bajar stock a mano". Cada baja queda
 * con motivo, costo del momento y responsable, baja el stock por la
 * función única de stock (kind `writeoff`) y alimenta el reporte
 * mensual a costo.
 */

const REASONS: WriteoffReason[] = ['vencido', 'dañado', 'consumo', 'robo', 'conteo', 'otro']

function rowToWriteoff(r: Record<string, unknown>): StockWriteoff {
  return {
    id: Number(r.id),
    product_id: (r.product_id as string | null) ?? null,
    product_name: r.product_name as string,
    qty: Number(r.qty),
    reason: r.reason as WriteoffReason,
    cost_snapshot: Number(r.cost_snapshot ?? 0),
    is_weight: Number(r.is_weight ?? 0) === 1 ? 1 : 0,
    note: (r.note as string | null) ?? null,
    user_id: (r.user_id as string | null) ?? null,
    user_name: (r.user_name as string | null) ?? null,
    created_at: r.created_at as string,
    cost_total: costTotal(Number(r.qty), Number(r.cost_snapshot ?? 0), Number(r.is_weight ?? 0)),
  }
}

function costTotal(qty: number, cost: number, isWeight: number): number {
  return isWeight === 1 ? Math.round((qty * cost) / 1000) : qty * cost
}

/** Misma expresión que costTotal(), para agrupar en SQL. */
const COST_SQL = `(CASE WHEN is_weight = 1 THEN ROUND(qty * cost_snapshot / 1000.0) ELSE qty * cost_snapshot END)`

export function create(input: WriteoffInput): StockWriteoff {
  const db = getDb()
  if (!REASONS.includes(input.reason)) throw new Error(`Motivo inválido: ${String(input.reason)}`)
  const qty = Math.round(Number(input.qty))
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('La cantidad debe ser mayor a 0.')
  if (!input.user_id) {
    const row = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE active = 1`).get() as { c: number }
    if (Number(row.c) > 0) {
      throw new Error('Tenés que iniciar sesión con tu PIN para registrar una merma.')
    }
  }
  const product = db
    .prepare(`SELECT id, name, cost, is_weight FROM products WHERE id = ?`)
    .get(input.product_id) as { id: string; name: string; cost: number; is_weight: number } | undefined
  if (!product) throw new Error('Producto no encontrado')
  const note = (input.note ?? '').trim() || null
  if (input.reason === 'otro' && !note) throw new Error('Con motivo "otro" hay que escribir una nota.')

  const id = db.transaction((): number => {
    const r = db
      .prepare(
        `INSERT INTO stock_writeoffs (product_id, product_name, qty, reason, cost_snapshot, is_weight, note, user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      )
      .get(
        product.id,
        product.name,
        qty,
        input.reason,
        Math.round(Number(product.cost)),
        Number(product.is_weight) === 1 ? 1 : 0,
        note,
        input.user_id ?? null,
        nowIso(),
      ) as { id: number }
    applyStockMovement(db, {
      product_id: product.id,
      kind: 'writeoff',
      qty: -qty,
      reason: `Merma (${input.reason})${note ? `: ${note}` : ''}`,
      ref_table: 'stock_writeoffs',
      ref_id: Number(r.id),
      user_id: input.user_id ?? null,
    })
    return Number(r.id)
  })()
  return getById(id)!
}

export function getById(id: number): StockWriteoff | null {
  const db = getDb()
  const r = db
    .prepare(
      `SELECT w.*, u.name AS user_name
         FROM stock_writeoffs w
         LEFT JOIN users u ON u.id = w.user_id
        WHERE w.id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined
  return r ? rowToWriteoff(r) : null
}

export function list(q: { from?: string; to?: string; limit?: number }): StockWriteoff[] {
  const db = getDb()
  const where: string[] = []
  const params: Record<string, unknown> = {}
  if (q.from) {
    where.push("date(w.created_at, 'localtime') >= @from")
    params.from = q.from
  }
  if (q.to) {
    where.push("date(w.created_at, 'localtime') <= @to")
    params.to = q.to
  }
  const limit = Math.max(1, Math.min(2000, q.limit ?? 200))
  const rows = db
    .prepare(
      `SELECT w.*, u.name AS user_name
         FROM stock_writeoffs w
         LEFT JOIN users u ON u.id = w.user_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY w.id DESC
        LIMIT ${limit}`,
    )
    .all(params) as Record<string, unknown>[]
  return rows.map(rowToWriteoff)
}

/** Reporte mensual: total a costo, por motivo y por producto. */
export function report(q: { month: string }): WriteoffReport {
  const db = getDb()
  const month = (q.month ?? '').slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('El mes debe ser AAAA-MM.')
  const whereSql = `WHERE strftime('%Y-%m', created_at, 'localtime') = @month`
  const total = db
    .prepare(`SELECT COUNT(*) AS c, COALESCE(SUM(${COST_SQL}), 0) AS t FROM stock_writeoffs ${whereSql}`)
    .get({ month }) as { c: number; t: number }
  const byReason = db
    .prepare(
      `SELECT reason, COUNT(*) AS count, COALESCE(SUM(${COST_SQL}), 0) AS cost
         FROM stock_writeoffs ${whereSql}
        GROUP BY reason ORDER BY cost DESC`,
    )
    .all({ month }) as { reason: WriteoffReason; count: number; cost: number }[]
  const byProduct = db
    .prepare(
      `SELECT product_id, product_name, is_weight, COALESCE(SUM(qty), 0) AS qty, COALESCE(SUM(${COST_SQL}), 0) AS cost
         FROM stock_writeoffs ${whereSql}
        GROUP BY product_id, product_name ORDER BY cost DESC LIMIT 100`,
    )
    .all({ month }) as {
    product_id: string | null
    product_name: string
    is_weight: number
    qty: number
    cost: number
  }[]
  return {
    month,
    count: Number(total.c),
    total_cost: Number(total.t),
    by_reason: byReason.map((r) => ({ reason: r.reason, count: Number(r.count), cost: Number(r.cost) })),
    by_product: byProduct.map((r) => ({
      product_id: r.product_id,
      product_name: r.product_name,
      is_weight: Number(r.is_weight) === 1 ? 1 : 0,
      qty: Number(r.qty),
      cost: Number(r.cost),
    })),
  }
}
