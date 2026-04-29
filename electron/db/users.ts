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
    font_scale: Number(r.font_scale ?? 1),
    created_at: r.created_at as string,
  }
}

export function list(includeInactive = false): User[] {
  const db = getDb()
  const sql = includeInactive
    ? `SELECT id, name, role, active, font_scale, created_at FROM users ORDER BY name COLLATE NOCASE`
    : `SELECT id, name, role, active, font_scale, created_at FROM users WHERE active = 1 ORDER BY name COLLATE NOCASE`
  return (db.prepare(sql).all() as Record<string, unknown>[])
    .map(rowToUser)
    .filter((u): u is User => u !== null)
}

export function get(id: string): User | null {
  const db = getDb()
  return rowToUser(
    db
      .prepare(`SELECT id, name, role, active, font_scale, created_at FROM users WHERE id = ?`)
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
  const fontScale = clampScale(input.font_scale)

  if (input.id) {
    if (input.pin) {
      db.prepare(
        `UPDATE users SET name=?, role=?, active=?, font_scale=?, pin=? WHERE id=?`,
      ).run(name, input.role, input.active ? 1 : 0, fontScale, hashPin(input.pin), input.id)
    } else {
      db.prepare(
        `UPDATE users SET name=?, role=?, active=?, font_scale=? WHERE id=?`,
      ).run(name, input.role, input.active ? 1 : 0, fontScale, input.id)
    }
    return get(input.id)!
  }
  const id = randomUUID()
  db.prepare(
    `INSERT INTO users (id, name, pin, role, active, font_scale) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, name, hashPin(input.pin!), input.role, input.active === false ? 0 : 1, fontScale)
  return get(id)!
}

function clampScale(n: number | undefined): number {
  if (n == null || isNaN(n)) return 1
  return Math.max(0.85, Math.min(1.6, Number(n)))
}

/**
 * Eliminación dura del usuario. Antes hacía soft-delete porque el FK
 * sales.cashier_id bloqueaba el DELETE.
 *
 * Ahora limpiamos primero `sales.cashier_id` a NULL para los ventas
 * que ese cajero hizo, y después borramos el user. Atómico via
 * transacción. Las boletas históricas mantienen total/items/pagos —
 * solo pierden el link al cajero (que ya no existe).
 *
 * Bloqueamos solo dos casos:
 *   1) Si es el último admin activo — evita lock-out (nadie podría
 *      crear/borrar usuarios después).
 *   2) Si el usuario no existe — nada que borrar.
 *
 * Para "ocultar sin borrar" la cajera puede usar el toggle Activo en
 * el editor del usuario.
 */
export function remove(id: string): void {
  const db = getDb()
  const target = get(id)
  if (!target) return

  if (target.role === 'admin' && target.active === 1) {
    const row = db
      .prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND active = 1 AND id <> ?`)
      .get(id) as { c: number }
    if (Number(row.c) === 0) {
      throw new Error(
        'No se puede eliminar el último administrador activo. Crea otro admin primero o desactiva este en lugar de borrarlo.',
      )
    }
  }

  const tx = db.transaction(() => {
    // Limpiar el FK desde ventas antes del DELETE — el FK constraint
    // bloquearía el borrado si quedan ventas referenciando al user.
    db.prepare(`UPDATE sales SET cashier_id = NULL WHERE cashier_id = ?`).run(id)
    db.prepare(`DELETE FROM users WHERE id = ?`).run(id)
  })
  tx()
}

export function verifyPin(userId: string, pin: string): User | null {
  const db = getDb()
  const r = db
    .prepare(
      `SELECT id, name, role, active, font_scale, created_at, pin FROM users WHERE id = ? AND active = 1`,
    )
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
