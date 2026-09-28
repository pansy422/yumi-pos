import { getDb } from './index'
import { nowIso } from './sql'
import * as fund from './cashFund'
import { clampMoney } from '../../shared/money'
import type {
  Purchase,
  PurchaseInput,
  PurchaseMonth,
  PurchasePaymentMethod,
} from '../../shared/types'

/**
 * Compras: registro simple de lo que se paga a proveedores. NO liga
 * productos ni toca el stock (el ingreso de stock sigue siendo el
 * pistoleo / la ficha). Existe porque en septiembre 2026 se pagaron
 * ≈ $6,5M a proveedores y hubo que reconstruirlo desde la cartola y los
 * cierres de caja.
 *
 * Si la compra se paga en efectivo, sale del fondo de efectivo con un
 * movimiento `out_supplier` ligado (`purchase_id`); borrar la compra
 * borra también esa salida.
 */

const METHODS: PurchasePaymentMethod[] = ['efectivo', 'transferencia', 'debito', 'credito']

function rowToPurchase(r: Record<string, unknown>): Purchase {
  return {
    id: Number(r.id),
    purchased_at: r.purchased_at as string,
    supplier: r.supplier as string,
    amount: Number(r.amount),
    payment_method: r.payment_method as PurchasePaymentMethod,
    note: (r.note as string | null) ?? null,
    receipt_path: (r.receipt_path as string | null) ?? null,
    user_id: (r.user_id as string | null) ?? null,
    user_name: (r.user_name as string | null) ?? null,
    created_at: r.created_at as string,
  }
}

function requireUser(userId: string | null | undefined): void {
  const db = getDb()
  if (!userId) {
    const row = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE active = 1`).get() as { c: number }
    if (Number(row.c) > 0) {
      throw new Error('Tenés que iniciar sesión con tu PIN para registrar una compra.')
    }
    return
  }
  const u = db.prepare(`SELECT 1 FROM users WHERE id = ?`).get(userId)
  if (!u) throw new Error('Tu sesión ya no es válida. Cierra y vuelve a abrir la app.')
}

function normalizeDate(input: string | undefined): string {
  const t = (input ?? '').trim()
  if (!t) return nowIso().slice(0, 10)
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) throw new Error('La fecha de la compra debe ser AAAA-MM-DD.')
  return `${m[1]}-${m[2]}-${m[3]}`
}

export function create(input: PurchaseInput): Purchase {
  const db = getDb()
  const supplier = (input.supplier ?? '').trim()
  if (!supplier) throw new Error('Indica el proveedor.')
  const amount = clampMoney(Math.round(Number(input.amount)))
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('El monto debe ser mayor a 0.')
  if (!METHODS.includes(input.payment_method)) {
    throw new Error(`Medio de pago inválido: ${String(input.payment_method)}`)
  }
  requireUser(input.user_id)
  const purchasedAt = normalizeDate(input.purchased_at)
  const id = db.transaction((): number => {
    const r = db
      .prepare(
        `INSERT INTO purchases (purchased_at, supplier, amount, payment_method, note, receipt_path, user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      )
      .get(
        purchasedAt,
        supplier,
        amount,
        input.payment_method,
        input.note?.trim() || null,
        input.receipt_path?.trim() || null,
        input.user_id ?? null,
        nowIso(),
      ) as { id: number }
    if (input.payment_method === 'efectivo') {
      fund.addWith(db, {
        kind: 'out_supplier',
        amount,
        reason: `Compra ${purchasedAt}${input.note?.trim() ? `: ${input.note.trim()}` : ''}`,
        counterparty: supplier,
        purchase_id: Number(r.id),
        user_id: input.user_id ?? null,
      })
    }
    return Number(r.id)
  })()
  return getById(id)!
}

