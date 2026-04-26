import { getDb } from './index'
import type {
  CategoryRevenue,
  DailyReport,
  PaymentMethod,
  RangeReport,
} from '../../shared/types'

function dayBounds(date: string): { from: string; to: string } {
  return { from: `${date} 00:00:00`, to: `${date} 23:59:59.999` }
}

function topProducts(from: string, to: string) {
  const db = getDb()
  return db
    .prepare(
      `SELECT si.product_id AS product_id,
              MAX(si.name_snapshot) AS name,
              SUM(si.qty) AS qty,
              SUM(si.line_total) AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.completed_at BETWEEN ? AND ? AND s.voided = 0
       GROUP BY si.product_id
       ORDER BY qty DESC
       LIMIT 10`,
    )
    .all(from, to) as { product_id: string; name: string; qty: number; revenue: number }[]
}

function byPayment(from: string, to: string) {
  const db = getDb()
  return db
    .prepare(
      `SELECT payment_method AS method, COUNT(*) AS count, COALESCE(SUM(total),0) AS total
       FROM sales WHERE completed_at BETWEEN ? AND ? AND voided = 0
       GROUP BY payment_method`,
    )
    .all(from, to) as { method: PaymentMethod; count: number; total: number }[]
}

function byCategory(from: string, to: string): CategoryRevenue[] {
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
       WHERE s.completed_at BETWEEN ? AND ? AND s.voided = 0
       GROUP BY cat
       ORDER BY revenue DESC`,
    )
    .all(from, to) as { cat: string; sale_count: number; qty: number; revenue: number; profit: number }[]
  return rows.map((r) => ({
    name: r.cat === '__none__' ? null : r.cat,
    count: Number(r.sale_count),
    qty: Number(r.qty),
    revenue: Number(r.revenue),
    profit: Number(r.profit),
  }))
}

function totals(from: string, to: string): { sales_count: number; revenue: number; profit: number } {
  const db = getDb()
  const r = db
    .prepare(
      `SELECT COUNT(*) AS c, COALESCE(SUM(total),0) AS rev,
              COALESCE(SUM((SELECT SUM((price_snapshot - cost_snapshot) * qty) FROM sale_items WHERE sale_id = sales.id)),0) AS profit
       FROM sales WHERE completed_at BETWEEN ? AND ? AND voided = 0`,
    )
    .get(from, to) as { c: number; rev: number; profit: number }
  return { sales_count: Number(r.c), revenue: Number(r.rev), profit: Number(r.profit) }
}

export function daily(date: string): DailyReport {
  const { from, to } = dayBounds(date)
  const t = totals(from, to)
  return {
    date,
    sales_count: t.sales_count,
    revenue: t.revenue,
    profit: t.profit,
    by_payment: byPayment(from, to),
    top_products: topProducts(from, to),
    by_category: byCategory(from, to),
  }
}

export function range(fromDate: string, toDate: string): RangeReport {
  const db = getDb()
  const from = `${fromDate} 00:00:00`
  const to = `${toDate} 23:59:59.999`
  const t = totals(from, to)
  const dailyRows = db
    .prepare(
      `SELECT date(completed_at) AS d,
              COUNT(*) AS c,
              COALESCE(SUM(total),0) AS rev,
              COALESCE(SUM((SELECT SUM((price_snapshot - cost_snapshot) * qty) FROM sale_items WHERE sale_id = sales.id)),0) AS profit
       FROM sales WHERE completed_at BETWEEN ? AND ? AND voided = 0
       GROUP BY date(completed_at) ORDER BY d ASC`,
    )
    .all(from, to) as { d: string; c: number; rev: number; profit: number }[]
  return {
    from: fromDate,
    to: toDate,
    sales_count: t.sales_count,
    revenue: t.revenue,
    profit: t.profit,
    by_payment: byPayment(from, to),
    top_products: topProducts(from, to),
    by_category: byCategory(from, to),
    daily: dailyRows.map((r) => ({
      date: r.d,
      revenue: Number(r.rev),
      profit: Number(r.profit),
      count: Number(r.c),
    })),
  }
}
