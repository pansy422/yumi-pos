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
  return db
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
