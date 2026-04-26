import { randomUUID } from 'node:crypto'
import { createHash } from 'node:crypto'
import { getDb } from './index'
import type { User, UserInput, UserRole } from '../../shared/types'

/**
 * Hash del PIN — no es passwords serios, pero al menos no almacenamos
 * texto plano. SHA-256 hex con un salt fijo de la app.
 */
function hashPin(pin: string): string {
  return createHash('sha256').update('yumi-pos|' + pin).digest('hex')
}

function rowToUser(r: Record<string, unknown> | undefined): User | null {
  if (!r) return null
  return {
    id: r.id as string,
    name: r.name as string,
    role: (r.role as UserRole) ?? 'cashier',
    active: Number(r.active ?? 1) === 1 ? 1 : 0,
    created_at: r.created_at as string,
  }
}

export function list(includeInactive = false): User[] {
  const db = getDb()
  const sql = includeInactive
    ? `SELECT id, name, role, active, created_at FROM users ORDER BY name COLLATE NOCASE`
    : `SELECT id, name, role, active, created_at FROM users WHERE active = 1 ORDER BY name COLLATE NOCASE`
  return (db.prepare(sql).all() as Record<string, unknown>[])
    .map(rowToUser)
    .filter((u): u is User => u !== null)
}

export function get(id: string): User | null {
  const db = getDb()
  return rowToUser(
    db
      .prepare(`SELECT id, name, role, active, created_at FROM users WHERE id = ?`)
      .get(id) as Record<string, unknown>,
  )
}

export function save(input: UserInput): User {
  const db = getDb()
  const name = input.name.trim()
  if (!name) throw new Error('Falta el nombre del usuario')
  if (!input.id && !input.pin) throw new Error('Define un PIN para el nuevo usuario')
  if (input.pin && !/^\d{4,6}$/.test(input.pin)) {
    throw new Error('El PIN debe ser solo dígitos (4 a 6)')
  }

  if (input.id) {
    // Update sin tocar PIN salvo que se mande explícito
    if (input.pin) {
      db.prepare(
        `UPDATE users SET name=?, role=?, active=?, pin=? WHERE id=?`,
      ).run(name, input.role, input.active ? 1 : 0, hashPin(input.pin), input.id)
    } else {
      db.prepare(
        `UPDATE users SET name=?, role=?, active=? WHERE id=?`,
      ).run(name, input.role, input.active ? 1 : 0, input.id)
    }
    return get(input.id)!
  }
  const id = randomUUID()
  db.prepare(
    `INSERT INTO users (id, name, pin, role, active) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, name, hashPin(input.pin!), input.role, input.active === false ? 0 : 1)
  return get(id)!
}

export function remove(id: string): void {
  const db = getDb()
  // Soft-delete: marcar inactivo en vez de borrar (mantiene la integridad
  // referencial con sales.cashier_id).
  db.prepare(`UPDATE users SET active = 0 WHERE id = ?`).run(id)
}

export function verifyPin(userId: string, pin: string): User | null {
  const db = getDb()
  const r = db
    .prepare(`SELECT id, name, role, active, created_at, pin FROM users WHERE id = ? AND active = 1`)
    .get(userId) as Record<string, unknown> | undefined
  if (!r) return null
  if (r.pin !== hashPin(pin)) return null
  return rowToUser(r)
}

export function count(): number {
  const db = getDb()
  const r = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE active = 1`).get() as { c: number }
  return Number(r.c)
}
