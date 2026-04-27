import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { runMigrations } from './schema'

let db: Database.Database | null = null

export function getDbPath(): string {
  return path.join(app.getPath('userData'), 'yumi-pos.db')
}

export function initDb(): Database.Database {
  if (db) return db
  const userData = app.getPath('userData')
  if (!fs.existsSync(userData)) fs.mkdirSync(userData, { recursive: true })
  const dbPath = getDbPath()
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')
  runMigrations(db)
  reconcileSaleCounter(db)
  return db
}

/**
 * Sincroniza `sale_counter.last_number` con MAX(sales.number) al arrancar.
 * Necesario porque si se restaura un backup antiguo o se importa data de
 * otra instalación, el contador podría quedar atrasado y generarías
 * boletas con números repetidos (UNIQUE constraint te bloquearía pero el
 * mensaje al cajero sería confuso). Sumamos por las dudas, nunca bajamos.
 */
function reconcileSaleCounter(d: Database.Database): void {
  const row = d
    .prepare(
      `SELECT
         COALESCE((SELECT MAX(number) FROM sales), 0) AS max_used,
         COALESCE((SELECT last_number FROM sale_counter WHERE id = 1), 0) AS counter`,
    )
    .get() as { max_used: number; counter: number }
  const target = Math.max(row.max_used, row.counter)
  if (target > row.counter) {
    d.prepare(
      `INSERT INTO sale_counter (id, last_number) VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET last_number = excluded.last_number`,
    ).run(target)
  }
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Base de datos no inicializada')
  return db
}

export function closeDb(): void {
  if (db) {
    try {
      db.close()
    } catch {
      // ignore
    }
    db = null
  }
}
