import { getDb } from './index'
import type {
  CategoryRevenue,
  DailyReport,
  PaymentMethod,
  RangeReport,
} from '../../shared/types'

// Todas las queries comparan fechas con date(completed_at, 'localtime')
// porque completed_at se almacena en UTC ISO y los rangos vienen de la UI
// como YYYY-MM-DD interpretados en hora local del PC.

function topProducts(fromDate: string, toDate: string) {
  const db = getDb()
  return db
    .prepare(
      `SELECT si.product_id AS product_id,
              MAX(si.name_snapshot) AS name,
              SUM(si.qty) AS qty,
              SUM(si.line_total) AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE date(s.completed_at, 'localtime') BETWEEN ? AND ? AND s.voided = 0
       GROUP BY si.product_id
       ORDER BY qty DESC
       LIMIT 10`,
    )
    .all(fromDate, toDate) as { product_id: string; name: string; qty: number; revenue: number }[]
}

function byPayment(fromDate: string, toDate: string) {
  const db = getDb()
  // Usamos sale_payments para que el desglose sea correcto en pagos
  // mixtos: una venta de $5.000 efectivo + $3.000 débito cuenta $5.000
  // en efectivo y $3.000 en débito, no $8.000 en "mixto".
  return db
    .prepare(
      `SELECT sp.method AS method,
              COUNT(*) AS count,
              COALESCE(SUM(sp.amount),0) AS total
       FROM sale_payments sp
       JOIN sales s ON s.id = sp.sale_id
       WHERE date(s.completed_at, 'localtime') BETWEEN ? AND ? AND s.voided = 0
       GROUP BY sp.method`,
    )
    .all(fromDate, toDate) as { method: PaymentMethod; count: number; total: number }[]
}

function byCategory(fromDate: string, toDate: string): CategoryRevenue[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT
         COALESCE(NULLIF(TRIM(p.category), ''), '__none__') AS cat,
         COUNT(DISTINCT s.id) AS sale_count,
         SUM(si.qty) AS qty,
         SUM(si.line_total) AS revenue,
         SUM((si.price_snapshot - si.cost_snapshot) * si.qty) AS profit
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       JOIN products p ON p.id = si.product_id
       WHERE date(s.completed_at, 'localtime') BETWEEN ? AND ? AND s.voided = 0
       GROUP BY cat
       ORDER BY revenue DESC`,
    )
    .all(fromDate, toDate) as {
    cat: string
    sale_count: number
    qty: number
    revenue: number
    profit: number
  }[]
  return rows.map((r) => ({
    name: r.cat === '__none__' ? null : r.cat,
    count: Number(r.sale_count),
    qty: Number(r.qty),
    revenue: Number(r.revenue),
    profit: Number(r.profit),
  }))
}

function totals(
  fromDate: string,
  toDate: string,
): { sales_count: number; revenue: number; profit: number } {
  const db = getDb()
  const r = db
    .prepare(
      `SELECT COUNT(*) AS c, COALESCE(SUM(total),0) AS rev,
              COALESCE(SUM((SELECT SUM((price_snapshot - cost_snapshot) * qty) FROM sale_items WHERE sale_id = sales.id)),0) AS profit
       FROM sales
       WHERE date(completed_at, 'localtime') BETWEEN ? AND ? AND voided = 0`,
    )
    .get(fromDate, toDate) as { c: number; rev: number; profit: number }
  return { sales_count: Number(r.c), revenue: Number(r.rev), profit: Number(r.profit) }
}

export function daily(date: string): DailyReport {
  const t = totals(date, date)
  return {
    date,
    sales_count: t.sales_count,
    revenue: t.revenue,
    profit: t.profit,
    by_payment: byPayment(date, date),
    top_products: topProducts(date, date),
    by_category: byCategory(date, date),
  }
}

export function range(fromDate: string, toDate: string): RangeReport {
  const db = getDb()
  const t = totals(fromDate, toDate)
  const dailyRows = db
    .prepare(
      `SELECT date(completed_at, 'localtime') AS d,
              COUNT(*) AS c,
              COALESCE(SUM(total),0) AS rev,
              COALESCE(SUM((SELECT SUM((price_snapshot - cost_snapshot) * qty) FROM sale_items WHERE sale_id = sales.id)),0) AS profit
       FROM sales
       WHERE date(completed_at, 'localtime') BETWEEN ? AND ? AND voided = 0
       GROUP BY d ORDER BY d ASC`,
    )
    .all(fromDate, toDate) as { d: string; c: number; rev: number; profit: number }[]
  return {
    from: fromDate,
    to: toDate,
    sales_count: t.sales_count,
    revenue: t.revenue,
    profit: t.profit,
    by_payment: byPayment(fromDate, toDate),
    top_products: topProducts(fromDate, toDate),
    by_category: byCategory(fromDate, toDate),
    daily: dailyRows.map((r) => ({
      date: r.d,
      revenue: Number(r.rev),
      profit: Number(r.profit),
      count: Number(r.c),
    })),
  }
}
