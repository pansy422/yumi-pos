import { getDb } from './index'
import { nowIso } from './sql'
import * as settingsRepo from './settings'
import * as purchasesRepo from './purchases'
import type {
  BankRow,
  PaymentMethod,
  ReconciliationConfirmInput,
  ReconciliationStatus,
  WeekReconciliation,
  WeeklyReconciliationRecord,
} from '../../shared/types'

/**
 * Cuadre de los lunes.
 *
 * Cada semana (lunes a domingo) se arma un resumen de ventas, compras,
 * efectivo, tarjetas vs cartola, transferencias e inventario, con las
 * diferencias explicadas, y se confirma en `weekly_reconciliations`. Si
 * la semana anterior no está confirmada, la pantalla de venta se bloquea
 * a partir del día configurado (`reconciliation.weekday`, 1 = lunes).
 *
 * Todas las fechas de semana son `YYYY-MM-DD` en hora local del PC; las
 * consultas usan `date(col, 'localtime')` igual que los reportes.
 */

const DAY_MS = 24 * 60 * 60 * 1000

function localDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseLocal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

function addDays(s: string, n: number): string {
  const d = parseLocal(s)
  d.setDate(d.getDate() + n)
  return localDate(d)
}

/** 1 = lunes … 7 = domingo (ISO). */
function isoWeekday(d: Date): number {
  const js = d.getDay() // 0 = domingo
  return js === 0 ? 7 : js
}

/** Lunes de la semana que contiene `d`. */
function mondayOf(d: Date): string {
  const wd = isoWeekday(d)
  const m = new Date(d)
  m.setDate(d.getDate() - (wd - 1))
  return localDate(m)
}

export function currentWeekStart(now = new Date()): string {
  return mondayOf(now)
}

export function previousWeekStart(now = new Date()): string {
  return addDays(mondayOf(now), -7)
}

export function weekEnd(weekStart: string): string {
  return addDays(weekStart, 6)
}

function assertWeekStart(s: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('La semana debe ser una fecha AAAA-MM-DD.')
  const d = parseLocal(s)
  if (isoWeekday(d) !== 1) throw new Error('La semana debe empezar un lunes.')
  return s
}

function rowToRecord(r: Record<string, unknown>): WeeklyReconciliationRecord {
  let data: WeekReconciliation | null = null
  try {
    data = JSON.parse(r.data_json as string) as WeekReconciliation
  } catch {
    data = null
  }
  return {
    id: Number(r.id),
    week_start: r.week_start as string,
    week_end: r.week_end as string,
    confirmed_at: r.confirmed_at as string,
    user_id: (r.user_id as string | null) ?? null,
    user_name: (r.user_name as string | null) ?? null,
    data,
  }
}

export function get(weekStart: string): WeeklyReconciliationRecord | null {
  const db = getDb()
  const r = db
    .prepare(
      `SELECT w.*, u.name AS user_name
         FROM weekly_reconciliations w
         LEFT JOIN users u ON u.id = w.user_id
        WHERE w.week_start = ?`,
    )
    .get(weekStart) as Record<string, unknown> | undefined
  return r ? rowToRecord(r) : null
}

export function history(limit = 52): WeeklyReconciliationRecord[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT w.*, u.name AS user_name
         FROM weekly_reconciliations w
         LEFT JOIN users u ON u.id = w.user_id
        ORDER BY w.week_start DESC
        LIMIT ?`,
    )
    .all(Math.max(1, Math.min(520, limit))) as Record<string, unknown>[]
  return rows.map(rowToRecord)
}

function weekHasActivity(weekStart: string): boolean {
  const db = getDb()
  const end = weekEnd(weekStart)
  const r = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM sales WHERE date(completed_at, 'localtime') BETWEEN @s AND @e) +
         (SELECT COUNT(*) FROM cash_sessions WHERE date(opened_at, 'localtime') BETWEEN @s AND @e) AS c`,
    )
    .get({ s: weekStart, e: end }) as { c: number }
  return Number(r.c) > 0
}

/**
 * ¿Hay que bloquear la venta? Sí cuando hoy ya pasó el día del cuadre
 * (lunes por defecto), la semana anterior tuvo actividad y todavía no
 * está confirmada.
 */
