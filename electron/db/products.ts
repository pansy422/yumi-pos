import { randomUUID } from 'node:crypto'
import { getDb } from './index'
import type {
  Product,
  ProductInput,
  ProductPatch,
  ScanInResult,
} from '../../shared/types'

function row(r: Record<string, unknown> | undefined): Product | null {
  if (!r) return null
  return {
    id: r.id as string,
    barcode: (r.barcode as string | null) ?? null,
    name: r.name as string,
    sku: (r.sku as string | null) ?? null,
    cost: Number(r.cost),
    price: Number(r.price),
    stock: Number(r.stock),
    stock_min: Number(r.stock_min ?? 0),
    stock_max: Number(r.stock_max ?? 0),
    category: (r.category as string | null) ?? null,
    is_weight: Number(r.is_weight ?? 0) === 1 ? 1 : 0,
    archived: Number(r.archived) === 1 ? 1 : 0,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  }
}

export function list(
  q: { search?: string; includeArchived?: boolean; category?: string | null } = {},
): Product[] {
  const db = getDb()
  const where: string[] = []
  const params: Record<string, unknown> = {}
  if (!q.includeArchived) where.push('archived = 0')
  if (q.search && q.search.trim()) {
    where.push('(name LIKE @s OR barcode LIKE @s OR sku LIKE @s)')
    params.s = `%${q.search.trim()}%`
  }
  if (q.category !== undefined) {
    if (q.category === null) {
      where.push("(category IS NULL OR TRIM(category) = '')")
    } else if (q.category.trim()) {
      where.push('category = @cat')
      params.cat = q.category
    }
  }
  const sql = `SELECT * FROM products ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY name COLLATE NOCASE LIMIT 1000`
  return (db.prepare(sql).all(params) as Record<string, unknown>[])
    .map(row)
    .filter((p): p is Product => p !== null)
}

export function get(id: string): Product | null {
  const db = getDb()
  return row(db.prepare(`SELECT * FROM products WHERE id = ?`).get(id) as Record<string, unknown>)
}

export function byBarcode(barcode: string, opts: { includeArchived?: boolean } = {}): Product | null {
  const db = getDb()
  const sql = opts.includeArchived
    ? `SELECT * FROM products WHERE barcode = ?`
    : `SELECT * FROM products WHERE barcode = ? AND archived = 0`
  return row(db.prepare(sql).get(barcode) as Record<string, unknown>)
}

export function create(input: ProductInput): Product {
  const db = getDb()
  const id = randomUUID()
  if (input.barcode) {
    const exists = db.prepare(`SELECT 1 FROM products WHERE barcode = ?`).get(input.barcode)
    if (exists) throw new Error(`Ya existe un producto con el código ${input.barcode}`)
  }
  db.prepare(
    `INSERT INTO products (id, barcode, name, sku, cost, price, stock, stock_min, stock_max, category, is_weight)
     VALUES (@id, @barcode, @name, @sku, @cost, @price, @stock, @stock_min, @stock_max, @category, @is_weight)`,
  ).run({
    id,
    barcode: input.barcode ?? null,
    name: input.name.trim(),
    sku: input.sku ?? null,
    cost: Math.round(input.cost),
    price: Math.round(input.price),
    stock: Math.round(input.stock ?? 0),
    stock_min: Math.round(input.stock_min ?? 0),
    stock_max: Math.round(input.stock_max ?? 0),
    category: input.category ?? null,
    is_weight: input.is_weight === 1 ? 1 : 0,
  })
  return get(id)!
}

export function update(id: string, patch: ProductPatch): Product {
  const db = getDb()
  const current = get(id)
  if (!current) throw new Error('Producto no encontrado')
  if (patch.barcode && patch.barcode !== current.barcode) {
    const exists = db
      .prepare(`SELECT 1 FROM products WHERE barcode = ? AND id <> ?`)
      .get(patch.barcode, id)
    if (exists) throw new Error(`Ya existe un producto con el código ${patch.barcode}`)
  }
  const next = {
    barcode: patch.barcode ?? current.barcode,
    name: (patch.name ?? current.name).trim(),
    sku: patch.sku ?? current.sku,
    cost: Math.round(patch.cost ?? current.cost),
    price: Math.round(patch.price ?? current.price),
    stock: Math.round(patch.stock ?? current.stock),
    stock_min: Math.round(patch.stock_min ?? current.stock_min),
    stock_max: Math.round(patch.stock_max ?? current.stock_max),
    category: patch.category ?? current.category,
    is_weight: (patch.is_weight ?? current.is_weight) === 1 ? 1 : 0,
    archived: patch.archived ?? current.archived,
  }
  db.prepare(
    `UPDATE products SET barcode=@barcode, name=@name, sku=@sku, cost=@cost, price=@price,
     stock=@stock, stock_min=@stock_min, stock_max=@stock_max, category=@category,
     is_weight=@is_weight, archived=@archived, updated_at=datetime('now') WHERE id=@id`,
  ).run({ id, ...next })
  return get(id)!
}

