import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { DB_TARGET_VERSION, getDbVersion, runMigrations } from './schema'

let db: Database.Database | null = null

export function getDbPath(): string {
  return path.join(app.getPath('userData'), 'yumi-pos.db')
}

/** Misma carpeta que los respaldos diarios (Documentos/Yumi POS Backups). */
export function getBackupDir(): string {
  return path.join(app.getPath('documents'), 'Yumi POS Backups')
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
  backupBeforeMigration(db)
  runMigrations(db)
  reconcileSaleCounter(db)
  return db
}

/**
 * Respaldo automático ANTES de cada migración de esquema. Si la base ya
 * tiene datos (versión > 0) y este build trae una versión más nueva,
 * dejamos una copia autocontenida en la carpeta de respaldos con el
 * nombre `yumi-pos-pre-migracion-v{N}-{fecha}.db`. Usa `VACUUM INTO`,
 * que es sincrónico y hace checkpoint del WAL, así que el archivo se
 * puede abrir tal cual. Estos archivos no entran en la poda de los 30
 * respaldos diarios (prefijo distinto).
 *
 * Si el respaldo falla, NO migramos: preferimos que la app no arranque a
 * cambiar el esquema sin red de seguridad. El diálogo de arranque muestra
 * el motivo y la ruta de la base.
 */
function backupBeforeMigration(d: Database.Database): void {
  const current = getDbVersion(d)
  if (current === 0 || current >= DB_TARGET_VERSION) return
  const dir = getBackupDir()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const target = path.join(dir, `yumi-pos-pre-migracion-v${current}-${stamp}.db`)
  try {
    d.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`)
    console.log('[db] respaldo pre-migración creado:', target)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(
      `No se pudo respaldar la base antes de actualizarla (v${current} → v${DB_TARGET_VERSION}): ${msg}. Libera espacio o revisa permisos en ${dir} y vuelve a abrir la app.`,
    )
  }
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