export function status(now = new Date()): ReconciliationStatus {
  const weekday = settingsRepo.getAll().reconciliation.weekday
  const prev = previousWeekStart(now)
  const record = get(prev)
  const activity = weekHasActivity(prev)
  const dayReached = isoWeekday(now) >= weekday
  const required = dayReached && activity && !record
  return {
    required,
    week_start: prev,
    week_end: weekEnd(prev),
    confirmed: !!record,
    has_activity: activity,
    weekday,
  }
}

/** Semanas candidatas para la pantalla: las últimas 12 con o sin cuadre. */
export function weeks(now = new Date()): { week_start: string; week_end: string; confirmed: boolean }[] {
  const out: { week_start: string; week_end: string; confirmed: boolean }[] = []
  let ws = currentWeekStart(now)
  for (let i = 0; i < 12; i++) {
    out.push({ week_start: ws, week_end: weekEnd(ws), confirmed: !!get(ws) })
    ws = addDays(ws, -7)
  }
  return out
}

// ── Cartola BCI ──────────────────────────────────────────────────────────

function parseClpNumber(s: string): number {
  const t = (s ?? '').trim().replace(/\$/g, '').replace(/\s/g, '')
  if (!t) return 0
  // "1.980" → 1980 ; "1.980,50" → 1980.5 ; "1980" → 1980 ; "-1.980" → -1980
  let normalized = t
  if (t.includes(',')) normalized = t.replace(/\./g, '').replace(',', '.')
  else normalized = t.replace(/\./g, '')
  const n = Number(normalized)
  return Number.isFinite(n) ? Math.round(n) : 0
}

function parseClDate(s: string): string | null {
  const t = (s ?? '').trim()
  let m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"'
        i++
      } else inQ = !inQ
    } else if (ch === sep && !inQ) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((c) => c.trim())
}

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/**
 * Cartola BCI exportada a CSV: columnas fecha, descripción, cargo, abono,
 * saldo (en ese orden o con encabezados reconocibles). Acepta `;` o `,`
 * como separador y montos con punto de miles.
 */
export function parseBciCsv(text: string): BankRow[] {
  const lines = (text ?? '')
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []
  const sep = (lines[0].match(/;/g) ?? []).length >= (lines[0].match(/,/g) ?? []).length ? ';' : ','
  let idx = { date: 0, desc: 1, debit: 2, credit: 3, balance: 4 }
  let start = 0
  const header = splitCsvLine(lines[0], sep).map(normalizeHeader)
  if (header.some((h) => h.includes('fecha'))) {
    const find = (...keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)))
    idx = {
      date: find('fecha'),
      desc: find('descripcion', 'detalle', 'glosa', 'movimiento'),
      debit: find('cargo', 'debito', 'egreso'),
      credit: find('abono', 'credito', 'ingreso', 'deposito'),
      balance: find('saldo'),
    }
    start = 1
  }
  const rows: BankRow[] = []
  for (let i = start; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], sep)
    const date = parseClDate(cols[idx.date] ?? '')
    if (!date) continue
    rows.push({
      date,
      description: (cols[idx.desc] ?? '').trim(),
      debit: idx.debit >= 0 ? Math.abs(parseClpNumber(cols[idx.debit] ?? '')) : 0,
      credit: idx.credit >= 0 ? Math.abs(parseClpNumber(cols[idx.credit] ?? '')) : 0,
      balance: idx.balance >= 0 ? parseClpNumber(cols[idx.balance] ?? '') : null,
    })
  }
  return rows
}

const CARD_RX = /transbank|redcompra|redbanc|getnet|klap|sumup|tarjeta|webpay/i
const TRANSFER_RX = /transf|tef\b|traspaso|abono de terceros|dep[oó]sito/i

/** Día hábil siguiente en que Transbank abona las ventas del día D. */
function settlementDate(saleDate: string): string {
  const wd = isoWeekday(parseLocal(saleDate))
  if (wd <= 4) return addDays(saleDate, 1) // lun–jue → día siguiente
  return addDays(saleDate, 8 - wd) // vie/sáb/dom → lunes
}

// ── Cómputo de la semana ─────────────────────────────────────────────────

const COST_LINE_SQL = `(CASE WHEN si.is_weight = 1
                              THEN ROUND(si.cost_snapshot * (si.qty - si.returned_qty) / 1000.0)
                              ELSE si.cost_snapshot * (si.qty - si.returned_qty) END)`

