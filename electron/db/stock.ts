import type Database from 'better-sqlite3'
import { formatWeight } from '../../shared/money'
import { getDb } from './index'
import { getCurrentUserId } from './session'
import { nowIso, SQL_NOW } from './sql'
import type { StockMovement, StockMovementKind } from '../../shared/types'

/**
 * ÚNICO punto por el que cambia `products.stock`.
 *
 * Toda venta, devolución, ingreso, merma, edición manual o archivado pasa
 * por acá y deja una fila en `stock_movements` con el stock resultante y
 * el costo del momento. Con eso el cuadre de inventario de los lunes es
 * exacto y ya no hay que reconstruir entradas y bajas comparando
 * respaldos diarios (sep-2026: $367.299 bajados a mano sin venta y
 * $60.321 borrados con productos, todo sin rastro).
 *
 * Reglas:
 *  - `qty` va con signo: negativo sale, positivo entra. En gramos para
 *    productos al peso (igual que `products.stock`).
 *  - `sale` puede dejar `stock_after` NEGATIVO en el historial (se vendió
 *    sin stock); `products.stock` se mantiene en 0. Así se ve cuánto se
 *    vendió sin stock sin romper la invariante stock >= 0 del catálogo.
 *  - Cualquier otro tipo que deje el stock bajo 0 se rechaza.
 *  - `manual` exige motivo.
 *
 * Debe llamarse dentro de una transacción del llamador cuando forma parte
 * de una operación mayor (venta, importación); si se llama sola abre la
 * suya con `db.transaction`.
 */
export type ApplyStockInput = {
  product_id: string
  kind: StockMovementKind
  qty: number
  reason?: string | null
  ref_table?: string | null
  ref_id?: string | number | null
  user_id?: string | null
}

type ProductRow = {
  id: string
  name: string
  stock: number
  cost: number
  is_weight: number
}

export function applyStockMovement(
  db: Database.Database,
  input: ApplyStockInput,
): { stock_after: number; stock: number } {
  const p = db
    .prepare(`SELECT id, name, stock, cost, is_weight FROM products WHERE id = ?`)
    .get(input.product_id) as ProductRow | undefined
  if (!p) throw new Error('Producto no encontrado')
  const qty = Math.round(Number(input.qty))
  if (!Number.isFinite(qty)) throw new Error(`Cantidad inválida para "${p.name}"`)
  const reason = (input.reason ?? '').trim() || null
  if (input.kind === 'manual' && !reason) {
    throw new Error(`Indica el motivo del cambio de stock de "${p.name}".`)
  }
  const isWeight = Number(p.is_weight) === 1 ? 1 : 0
  const current = Number(p.stock)
  const after = current + qty
  let stored = after
  if (after < 0) {
    if (input.kind === 'sale') {
      // Se vende igual (aviso en el POS); el catálogo queda en 0 y el
      // historial conserva el negativo para el cuadre.
      stored = 0
    } else {
      const want = isWeight ? formatWeight(-qty) : String(-qty)
      const has = isWeight ? formatWeight(current) : String(current)
      throw new Error(`No se puede quitar ${want} de "${p.name}": solo hay ${has} en stock.`)
    }
  }
  if (qty !== 0 || input.kind === 'archive') {
    db.prepare(
      `INSERT INTO stock_movements
         (product_id, product_name, kind, qty, stock_after, cost_snapshot, is_weight, reason, ref_table, ref_id, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      p.id,
      p.name,
      input.kind,
      qty,
      after,
      Math.round(Number(p.cost)),
      isWeight,
      reason,
      input.ref_table ?? null,
      input.ref_id == null ? null : String(input.ref_id),
      input.user_id ?? getCurrentUserId(),
      nowIso(),
    )
  }
  if (stored !== current) {
    db.prepare(`UPDATE products SET stock = ?, updated_at = ${SQL_NOW} WHERE id = ?`).run(
      stored,
      p.id,
    )
  }
  return { stock_after: after, stock: stored }
}

function rowToMovement(r: Record<string, unknown>): StockMovement {
  return {
    id: Number(r.id),
    product_id: (r.product_id as string | null) ?? null,
    product_name: r.product_name as string,
    kind: r.kind as StockMovementKind,
    qty: Number(r.qty),
    stock_after: Number(r.stock_after),
    cost_snapshot: Number(r.cost_snapshot ?? 0),
    is_weight: Number(r.is_weight ?? 0) === 1 ? 1 : 0,
    reason: (r.reason as string | null) ?? null,
    ref_table: (r.ref_table as string | null) ?? null,
    ref_id: (r.ref_id as string | null) ?? null,
    user_id: (r.user_id as string | null) ?? null,
    user_name: (r.user_name as string | null) ?? null,
    created_at: r.created_at as string,
  }
}

/** Historial de un producto (más reciente primero). */
export function forProduct(productId: string, limit = 200): StockMovement[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT sm.*, u.name AS user_name
         FROM stock_movements sm
         LEFT JOIN users u ON u.id = sm.user_id
        WHERE sm.product_id = ?
        ORDER BY sm.id DESC
        LIMIT ?`,
    )
    .all(productId, Math.max(1, Math.min(2000, limit))) as Record<string, unknown>[]
  return rows.map(rowToMovement)
}

/** Historial general por rango de fechas (YYYY-MM-DD locales) y tipo. */
export function list(q: {
  from?: string
  to?: string
  kind?: StockMovementKind
  search?: string
  limit?: number
}): StockMovement[] {
  const db = getDb()
  const where: string[] = []
  const params: Record<string, unknown> = {}
  if (q.from) {
    where.push("date(sm.created_at, 'localtime') >= @from")
    params.from = q.from
  }
  if (q.to) {
    where.push("date(sm.created_at, 'localtime') <= @to")
    params.to = q.to
  }
  if (q.kind) {
    where.push('sm.kind = @kind')
    params.kind = q.kind
  }
  if (q.search && q.search.trim()) {
    where.push('sm.product_name LIKE @s')
    params.s = `%${q.search.trim()}%`
  }
  const limit = Math.max(1, Math.min(5000, q.limit ?? 500))
  const rows = db
    .prepare(
      `SELECT sm.*, u.name AS user_name
         FROM stock_movements sm
         LEFT JOIN users u ON u.id = sm.user_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY sm.id DESC
        LIMIT ${limit}`,
    )
    .all(params) as Record<string, unknown>[]
  return rows.map(rowToMovement)
}
