import { randomUUID } from 'node:crypto'
import { getDb } from './index'
import type { Category, CategoryInput } from '../../shared/types'

function rowToCategory(r: Record<string, unknown> | undefined): Category | null {
  if (!r) return null
  return {
    id: r.id as string,
    name: r.name as string,
    color: (r.color as string | null) ?? null,
    default_margin: r.default_margin == null ? null : Number(r.default_margin),
    created_at: r.created_at as string,
    product_count: Number(r.product_count ?? 0),
    total_stock_value: Number(r.total_stock_value ?? 0),
  }
}

/**
 * Lista las categorías de la tabla `categories` con conteo y valor de
 * stock activo. Las categorías "fantasma" (sin productos todavía) se
 * incluyen igual.
 */
export function list(): Category[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.color, c.default_margin, c.created_at,
              (
                SELECT COUNT(*) FROM products p
                WHERE p.archived = 0 AND TRIM(p.category) = c.name
              ) AS product_count,
              (
                SELECT COALESCE(SUM(
                  CASE WHEN p.is_weight = 1
                       THEN ROUND(p.cost * p.stock / 1000)
                       ELSE p.cost * p.stock
                  END
                ), 0)
                FROM products p
                WHERE p.archived = 0 AND TRIM(p.category) = c.name
              ) AS total_stock_value
       FROM categories c
       ORDER BY c.name COLLATE NOCASE`,
    )
    .all() as Record<string, unknown>[]
  return rows.map(rowToCategory).filter((c): c is Category => c !== null)
}

export function get(id: string): Category | null {
  const db = getDb()
  const r = db
    .prepare(
      `SELECT id, name, color, default_margin, created_at,
              0 AS product_count, 0 AS total_stock_value
       FROM categories WHERE id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined
  return rowToCategory(r)
}

export function getByName(name: string): Category | null {
  const db = getDb()
  const r = db
    .prepare(
      `SELECT id, name, color, default_margin, created_at,
              0 AS product_count, 0 AS total_stock_value
       FROM categories WHERE name = ? COLLATE NOCASE`,
    )
    .get(name.trim()) as Record<string, unknown> | undefined
  return rowToCategory(r)
}

/**
 * Asegura que una categoría exista en la tabla. Útil para mantener la
 * tabla sincronizada cuando un producto se crea con un nombre nuevo.
 */
export function ensureExists(name: string): void {
  const trimmed = name.trim()
  if (!trimmed) return
  const db = getDb()
  db.prepare(`INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)`).run(
    randomUUID(),
    trimmed,
  )
}

export function save(input: CategoryInput): Category {
  const db = getDb()
  const name = input.name.trim()
  if (!name) throw new Error('La categoría necesita un nombre')

  if (input.id) {
    const current = get(input.id)
    if (!current) throw new Error('Categoría no encontrada')
    // Nombre cambió → renombrar también en products
    if (current.name !== name) {
      const dup = db
        .prepare(`SELECT 1 FROM categories WHERE name = ? COLLATE NOCASE AND id <> ?`)
        .get(name, input.id)
      if (dup) throw new Error(`Ya existe una categoría con ese nombre: ${name}`)
      db.prepare(`UPDATE products SET category = ? WHERE category = ?`).run(name, current.name)
    }
    db.prepare(
      `UPDATE categories SET name = ?, color = ?, default_margin = ? WHERE id = ?`,
    ).run(name, input.color ?? null, input.default_margin ?? null, input.id)
    return get(input.id)!
  }
  const dup = db.prepare(`SELECT 1 FROM categories WHERE name = ? COLLATE NOCASE`).get(name)
  if (dup) throw new Error(`Ya existe una categoría con ese nombre: ${name}`)
  const id = randomUUID()
  db.prepare(
    `INSERT INTO categories (id, name, color, default_margin) VALUES (?, ?, ?, ?)`,
  ).run(id, name, input.color ?? null, input.default_margin ?? null)
  return get(id)!
}

/**
 * Elimina una categoría. Si tiene productos asignados, los deja sin
 * categoría (products.category = NULL). Si querés moverlos a otra,
 * pasá `reassignTo`.
 */
export function remove(id: string, opts?: { reassignTo?: string | null }): void {
  const db = getDb()
  const cat = get(id)
  if (!cat) return
  if (opts?.reassignTo !== undefined) {
    db.prepare(`UPDATE products SET category = ? WHERE category = ?`).run(
      opts.reassignTo,
      cat.name,
    )
  } else {
    db.prepare(`UPDATE products SET category = NULL WHERE category = ?`).run(cat.name)
  }
  db.prepare(`DELETE FROM categories WHERE id = ?`).run(id)
}