const MOV_VALUE_SQL = `(CASE WHEN is_weight = 1 THEN qty * cost_snapshot / 1000.0 ELSE qty * cost_snapshot END)`

export function compute(weekStartInput: string, opts?: { bank_rows?: BankRow[] }): WeekReconciliation {
  const db = getDb()
  const weekStart = assertWeekStart(weekStartInput)
  const end = weekEnd(weekStart)
  const p = { s: weekStart, e: end }
  const days: string[] = []
  for (let i = 0; i < 7; i++) days.push(addDays(weekStart, i))

  // 1. Ventas por medio de pago (sale_payments, sin anuladas).
  const byMethod = db
    .prepare(
      `SELECT sp.method AS method, COUNT(DISTINCT sp.sale_id) AS count, COALESCE(SUM(sp.amount), 0) AS total
         FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id
        WHERE date(s.completed_at, 'localtime') BETWEEN @s AND @e AND s.voided = 0
        GROUP BY sp.method ORDER BY total DESC`,
    )
    .all(p) as { method: PaymentMethod; count: number; total: number }[]
  const salesTotals = db
    .prepare(
      `SELECT COUNT(*) AS c, COALESCE(SUM(total), 0) AS t FROM sales
        WHERE date(completed_at, 'localtime') BETWEEN @s AND @e AND voided = 0`,
    )
    .get(p) as { c: number; t: number }
  const byDayRows = db
    .prepare(
      `SELECT date(s.completed_at, 'localtime') AS d, sp.method AS method, COALESCE(SUM(sp.amount), 0) AS total
         FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id
        WHERE date(s.completed_at, 'localtime') BETWEEN @s AND @e AND s.voided = 0
        GROUP BY d, sp.method`,
    )
    .all(p) as { d: string; method: PaymentMethod; total: number }[]
  const byDay = days.map((d) => {
    const entry: Record<string, number> = {}
    for (const r of byDayRows) if (r.d === d) entry[r.method] = Number(r.total)
    return {
      date: d,
      efectivo: entry.efectivo ?? 0,
      debito: entry.debito ?? 0,
      credito: entry.credito ?? 0,
      transferencia: entry.transferencia ?? 0,
      otro: entry.otro ?? 0,
      total: Object.values(entry).reduce((a, b) => a + b, 0),
    }
  })

  // 2. Compras.
  const purchases = purchasesRepo.inRange(weekStart, end)
  const purchasesByMethod = new Map<string, { count: number; total: number }>()
  const purchasesBySupplier = new Map<string, { count: number; total: number }>()
  for (const pu of purchases) {
    const m = purchasesByMethod.get(pu.payment_method) ?? { count: 0, total: 0 }
    m.count++
    m.total += pu.amount
    purchasesByMethod.set(pu.payment_method, m)
    const key = pu.supplier.trim()
    const s = purchasesBySupplier.get(key) ?? { count: 0, total: 0 }
    s.count++
    s.total += pu.amount
    purchasesBySupplier.set(key, s)
  }

  // 3. Efectivo.
  const cashSales = byMethod.find((m) => m.method === 'efectivo')?.total ?? 0
  const withdrawals = db
    .prepare(
      `SELECT cm.amount, cm.reason, cm.note, cm.counterparty, cm.created_at, u.name AS user_name
         FROM cash_movements cm LEFT JOIN users u ON u.id = cm.cashier_id
        WHERE cm.kind = 'withdraw' AND date(cm.created_at, 'localtime') BETWEEN @s AND @e
        ORDER BY cm.created_at`,
    )
    .all(p) as {
    amount: number
    reason: string | null
    note: string | null
    counterparty: string | null
    created_at: string
    user_name: string | null
  }[]
  const sessions = db
    .prepare(
      `SELECT cs.id, cs.opened_at, cs.closed_at, cs.opening_amount, cs.expected_close, cs.counted_close,
              cs.difference, cs.difference_note, cs.register_float
         FROM cash_sessions cs
        WHERE date(cs.opened_at, 'localtime') BETWEEN @s AND @e
        ORDER BY cs.opened_at`,
    )
    .all(p) as {
    id: string
    opened_at: string
    closed_at: string | null
    opening_amount: number
    expected_close: number | null
    counted_close: number | null
    difference: number | null
    difference_note: string | null
    register_float: number | null
  }[]
  const fundStart = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS b FROM cash_fund_movements WHERE date(created_at, 'localtime') < @s`,
    )
    .get(p) as { b: number }
  const fundByKind = db
    .prepare(
      `SELECT kind, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM cash_fund_movements
        WHERE date(created_at, 'localtime') BETWEEN @s AND @e GROUP BY kind`,
    )
    .all(p) as { kind: string; total: number; count: number }[]
  const fundOut = db
    .prepare(
      `SELECT m.kind, m.amount, m.reason, m.counterparty, m.created_at, u.name AS user_name
         FROM cash_fund_movements m LEFT JOIN users u ON u.id = m.user_id
        WHERE date(m.created_at, 'localtime') BETWEEN @s AND @e AND m.amount < 0
        ORDER BY m.created_at`,
    )
    .all(p) as {
    kind: string
    amount: number
    reason: string
    counterparty: string | null
    created_at: string
    user_name: string | null
  }[]
  const fundIn = fundByKind
    .filter((k) => k.kind === 'in_from_register')
    .reduce((a, k) => a + Number(k.total), 0)
  const fundOutTotal = fundByKind
    .filter((k) => k.kind !== 'in_from_register' && k.kind !== 'adjustment')
    .reduce((a, k) => a + Number(k.total), 0)
  const fundAdjust = fundByKind
    .filter((k) => k.kind === 'adjustment')
    .reduce((a, k) => a + Number(k.total), 0)
  const fundEndCalc = Number(fundStart.b) + fundIn + fundOutTotal + fundAdjust

  // 4. Tarjetas vs cartola.
  const bankRows = opts?.bank_rows ?? []
  const cardCredits = bankRows.filter((r) => r.credit > 0 && CARD_RX.test(r.description))
  const transferCredits = bankRows.filter(
    (r) => r.credit > 0 && !CARD_RX.test(r.description) && TRANSFER_RX.test(r.description),
  )
  const settleMap = new Map<string, { sales_days: string[]; expected: number }>()
  for (const d of byDay) {
    const cards = d.debito + d.credito
    const key = settlementDate(d.date)
    const cur = settleMap.get(key) ?? { sales_days: [], expected: 0 }
    cur.sales_days.push(d.date)
    cur.expected += cards
    settleMap.set(key, cur)
  }
  const cards = [...settleMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([settle_date, v]) => {
      const received = cardCredits
        .filter((r) => r.date === settle_date)
        .reduce((a, r) => a + r.credit, 0)
      const diff = received - v.expected
      const pct = v.expected > 0 ? Math.abs(diff) / v.expected : received > 0 ? 1 : 0
      return {
        settle_date,
        sales_days: v.sales_days,
        expected: v.expected,
        received: bankRows.length ? received : null,
        difference: bankRows.length ? diff : null,
        flagged: bankRows.length > 0 && v.expected > 0 && pct > 0.03,
      }
    })

  // 5. Transferencias: cada venta por transferencia busca un abono del mismo monto.
  const transferSales = db
    .prepare(
      `SELECT s.number, date(s.completed_at, 'localtime') AS d, sp.amount
         FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id
        WHERE sp.method = 'transferencia' AND s.voided = 0
          AND date(s.completed_at, 'localtime') BETWEEN @s AND @e
        ORDER BY s.completed_at`,
    )
    .all(p) as { number: number; d: string; amount: number }[]
  const pool = transferCredits.map((r) => ({ ...r, used: false }))
  const transfers = transferSales.map((t) => {
    const hit = pool.find((r) => !r.used && r.credit === t.amount)
    if (hit) hit.used = true
    return {
      sale_number: t.number,
      date: t.d,
      amount: t.amount,
      matched: bankRows.length ? !!hit : null,
      bank_date: hit?.date ?? null,
    }
  })

  // 6. Inventario a costo.
  const valueNow = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN is_weight = 1 THEN stock * cost / 1000.0 ELSE stock * cost END), 0) AS v FROM products`,
    )
    .get() as { v: number }
  const after = db
    .prepare(
      `SELECT COALESCE(SUM(${MOV_VALUE_SQL}), 0) AS v FROM stock_movements
        WHERE date(created_at, 'localtime') > @e AND kind <> 'archive'`,
    )
    .get(p) as { v: number }
  const inWeek = db
    .prepare(
      `SELECT kind, COALESCE(SUM(${MOV_VALUE_SQL}), 0) AS v, COUNT(*) AS c FROM stock_movements
        WHERE date(created_at, 'localtime') BETWEEN @s AND @e GROUP BY kind`,
    )
    .all(p) as { kind: string; v: number; c: number }[]
  const kv = (k: string) => Number(inWeek.find((r) => r.kind === k)?.v ?? 0)
  const entries = kv('entry')
  const returns = kv('return')
  const salesMov = kv('sale') // negativo
  const writeoffsV = kv('writeoff') // negativo
  const manual = kv('manual')
  const soldWithoutStock = db
    .prepare(
      `SELECT COALESCE(SUM(
          (CASE WHEN is_weight = 1 THEN 1/1000.0 ELSE 1 END) * cost_snapshot *
          MIN(-qty, -stock_after)
        ), 0) AS v
         FROM stock_movements
        WHERE kind = 'sale' AND stock_after < 0 AND date(created_at, 'localtime') BETWEEN @s AND @e`,
    )
    .get(p) as { v: number }
  const soldCost = db
    .prepare(
      `SELECT COALESCE(SUM(${COST_LINE_SQL}), 0) AS v
         FROM sale_items si JOIN sales s ON s.id = si.sale_id
        WHERE s.voided = 0 AND date(s.completed_at, 'localtime') BETWEEN @s AND @e`,
    )
    .get(p) as { v: number }
  const valueEndReal = Math.round(Number(valueNow.v) - Number(after.v))
  const flows = entries + returns + salesMov + writeoffsV + manual
  const valueStart = Math.round(valueEndReal - flows)
  const valueEndCalc = Math.round(valueStart + entries + returns - Math.abs(salesMov) - Math.abs(writeoffsV) + manual)

  // Diferencias pendientes arrastradas de la semana anterior.
  const prevRecord = get(addDays(weekStart, -7))
  const carried = prevRecord?.data?.explanations
    ? Object.entries(prevRecord.data.explanations)
        .filter(([, e]) => e.pending)
        .map(([key, e]) => ({ key, note: e.note, week_start: prevRecord.week_start }))
    : []

  return {
    week_start: weekStart,
    week_end: end,
    generated_at: nowIso(),
    sales: {
      count: Number(salesTotals.c),
      total: Number(salesTotals.t),
      by_method: byMethod.map((m) => ({ method: m.method, count: Number(m.count), total: Number(m.total) })),
      by_day: byDay,
    },
    purchases: {
      count: purchases.length,
      total: purchases.reduce((a, x) => a + x.amount, 0),
      by_method: [...purchasesByMethod.entries()].map(([method, v]) => ({ method, ...v })),
      by_supplier: [...purchasesBySupplier.entries()]
        .map(([supplier, v]) => ({ supplier, ...v }))
        .sort((a, b) => b.total - a.total),
    },
    cash: {
      cash_sales: cashSales,
      withdrawals_total: withdrawals.reduce((a, w) => a + Number(w.amount), 0),
      withdrawals: withdrawals.map((w) => ({
        amount: Number(w.amount),
        reason: w.reason ?? w.note ?? '',
        counterparty: w.counterparty,
        created_at: w.created_at,
        user_name: w.user_name,
      })),
      sessions: sessions.map((s) => ({
        id: s.id,
        opened_at: s.opened_at,
        closed_at: s.closed_at,
        opening_amount: Number(s.opening_amount),
        expected_close: s.expected_close == null ? null : Number(s.expected_close),
        counted_close: s.counted_close == null ? null : Number(s.counted_close),
        difference: s.difference == null ? null : Number(s.difference),
        difference_note: s.difference_note,
        register_float: s.register_float == null ? null : Number(s.register_float),
      })),
      sessions_difference: sessions.reduce((a, s) => a + Number(s.difference ?? 0), 0),
      fund_start: Number(fundStart.b),
      fund_in_from_register: fundIn,
      fund_out_total: fundOutTotal,
      fund_adjustments: fundAdjust,
      fund_out_by_kind: fundByKind
        .filter((k) => k.kind !== 'in_from_register' && k.kind !== 'adjustment')
        .map((k) => ({ kind: k.kind, total: Number(k.total), count: Number(k.count) })),
      fund_out: fundOut.map((m) => ({
        kind: m.kind,
        amount: Number(m.amount),
        reason: m.reason,
        counterparty: m.counterparty,
        created_at: m.created_at,
        user_name: m.user_name,
      })),
      fund_end_calc: fundEndCalc,
    },
    cards: {
      expected_total: byDay.reduce((a, d) => a + d.debito + d.credito, 0),
      received_total: bankRows.length ? cardCredits.reduce((a, r) => a + r.credit, 0) : null,
      rows: cards,
    },
    transfers: {
      expected_total: transferSales.reduce((a, t) => a + t.amount, 0),
      received_total: bankRows.length ? transferCredits.reduce((a, r) => a + r.credit, 0) : null,
      rows: transfers,
      unmatched_count: bankRows.length ? transfers.filter((t) => t.matched === false).length : null,
    },
    inventory: {
      value_start: valueStart,
      entries: Math.round(entries),
      returns: Math.round(returns),
      sold_cost: Math.round(Number(soldCost.v)),
      sold_movements: Math.round(Math.abs(salesMov)),
      sold_without_stock: Math.round(Number(soldWithoutStock.v)),
      writeoffs: Math.round(Math.abs(writeoffsV)),
      manual: Math.round(manual),
      value_end_calc: valueEndCalc,
      value_end_real: valueEndReal,
      difference: valueEndReal - valueEndCalc,
      movements_count: inWeek.reduce((a, r) => a + Number(r.c), 0),
    },
    carried_pending: carried,
    bank_rows: bankRows,
    bank_rows_count: bankRows.length,
    manual: { fund_counted: null, bank_balance: null },
    explanations: {},
  }
}

