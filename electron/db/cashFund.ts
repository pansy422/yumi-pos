import type Database from 'better-sqlite3'
import { getDb } from './index'
import { nowIso } from './sql'
import { clampMoney } from '../../shared/money'
import type {
  CashFundCount,
  CashFundMovement,
  CashFundMovementKind,
} from '../../shared/types'

/**
 * Fondo de efectivo: saldo vivo del efectivo del negocio FUERA del cajón.
 *
 * Sube con los retiros de caja hacia el fondo (al cerrar la sesión) y baja
 * con los pagos en efectivo (compras, gastos, retiros del dueño). Cada
 * movimiento lleva motivo obligatorio y, cuando corresponde, a quién se
 * le pagó. En septiembre 2026 salieron $3,63M del cajón y solo $158.000
 * tenían registro: esta tabla existe para que eso no vuelva a pasar.
 *
 * Convención de signo: positivo entra al fondo, negativo sale.
 */

const KINDS: CashFundMovementKind[] = [
  'in_from_register',
  'out_supplier',
  'out_expense',
  'out_owner',
  'out_transfer_swap',
  'adjustment',
]

export type FundAddInput = {
  kind: CashFundMovementKind
  /** Monto; el signo se normaliza según `kind` (salvo `adjustment`). */
  amount: number
  reason: string
  counterparty?: string | null
  purchase_id?: number | null
  cash_session_id?: string | null
  user_id?: string | null
}

function rowToMovement(r: Record<string, unknown>): CashFundMovement {
  return {
    id: Number(r.id),
    kind: r.kind as CashFundMovementKind,
    amount: Number(r.amount),
    reason: r.reason as string,
    counterparty: (r.counterparty as string | null) ?? null,
    purchase_id: r.purchase_id == null ? null : Number(r.purchase_id),
    cash_session_id: (r.cash_session_id as string | null) ?? null,
    user_id: (r.user_id as string | null) ?? null,
    user_name: (r.user_name as string | null) ?? null,
    created_at: r.created_at as string,
  }
}

function normalizeAmount(kind: CashFundMovementKind, amount: number): number {
  const n = clampMoney(Math.round(Number(amount)))
  if (!Number.isFinite(n) || n === 0) throw new Error('El monto no puede ser 0.')
  if (kind === 'in_from_register') return Math.abs(n)
  if (kind === 'adjustment') return n
  return -Math.abs(n)
}

/**
 * Inserta un movimiento. Usar `addWith(db, …)` cuando se está dentro de
 * otra transacción (cierre de caja, compra).
 */
export function addWith(db: Database.Database, input: FundAddInput): CashFundMovement {
  if (!KINDS.includes(input.kind)) throw new Error(`Tipo de movimiento inválido: ${input.kind}`)
  const reason = (input.reason ?? '').trim()
  if (!reason) throw new Error('Indica el motivo del movimiento del fondo.')
  const amount = normalizeAmount(input.kind, input.amount)
  const r = db
    .prepare(
      `INSERT INTO cash_fund_movements (kind, amount, reason, counterparty, purchase_id, cash_session_id, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(
      input.kind,
      amount,
      reason,
      (input.counterparty ?? '').trim() || null,
      input.purchase_id ?? null,
      input.cash_session_id ?? null,
      input.user_id ?? null,
      nowIso(),
    ) as { id: number }
  return getById(Number(r.id))!
}

export function add(input: FundAddInput): CashFundMovement {
  return addWith(getDb(), input)
}

export function getById(id: number): CashFundMovement | null {
  const db = getDb()
  const r = db
    .prepare(
      `SELECT m.*, u.name AS user_name
         FROM cash_fund_movements m
         LEFT JOIN users u ON u.id = m.user_id
        WHERE m.id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined
  return r ? rowToMovement(r) : null
}

export function balance(): number {
  const db = getDb()
  const r = db
    .prepare(`SELECT COALESCE(SUM(amount), 0) AS b FROM cash_fund_movements`)
    .get() as { b: number }
  return Number(r.b)
}

export function list(opts?: {
  limit?: number
  from?: string
  to?: string
  kind?: CashFundMovementKind
}): CashFundMovement[] {
  const db = getDb()
  const where: string[] = []
  const params: Record<string, unknown> = {}
  if (opts?.from) {
    where.push("date(m.created_at, 'localtime') >= @from")
    params.from = opts.from
  }
  if (opts?.to) {
    where.push("date(m.created_at, 'localtime') <= @to")
    params.to = opts.to
  }
  if (opts?.kind) {
    where.push('m.kind = @kind')
    params.kind = opts.kind
  }
  const limit = Math.max(1, Math.min(2000, opts?.limit ?? 200))
  const rows = db
    .prepare(
      `SELECT m.*, u.name AS user_name
         FROM cash_fund_movements m
         LEFT JOIN users u ON u.id = m.user_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY m.id DESC
        LIMIT ${limit}`,
    )
    .all(params) as Record<string, unknown>[]
  return rows.map(rowToMovement)
}

/** Fecha del último conteo (ajuste) o null si nunca se contó. */
export function lastCountAt(): string | null {
  const db = getDb()
  const r = db
    .prepare(
      `SELECT created_at FROM cash_fund_movements WHERE kind = 'adjustment' ORDER BY id DESC LIMIT 1`,
    )
    .get() as { created_at: string } | undefined
  return r?.created_at ?? null
}

/** Movimientos desde el último conteo (para mostrar antes de contar). */
export function sinceLastCount(): CashFundMovement[] {
  const db = getDb()
  const last = db
    .prepare(`SELECT id FROM cash_fund_movements WHERE kind = 'adjustment' ORDER BY id DESC LIMIT 1`)
    .get() as { id: number } | undefined
  const rows = db
    .prepare(
      `SELECT m.*, u.name AS user_name
         FROM cash_fund_movements m
         LEFT JOIN users u ON u.id = m.user_id
        WHERE m.id > ?
        ORDER BY m.id DESC
        LIMIT 500`,
    )
    .all(last?.id ?? 0) as Record<string, unknown>[]
  return rows.map(rowToMovement)
}

/**
 * Conteo físico del fondo: registra un `adjustment` por la diferencia
 * contra el saldo calculado (si la hay) y devuelve el detalle.
 */
export function count(counted: number, userId?: string | null, note?: string): CashFundCount {
  const db = getDb()
  const c = clampMoney(Math.round(Number(counted)))
  if (!Number.isFinite(c) || c < 0) throw new Error('El monto contado no puede ser negativo.')
  return db.transaction((): CashFundCount => {
    const before = balance()
    const difference = c - before
    let movement: CashFundMovement | null = null
    if (difference !== 0) {
      movement = addWith(db, {
        kind: 'adjustment',
        amount: difference,
        reason:
          `Conteo del fondo: contado $${c.toLocaleString('es-CL')} vs calculado $${before.toLocaleString('es-CL')}` +
          (note?.trim() ? ` — ${note.trim()}` : ''),
        user_id: userId ?? null,
      })
    } else if (note?.trim()) {
      // Sin diferencia igual dejamos constancia del conteo (monto 0 no se
      // permite, así que no insertamos fila; el historial de compras y
      // cierres ya muestra la actividad).
    }
    return { balance_before: before, counted: c, difference, movement }
  })()
}
