import { randomUUID } from 'node:crypto'
import { getDb } from './index'
import type { CartItem, HeldTicket } from '../../shared/types'

function rowToTicket(r: Record<string, unknown>): HeldTicket {
  let items: CartItem[] = []
  try {
    const parsed = JSON.parse(r.items_json as string)
    if (Array.isArray(parsed)) items = parsed as CartItem[]
  } catch {
    // payload corrupto: devolvemos lista vacía para que la UI no se
    // caiga; el ticket se podrá descartar igual.
    items = []
  }
  return {
    id: r.id as string,
    name: r.name as string,
    discount: Number(r.discount ?? 0),
    items,
    created_at: r.created_at as string,
  }
}

export function list(): HeldTicket[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT id, name, items_json, discount, created_at
       FROM held_tickets
       ORDER BY created_at DESC
       LIMIT 100`,
    )
    .all() as Record<string, unknown>[]
  return rows.map(rowToTicket)
}

export function save(input: {
  name: string
  items: CartItem[]
  discount: number
}): HeldTicket {
  const db = getDb()
  const name = input.name.trim()
  if (!name) throw new Error('El ticket en espera necesita un nombre')
  const id = 'h_' + randomUUID().replace(/-/g, '').slice(0, 12)
  db.prepare(
    `INSERT INTO held_tickets (id, name, items_json, discount) VALUES (?, ?, ?, ?)`,
  ).run(
    id,
    name,
    JSON.stringify(input.items ?? []),
    Math.max(0, Math.round(input.discount ?? 0)),
  )
  // Mantener máximo 30 tickets, los más antiguos se descartan. 30 es
  // suficiente para un día de trabajo y evita que la tabla crezca sin
  // límite si la cajera olvida descartarlos.
  db.prepare(
    `DELETE FROM held_tickets WHERE id IN (
       SELECT id FROM held_tickets ORDER BY created_at DESC LIMIT -1 OFFSET 30
     )`,
  ).run()
  const r = db
    .prepare(
      `SELECT id, name, items_json, discount, created_at FROM held_tickets WHERE id = ?`,
    )
    .get(id) as Record<string, unknown>
  return rowToTicket(r)
}

export function remove(id: string): void {
  const db = getDb()
  db.prepare(`DELETE FROM held_tickets WHERE id = ?`).run(id)
}

export function clear(): void {
  const db = getDb()
  db.prepare(`DELETE FROM held_tickets`).run()
}
