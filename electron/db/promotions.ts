import { randomUUID } from 'node:crypto'
import { getDb } from './index'
import { lineTotal } from '../../shared/money'
import type { CartItem, Promotion, PromotionInput, AppliedPromotion } from '../../shared/types'

function rowToPromo(r: Record<string, unknown> | undefined): Promotion | null {
  if (!r) return null
  let params: Promotion['params']
  try {
    params = JSON.parse(String(r.params ?? '{}')) as Promotion['params']
  } catch {
    params = {} as Promotion['params']
  }
  return {
    id: r.id as string,
    name: r.name as string,
    kind: r.kind as Promotion['kind'],
    target: (r.target as string | null) ?? null,
    params,
    active: Number(r.active ?? 1) === 1 ? 1 : 0,
    created_at: r.created_at as string,
  }
}

export function list(includeInactive = false): Promotion[] {
  const db = getDb()
  const sql = includeInactive
    ? `SELECT * FROM promotions ORDER BY created_at DESC`
    : `SELECT * FROM promotions WHERE active = 1 ORDER BY created_at DESC`
  return (db.prepare(sql).all() as Record<string, unknown>[])
    .map(rowToPromo)
    .filter((p): p is Promotion => p !== null)
}

export function save(input: PromotionInput): Promotion {
  const db = getDb()
  const name = input.name.trim()
  if (!name) throw new Error('La promoción necesita un nombre')

  if (input.id) {
    db.prepare(
      `UPDATE promotions SET name=?, kind=?, target=?, params=?, active=? WHERE id=?`,
    ).run(
      name,
      input.kind,
      input.target ?? null,
      JSON.stringify(input.params ?? {}),
      input.active ? 1 : 0,
      input.id,
    )
    return rowToPromo(
      db.prepare(`SELECT * FROM promotions WHERE id = ?`).get(input.id) as Record<
        string,
        unknown
      >,
    )!
  }
  const id = randomUUID()
  db.prepare(
    `INSERT INTO promotions (id, name, kind, target, params, active) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    name,
    input.kind,
    input.target ?? null,
    JSON.stringify(input.params ?? {}),
    input.active === false ? 0 : 1,
  )
  return rowToPromo(
    db.prepare(`SELECT * FROM promotions WHERE id = ?`).get(id) as Record<string, unknown>,
  )!
}

export function remove(id: string): void {
  const db = getDb()
  db.prepare(`DELETE FROM promotions WHERE id = ?`).run(id)
}

/**
 * Calcula los descuentos automáticos que aplican a un carrito dado los
 * promotions activos. La función NO modifica nada — solo retorna las
 * promos aplicables y el monto descontado.
 *
 * - percent_off_category: target = nombre de categoría
 *     descuento = sum(line_total of items in category) * percent / 100
 * - percent_off_product: target = product_id
 *     descuento = item.line_total * percent / 100
 * - percent_off_total: target=null, params.min_amount opcional
 *     descuento = subtotal * percent / 100 (si subtotal >= min_amount)
 *
 * Las promociones se aplican secuencialmente sobre el subtotal "intacto"
 * (no se acumulan sobre subtotales ya descontados, para evitar
 * descuentos en cadena imprevistos).
 */
export function computeForCart(items: (CartItem & { category?: string | null })[]): {
  total_discount: number
  applied: AppliedPromotion[]
} {
  if (items.length === 0) return { total_discount: 0, applied: [] }
  const promos = list(false)
  if (promos.length === 0) return { total_discount: 0, applied: [] }

  const subtotal = items.reduce((a, i) => a + lineTotal(i), 0)

  const applied: AppliedPromotion[] = []
  let total = 0

  for (const p of promos) {
    if (p.active !== 1) continue
    let discount = 0
    if (p.kind === 'percent_off_category') {
      const cat = p.target ?? ''
      const match = items.filter((i) => (i.category ?? '') === cat)
      if (match.length === 0) continue
      const sum = match.reduce((a, i) => a + lineTotal(i), 0)
      const percent = Math.max(0, Math.min(100, Number(p.params.percent ?? 0)))
      discount = Math.round((sum * percent) / 100)
    } else if (p.kind === 'percent_off_product') {
      const item = items.find((i) => i.product_id === p.target)
      if (!item) continue
      const percent = Math.max(0, Math.min(100, Number(p.params.percent ?? 0)))
      discount = Math.round((lineTotal(item) * percent) / 100)
    } else if (p.kind === 'percent_off_total') {
      const min = Number(p.params.min_amount ?? 0)
      if (subtotal < min) continue
      const percent = Math.max(0, Math.min(100, Number(p.params.percent ?? 0)))
      discount = Math.round((subtotal * percent) / 100)
    }
    if (discount <= 0) continue
    applied.push({ promo_id: p.id, name: p.name, amount: discount })
    total += discount
  }

  return { total_discount: total, applied }
}