export function confirm(input: ReconciliationConfirmInput): WeeklyReconciliationRecord {
  const db = getDb()
  const weekStart = assertWeekStart(input.week_start)
  if (!input.data || input.data.week_start !== weekStart) {
    throw new Error('Los datos del cuadre no corresponden a la semana indicada.')
  }
  // Solo admin confirma (si hay usuarios).
  const users = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE active = 1`).get() as { c: number }
  if (Number(users.c) > 0) {
    if (!input.user_id) throw new Error('Tenés que iniciar sesión como administrador para confirmar el cuadre.')
    const u = db.prepare(`SELECT role FROM users WHERE id = ? AND active = 1`).get(input.user_id) as
      | { role: string }
      | undefined
    if (!u || u.role !== 'admin') throw new Error('Solo un administrador puede confirmar el cuadre.')
  }
  // Cada diferencia necesita explicación o marca "pendiente".
  const missing: string[] = []
  const ex = input.data.explanations ?? {}
  const check = (key: string, label: string, differs: boolean) => {
    if (!differs) return
    const e = ex[key]
    if (!e || (!e.pending && !(e.note ?? '').trim())) missing.push(label)
  }
  const d = input.data
  const fundCounted = d.manual?.fund_counted
  check('cash_fund', 'Efectivo del fondo', fundCounted != null && fundCounted !== d.cash.fund_end_calc)
  check('cash_sessions', 'Diferencias de cierres de caja', d.cash.sessions_difference !== 0)
  check('cards', 'Tarjetas vs cartola', d.cards.rows.some((r) => r.flagged))
  check('transfers', 'Transferencias no recibidas', (d.transfers.unmatched_count ?? 0) > 0)
  check('inventory', 'Inventario', d.inventory.difference !== 0)
  if (missing.length) {
    throw new Error(`Falta explicar o marcar como pendiente: ${missing.join(', ')}.`)
  }
  const dataJson = JSON.stringify({ ...d, bank_rows: (d.bank_rows ?? []).slice(0, 2000) })
  db.prepare(
    `INSERT INTO weekly_reconciliations (week_start, week_end, data_json, confirmed_at, user_id)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(week_start) DO UPDATE SET data_json = excluded.data_json,
       confirmed_at = excluded.confirmed_at, user_id = excluded.user_id`,
  ).run(weekStart, weekEnd(weekStart), dataJson, nowIso(), input.user_id ?? null)
  return get(weekStart)!
}