export function getById(id: number): Purchase | null {
  const db = getDb()
  const r = db
    .prepare(
      `SELECT p.*, u.name AS user_name
         FROM purchases p
         LEFT JOIN users u ON u.id = p.user_id
        WHERE p.id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined
  return r ? rowToPurchase(r) : null
}

export function remove(id: number): void {
  const db = getDb()
  db.transaction(() => {
    db.prepare(`DELETE FROM cash_fund_movements WHERE purchase_id = ?`).run(id)
    db.prepare(`DELETE FROM purchases WHERE id = ?`).run(id)
  })()
}

/** Adjunta (o reemplaza) la foto de la boleta. */
export function setReceipt(id: number, receiptPath: string | null): Purchase {
  const db = getDb()
  db.prepare(`UPDATE purchases SET receipt_path = ? WHERE id = ?`).run(receiptPath, id)
  const p = getById(id)
  if (!p) throw new Error('Compra no encontrada')
  return p
}

export function listMonth(q: {
  month: string
  supplier?: string
  payment_method?: PurchasePaymentMethod
}): PurchaseMonth {
  const db = getDb()
  const month = (q.month ?? '').slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('El mes debe ser AAAA-MM.')
  const where: string[] = ['substr(p.purchased_at, 1, 7) = @month']
  const params: Record<string, unknown> = { month }
  if (q.supplier && q.supplier.trim()) {
    where.push('p.supplier = @supplier COLLATE NOCASE')
    params.supplier = q.supplier.trim()
  }
  if (q.payment_method) {
    where.push('p.payment_method = @method')
    params.method = q.payment_method
  }
  const whereSql = 'WHERE ' + where.join(' AND ')
  const items = (
    db
      .prepare(
        `SELECT p.*, u.name AS user_name
           FROM purchases p
           LEFT JOIN users u ON u.id = p.user_id
          ${whereSql}
          ORDER BY p.purchased_at DESC, p.id DESC`,
      )
      .all(params) as Record<string, unknown>[]
  ).map(rowToPurchase)
  const bySupplier = db
    .prepare(
      `SELECT p.supplier AS supplier, COUNT(*) AS count, COALESCE(SUM(p.amount), 0) AS total
         FROM purchases p ${whereSql}
        GROUP BY p.supplier COLLATE NOCASE
        ORDER BY total DESC`,
    )
    .all(params) as { supplier: string; count: number; total: number }[]
  const byMethod = db
    .prepare(
      `SELECT p.payment_method AS method, COUNT(*) AS count, COALESCE(SUM(p.amount), 0) AS total
         FROM purchases p ${whereSql}
        GROUP BY p.payment_method
        ORDER BY total DESC`,
    )
    .all(params) as { method: PurchasePaymentMethod; count: number; total: number }[]
  return {
    month,
    items,
    total: items.reduce((a, p) => a + p.amount, 0),
    by_supplier: bySupplier.map((r) => ({
      supplier: r.supplier,
      count: Number(r.count),
      total: Number(r.total),
    })),
    by_method: byMethod.map((r) => ({
      method: r.method,
      count: Number(r.count),
      total: Number(r.total),
    })),
  }
}

/** Proveedores ya usados, los más frecuentes primero (autocompletar). */
export function suppliers(): string[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT supplier, COUNT(*) AS c FROM purchases
        GROUP BY supplier COLLATE NOCASE
        ORDER BY c DESC, supplier COLLATE NOCASE
        LIMIT 200`,
    )
    .all() as { supplier: string }[]
  return rows.map((r) => r.supplier)
}

/** Compras dentro de un rango de fechas (para el cuadre semanal). */
export function inRange(from: string, to: string): Purchase[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT p.*, u.name AS user_name
         FROM purchases p
         LEFT JOIN users u ON u.id = p.user_id
        WHERE p.purchased_at >= ? AND p.purchased_at <= ?
        ORDER BY p.purchased_at ASC, p.id ASC`,
    )
    .all(from, to) as Record<string, unknown>[]
  return rows.map(rowToPurchase)
}
