import { randomUUID } from 'node:crypto'
import { getDb } from './index'
import type {
  CashMovement,
  CashSession,
  CashSessionSummary,
  CashSummary,
  PaymentMethod,
  ZReport,
} from '../../shared/types'

function rowToSession(r: Record<string, unknown> | undefined): CashSession | null {
  if (!r) return null
  return {
    id: r.id as string,
    opened_at: r.opened_at as string,
    closed_at: (r.closed_at as string | null) ?? null,
    opening_amount: Number(r.opening_amount),
    expected_close: r.expected_close == null ? null : Number(r.expected_close),
    counted_close: r.counted_close == null ? null : Number(r.counted_close),
    difference: r.difference == null ? null : Number(r.difference),
    notes: (r.notes as string | null) ?? null,
    opened_by_id: (r.opened_by_id as string | null) ?? null,
    opened_by_name: (r.opened_by_name as string | null) ?? null,
    closed_by_id: (r.closed_by_id as string | null) ?? null,
    closed_by_name: (r.closed_by_name as string | null) ?? null,
  }
}

/**
 * SELECT con JOINs a users para devolver los nombres del cajero que
 * abrió y cerró. Útil para que la UI no haga 2 fetches extra.
 */
const SESSION_WITH_USERS_SELECT = `
  SELECT cs.*,
         uo.name AS opened_by_name,
         uc.name AS closed_by_name
    FROM cash_sessions cs
    LEFT JOIN users uo ON uo.id = cs.opened_by_id
    LEFT JOIN users uc ON uc.id = cs.closed_by_id
`

export function current(): CashSession | null {
  const db = getDb()
  const r = db
    .prepare(
      `${SESSION_WITH_USERS_SELECT} WHERE cs.closed_at IS NULL ORDER BY cs.opened_at DESC LIMIT 1`,
    )
    .get() as Record<string, unknown> | undefined
  return rowToSession(r)
}

export function getById(sessionId: string): CashSession | null {
  const db = getDb()
  const r = db
    .prepare(`${SESSION_WITH_USERS_SELECT} WHERE cs.id = ?`)
    .get(sessionId) as Record<string, unknown> | undefined
  return rowToSession(r)
}

export function open(
  openingAmount: number,
  notes?: string,
  cashierId?: string | null,
): CashSession {
  if (current()) throw new Error('Ya hay una caja abierta. Ciérrala antes de abrir otra.')
  const db = getDb()
  // Si el sistema tiene usuarios creados, exigimos saber quién abre la
  // caja — sin esto, las ventas y movimientos no quedan asignadas a
  // nadie y se rompe la auditoría. La cajera DEBE estar logueada.
  // En modo single-user (sin usuarios creados) permitimos null.
  if (!cashierId) {
    const userRow = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE active = 1`).get() as
      | { c: number }
      | undefined
    if (userRow && Number(userRow.c) > 0) {
      throw new Error(
        'Tenés que iniciar sesión antes de abrir la caja. Cerrá la app, volvé a abrirla y ingresá con tu PIN.',
      )
    }
  }
  const id = randomUUID()
  db.prepare(
    `INSERT INTO cash_sessions (id, opening_amount, notes, opened_by_id) VALUES (?, ?, ?, ?)`,
  ).run(id, Math.round(openingAmount), notes ?? null, cashierId ?? null)
  return getById(id)!
}

export function summary(sessionId: string): CashSummary {
  const db = getDb()
  const session = db
    .prepare(`SELECT opening_amount FROM cash_sessions WHERE id = ?`)
    .get(sessionId) as { opening_amount: number } | undefined
  if (!session) throw new Error('Sesión de caja no encontrada')

  const sales = db
    .prepare(
      `SELECT
         COUNT(*) AS count,
         COALESCE((
           SELECT SUM(sp.amount)
           FROM sale_payments sp
           JOIN sales s2 ON s2.id = sp.sale_id
           WHERE s2.cash_session_id = ? AND s2.voided = 0 AND sp.method = 'efectivo'
         ), 0) AS cash_sales,
         COALESCE(SUM(total), 0) AS gross_sales
       FROM sales
       WHERE cash_session_id = ? AND voided = 0`,
    )
    .get(sessionId, sessionId) as { count: number; cash_sales: number; gross_sales: number }

  const movements = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN kind = 'deposit' THEN amount ELSE 0 END),0) AS dep,
         COALESCE(SUM(CASE WHEN kind = 'withdraw' THEN amount ELSE 0 END),0) AS wd,
         COALESCE(SUM(CASE WHEN kind = 'adjustment' THEN amount ELSE 0 END),0) AS adj
       FROM cash_movements WHERE cash_session_id = ?`,
    )
    .get(sessionId) as { dep: number; wd: number; adj: number }

  const opening = Number(session.opening_amount)
  const cashSales = Number(sales.cash_sales)
  const dep = Number(movements.dep)
  const wd = Number(movements.wd)
  const adj = Number(movements.adj)
  const expected = opening + cashSales + dep - wd + adj

  return {
    session_id: sessionId,
    opening,
    sales_count: Number(sales.count),
    cash_sales: cashSales,
    gross_sales: Number(sales.gross_sales),
    deposits: dep,
    withdraws: wd,
    adjustments: adj,
    expected,
  }
}

export function expectedClose(sessionId: string): number {
  return summary(sessionId).expected
}