export function archive(id: string, archived: boolean): void {
  const db = getDb()
  db.prepare(
    `UPDATE products SET archived = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(archived ? 1 : 0, id)
}

/**
 * Eliminación dura. Solo se permite si el producto no tiene ventas
 * asociadas (sale_items) ni promociones. Si las tiene, hay que archivar
 * para preservar la integridad histórica.
 */
export function deleteHard(id: string): void {
  const db = getDb()
  const product = get(id)
  if (!product) throw new Error('El producto no existe')
  const inSales = db
    .prepare(`SELECT 1 FROM sale_items WHERE product_id = ? LIMIT 1`)
    .get(id)
  if (inSales) {
    throw new Error(
      `"${product.name}" tiene ventas asociadas. Para mantener el historial, archívalo en vez de eliminarlo (se oculta del POS).`,
    )
  }
  const inPromos = db
    .prepare(
      `SELECT 1 FROM promotions WHERE kind = 'percent_off_product' AND target = ? LIMIT 1`,
    )
    .get(id)
  if (inPromos) {
    throw new Error(
      `"${product.name}" tiene una promoción configurada. Elimina o cambia la promoción antes de borrar el producto.`,
    )
  }
  db.prepare(`DELETE FROM products WHERE id = ?`).run(id)
}

export function adjustStock(id: string, delta: number, _note?: string): Product {
  const db = getDb()
  const tx = db.transaction(() => {
    const current = get(id)
    if (!current) throw new Error('Producto no encontrado')
    db.prepare(
      `UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(Math.round(delta), id)
  })
  tx()
  return get(id)!
}

export function scanIn(barcode: string, opts?: { newProduct?: ProductInput }): ScanInResult {
  const db = getDb()
  const code = barcode.trim()
  if (!code) throw new Error('Código vacío')
  const existing = byBarcode(code, { includeArchived: true })
  if (existing) {
    if (existing.is_weight === 1) {
      throw new Error(
        `"${existing.name}" se vende por peso. Ajusta su stock manualmente desde Inventario (en kg).`,
      )
    }
    db.prepare(
      `UPDATE products SET stock = stock + 1, archived = 0, updated_at = datetime('now') WHERE id = ?`,
    ).run(existing.id)
    return { kind: 'incremented', product: get(existing.id)! }
  }
  if (opts?.newProduct) {
    const created = create({ ...opts.newProduct, barcode: code, stock: opts.newProduct.stock ?? 1 })
    return { kind: 'created', product: created }
  }
  return { kind: 'needs_info', barcode: code }
}

export type CategoryStat = { name: string; count: number; stock: number; value: number }

/**
 * Productos que requieren reposición. Considera críticos los que tienen
 * stock <= 0 o stock < stock_min (cuando stock_min > 0).
 */
export function critical(): Product[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT * FROM products
       WHERE archived = 0 AND (
         stock <= 0
         OR (stock_min > 0 AND stock < stock_min)
       )
       ORDER BY (CASE WHEN stock <= 0 THEN 0 ELSE 1 END), name COLLATE NOCASE`,
    )
    .all() as Record<string, unknown>[]
  return rows.map(row).filter((p): p is Product => p !== null)
}

export function categories(): CategoryStat[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT category AS name,
              COUNT(*) AS count,
              COALESCE(SUM(stock), 0) AS stock,
              COALESCE(SUM(stock * cost), 0) AS value
       FROM products
       WHERE archived = 0 AND category IS NOT NULL AND TRIM(category) <> ''
       GROUP BY category
       ORDER BY count DESC, name COLLATE NOCASE`,
    )
    .all() as { name: string; count: number; stock: number; value: number }[]
  return rows.map((r) => ({
    name: r.name,
    count: Number(r.count),
    stock: Number(r.stock),
    value: Number(r.value),
  }))
}

export function renameCategory(from: string, to: string): number {
  const db = getDb()
  const target = to.trim() || null
  const result = db
    .prepare(`UPDATE products SET category = ?, updated_at = datetime('now') WHERE category = ?`)
    .run(target, from)
  return Number(result.changes)
}

export function importMany(rows: ProductInput[]): { created: number; updated: number } {
  const db = getDb()
  let created = 0
  let updated = 0
  const tx = db.transaction(() => {
    for (const r of rows) {
      const existing = r.barcode ? byBarcode(r.barcode, { includeArchived: true }) : null
      if (existing) {
        update(existing.id, r)
        updated++
      } else {
        create(r)
        created++
      }
    }
  })
  tx()
  return { created, updated }
}
