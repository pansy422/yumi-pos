import { randomUUID } from 'node:crypto'
import { getDb } from './index'
import type { CashMovement, CashSession } from '../../shared/types'

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
  }
}

export function current(): CashSession | null {
  const db = getDb()
  const r = db
    .prepare(`SELECT * FROM cash_sessions WHERE closed_at IS NULL ORDER BY opened_at DESC LIMIT 1`)
    .get() as Record<string, unknown> | undefined
  return rowToSession(r)
}

export function open(openingAmount: number, notes?: string): CashSession {
  if (current()) throw new Error('Ya hay una caja abierta. Ciérrala antes de abrir otra.')
  const db = getDb()
  const id = randomUUID()
  db.prepare(
    `INSERT INTO cash_sessions (id, opening_amount, notes) VALUES (?, ?, ?)`,
  ).run(id, Math.round(openingAmount), notes ?? null)
  return rowToSession(
    db.prepare(`SELECT * FROM cash_sessions WHERE id = ?`).get(id) as Record<string, unknown>,
  )!
}

export function expectedClose(sessionId: string): number {
  const db = getDb()
  const session = db
    .prepare(`SELECT opening_amount FROM cash_sessions WHERE id = ?`)
    .get(sessionId) as { opening_amount: number } | undefined
  if (!session) throw new Error('Sesión de caja no encontrada')
  const cashSales = db
    .prepare(
      `SELECT COALESCE(SUM(total),0) AS s FROM sales WHERE cash_session_id = ? AND payment_method = 'efectivo' AND voided = 0`,
    )
    .get(sessionId) as { s: number }
  const movements = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN kind = 'deposit' THEN amount ELSE 0 END),0) AS dep,
         COALESCE(SUM(CASE WHEN kind = 'withdraw' THEN amount ELSE 0 END),0) AS wd,
         COALESCE(SUM(CASE WHEN kind = 'adjustment' THEN amount ELSE 0 END),0) AS adj
       FROM cash_movements WHERE cash_session_id = ?`,
    )
    .get(sessionId) as { dep: number; wd: number; adj: number }
  return (
    Number(session.opening_amount) +
    Number(cashSales.s) +
    Number(movements.dep) -
    Number(movements.wd) +
    Number(movements.adj)
  )
}

export function close(countedAmount: number, notes?: string): CashSession {
  const open = current()
  if (!open) throw new Error('No hay caja abierta')
  const db = getDb()
  const expected = expectedClose(open.id)
  const counted = Math.round(countedAmount)
  const difference = counted - expected
  db.prepare(
    `UPDATE cash_sessions SET closed_at = datetime('now'), expected_close = ?, counted_close = ?, difference = ?, notes = COALESCE(?, notes) WHERE id = ?`,
  ).run(expected, counted, difference, notes ?? null, open.id)
  return rowToSession(
    db.prepare(`SELECT * FROM cash_sessions WHERE id = ?`).get(open.id) as Record<string, unknown>,
  )!
}

export function move(
  kind: 'withdraw' | 'deposit' | 'adjustment',
  amount: number,
  note: string,
): CashMovement {
  const open = current()
  if (!open) throw new Error('No hay caja abierta')
  const db = getDb()
  const id = randomUUID()
  db.prepare(
    `INSERT INTO cash_movements (id, cash_session_id, kind, amount, note) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, open.id, kind, Math.round(amount), note)
  const r = db.prepare(`SELECT * FROM cash_movements WHERE id = ?`).get(id) as Record<
    string,
    unknown
  >
  return {
    id: r.id as string,
    cash_session_id: r.cash_session_id as string,
    kind: r.kind as CashMovement['kind'],
    amount: Number(r.amount),
    note: (r.note as string | null) ?? null,
    sale_id: (r.sale_id as string | null) ?? null,
    created_at: r.created_at as string,
  }
}

export function movements(sessionId: string): CashMovement[] {
  const db = getDb()
  const rows = db
    .prepare(`SELECT * FROM cash_movements WHERE cash_session_id = ? ORDER BY created_at ASC`)
    .all(sessionId) as Record<string, unknown>[]
  return rows.map((r) => ({
    id: r.id as string,
    cash_session_id: r.cash_session_id as string,
    kind: r.kind as CashMovement['kind'],
    amount: Number(r.amount),
    note: (r.note as string | null) ?? null,
    sale_id: (r.sale_id as string | null) ?? null,
    created_at: r.created_at as string,
  }))
}
