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

/**
 * Costo total de una línea de venta. Para productos al peso (is_weight=1)
 * la qty está en gramos y cost_snapshot es por kg, así que dividimos por
 * 1000. Para productos por unidad es cost*qty directo. Sin esta corrección
 * los reportes de ganancia mostraban valores absurdos (ej. 250g de tomate
 * a $1.500/kg salía como $375.000 de costo en vez de $375).
 */
const COST_LINE_SQL = `(CASE WHEN is_weight = 1
                              THEN ROUND(cost_snapshot * qty / 1000.0)
                              ELSE cost_snapshot * qty
                         END)`

function topProducts(fromDate: string, toDate: string) {
  const db = getDb()
  // Agrupamos por (product_id, name_snapshot) para que productos
  // borrados (product_id NULL) no se colapsen todos en una sola fila
  // confusa: cada producto borrado aparece con su nombre histórico.
  return db
    .prepare(
      `SELECT si.product_id AS product_id,
              si.name_snapshot AS name,
              SUM(si.qty) AS qty,
              SUM(si.line_total) AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE date(s.completed_at, 'localtime') BETWEEN ? AND ? AND s.voided = 0
       GROUP BY si.product_id, si.name_snapshot
       ORDER BY qty DESC
       LIMIT 10`,
    )
    .all(fromDate, toDate) as {
    product_id: string | null
    name: string
    qty: number
    revenue: number
  }[]
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
  // LEFT JOIN para que las ventas de productos borrados también cuenten.
  // Caen en la categoría "Sin categoría" (__none__) — están en el
  // histórico pero ya no podemos saber a qué categoría pertenecían.
  const rows = db
    .prepare(
      `SELECT
         COALESCE(NULLIF(TRIM(p.category), ''), '__none__') AS cat,
         COUNT(DISTINCT s.id) AS sale_count,
         SUM(si.qty) AS qty,
         SUM(si.line_total) AS revenue,
         SUM(si.line_total - (CASE WHEN si.is_weight = 1
                                   THEN ROUND(si.cost_snapshot * si.qty / 1000.0)
                                   ELSE si.cost_snapshot * si.qty END)) AS profit
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN products p ON p.id = si.product_id
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
              COALESCE(SUM((SELECT SUM(line_total - ${COST_LINE_SQL}) FROM sale_items WHERE sale_id = sales.id)),0) AS profit
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
              COALESCE(SUM((SELECT SUM(line_total - ${COST_LINE_SQL}) FROM sale_items WHERE sale_id = sales.id)),0) AS profit
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
