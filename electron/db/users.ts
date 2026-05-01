import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { getDb } from './index'
import type { User, UserInput, UserRole } from '../../shared/types'

/**
 * Formato de hash del PIN: `scrypt$N$r$p$saltHex$hashHex`.
 * Sal por usuario + KDF lento (scrypt) — un PIN de 4-6 dígitos sigue
 * siendo poco entrópico, pero ahora cada intento cuesta caro y el
 * atacante no puede precomputar una rainbow table contra la sal fija.
 *
 * El formato legacy `sha256(yumi-pos|pin)` (string hex 64 chars sin $)
 * se sigue verificando para no invalidar PINs existentes; en el primer
 * login exitoso lo re-hasheamos al nuevo formato (ver verifyPin).
 */
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const SCRYPT_KEYLEN = 32

function hashPin(pin: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(pin, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P })
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${hash.toString('hex')}`
}

function verifyPinHash(pin: string, stored: string): boolean {
  if (stored.startsWith('scrypt$')) {
    const parts = stored.split('$')
    if (parts.length !== 6) return false
    const [, nStr, rStr, pStr, saltHex, hashHex] = parts
    const salt = Buffer.from(saltHex, 'hex')
    const expected = Buffer.from(hashHex, 'hex')
    if (expected.length === 0) return false
    const actual = scryptSync(pin, salt, expected.length, {
      N: Number(nStr),
      r: Number(rStr),
      p: Number(pStr),
    })
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  }
  const legacy = createHash('sha256').update('yumi-pos|' + pin).digest('hex')
  return stored.length === legacy.length && stored === legacy
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
    // Bloqueamos los 2 caminos que dejarían al sistema sin admin activo:
    //   - cambiar role 'admin' -> 'cashier' al último admin
    //   - desactivar al último admin
    // Sin esto, el admin se "auto-bloquea" y nadie puede crear/borrar
    // usuarios después (mismo riesgo que cubre remove() para borrado).
    const target = get(input.id)
    if (target?.role === 'admin' && target.active === 1) {
      const losingAdmin =
        (input.role !== undefined && input.role !== 'admin') ||
        input.active === false
      if (losingAdmin) {
        const row = db
          .prepare(
            `SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND active = 1 AND id <> ?`,
          )
          .get(input.id) as { c: number }
        if (Number(row.c) === 0) {
          throw new Error(
            'No puedes cambiar tu rol o desactivarte: serías el último administrador. Crea otro admin primero.',
          )
        }
      }
    }
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
    // Limpiar todos los FKs hacia este user antes del DELETE — el FK
    // constraint bloquearía el borrado si quedan referencias.
    db.prepare(`UPDATE sales SET cashier_id = NULL WHERE cashier_id = ?`).run(id)
    db.prepare(`UPDATE cash_sessions SET opened_by_id = NULL WHERE opened_by_id = ?`).run(id)
    db.prepare(`UPDATE cash_sessions SET closed_by_id = NULL WHERE closed_by_id = ?`).run(id)
    db.prepare(`UPDATE cash_movements SET cashier_id = NULL WHERE cashier_id = ?`).run(id)
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
  const stored = String(r.pin ?? '')
  if (!verifyPinHash(pin, stored)) return null
  // Auto-upgrade del hash legacy (sha256 con sal fija) al formato scrypt
  // en el primer login exitoso. Idempotente: si ya está en scrypt$ no toca.
  if (!stored.startsWith('scrypt$')) {
    db.prepare(`UPDATE users SET pin = ? WHERE id = ?`).run(hashPin(pin), userId)
  }
  return rowToUser(r)
}

export function count(): number {
  const db = getDb()
  const r = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE active = 1`).get() as { c: number }
  return Number(r.c)
}