export function buildZReport(sessionId: string): ZReport {
  const db = getDb()
  const session = getById(sessionId)
  if (!session) throw new Error('Sesión de caja no encontrada')
  const sum = summary(sessionId)
  const byPayment = db
    .prepare(
      `SELECT sp.method AS method,
              COUNT(*) AS count,
              COALESCE(SUM(sp.amount),0) AS total
       FROM sale_payments sp
       JOIN sales s ON s.id = sp.sale_id
       WHERE s.cash_session_id = ? AND s.voided = 0
       GROUP BY sp.method`,
    )
    .all(sessionId) as { method: PaymentMethod; count: number; total: number }[]
  const voided = db
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(total),0) AS total
       FROM sales WHERE cash_session_id = ? AND voided = 1`,
    )
    .get(sessionId) as { count: number; total: number }
  return {
    session,
    summary: sum,
    by_payment: byPayment,
    voided_count: Number(voided.count),
    voided_total: Number(voided.total),
  }
}

export function close(
  countedAmount: number,
  notes?: string,
  cashierId?: string | null,
): CashSession {
  const open = current()
  if (!open) throw new Error('No hay caja abierta')
  const db = getDb()
  // Mismo principio que en open(): si hay users, alguien tiene que
  // estar logueado para cerrar.
  if (!cashierId) {
    const userRow = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE active = 1`).get() as
      | { c: number }
      | undefined
    if (userRow && Number(userRow.c) > 0) {
      throw new Error('Tenés que iniciar sesión antes de cerrar la caja.')
    }
  }
  const expected = expectedClose(open.id)
  const counted = Math.round(countedAmount)
  const difference = counted - expected
  db.prepare(
    `UPDATE cash_sessions
       SET closed_at = datetime('now'),
           expected_close = ?,
           counted_close = ?,
           difference = ?,
           closed_by_id = ?,
           notes = COALESCE(?, notes)
     WHERE id = ?`,
  ).run(expected, counted, difference, cashierId ?? null, notes ?? null, open.id)
  return getById(open.id)!
}

export function move(
  kind: 'withdraw' | 'deposit' | 'adjustment',
  amount: number,
  note: string,
  cashierId?: string | null,
): CashMovement {
  const open = current()
  if (!open) throw new Error('No hay caja abierta')
  const db = getDb()
  if (!cashierId) {
    const userRow = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE active = 1`).get() as
      | { c: number }
      | undefined
    if (userRow && Number(userRow.c) > 0) {
      throw new Error('Tenés que iniciar sesión antes de registrar movimientos de caja.')
    }
  }
  const id = randomUUID()
  db.prepare(
    `INSERT INTO cash_movements (id, cash_session_id, kind, amount, note, cashier_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, open.id, kind, Math.round(amount), note, cashierId ?? null)
  return movementsById(id)!
}

function movementRow(r: Record<string, unknown>): CashMovement {
  return {
    id: r.id as string,
    cash_session_id: r.cash_session_id as string,
    kind: r.kind as CashMovement['kind'],
    amount: Number(r.amount),
    note: (r.note as string | null) ?? null,
    sale_id: (r.sale_id as string | null) ?? null,
    created_at: r.created_at as string,
    cashier_id: (r.cashier_id as string | null) ?? null,
    cashier_name: (r.cashier_name as string | null) ?? null,
  }
}

function movementsById(id: string): CashMovement | null {
  const db = getDb()
  const r = db
    .prepare(
      `SELECT cm.*, u.name AS cashier_name
       FROM cash_movements cm
       LEFT JOIN users u ON u.id = cm.cashier_id
       WHERE cm.id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined
  return r ? movementRow(r) : null
}

export function movements(sessionId: string): CashMovement[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT cm.*, u.name AS cashier_name
         FROM cash_movements cm
         LEFT JOIN users u ON u.id = cm.cashier_id
        WHERE cm.cash_session_id = ?
        ORDER BY cm.created_at ASC`,
    )
    .all(sessionId) as Record<string, unknown>[]
  return rows.map(movementRow)
}

/**
 * Historial de cajas cerradas — para la vista de auditoría. Devuelve
 * cada sesión con conteo de ventas y total en efectivo, ordenado por
 * fecha de apertura (descendente).
 */
export function history(opts?: { limit?: number; cashierId?: string | null }): CashSessionSummary[] {
  const db = getDb()
  const limit = Math.max(1, Math.min(500, opts?.limit ?? 50))
  const where: string[] = ['cs.closed_at IS NOT NULL']
  const params: (string | number)[] = []
  if (opts?.cashierId) {
    where.push('(cs.opened_by_id = ? OR cs.closed_by_id = ?)')
    params.push(opts.cashierId, opts.cashierId)
  }
  const rows = db
    .prepare(
      `SELECT cs.*,
              uo.name AS opened_by_name,
              uc.name AS closed_by_name,
              (SELECT COUNT(*) FROM sales s WHERE s.cash_session_id = cs.id AND s.voided = 0) AS sales_count,
              COALESCE((
                SELECT SUM(sp.amount)
                FROM sale_payments sp
                JOIN sales s ON s.id = sp.sale_id
                WHERE s.cash_session_id = cs.id AND s.voided = 0 AND sp.method = 'efectivo'
              ), 0) AS cash_sales
         FROM cash_sessions cs
         LEFT JOIN users uo ON uo.id = cs.opened_by_id
         LEFT JOIN users uc ON uc.id = cs.closed_by_id
        WHERE ${where.join(' AND ')}
        ORDER BY cs.opened_at DESC
        LIMIT ?`,
    )
    .all(...params, limit) as Record<string, unknown>[]
  return rows.map((r) => {
    const session = rowToSession(r)!
    return {
      ...session,
      sales_count: Number(r.sales_count ?? 0),
      cash_sales: Number(r.cash_sales ?? 0),
    }
  })
}
