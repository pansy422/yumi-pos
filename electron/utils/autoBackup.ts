import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { getDb } from '../db'
import * as settingsRepo from '../db/settings'

export function getAutoBackupDir(): string {
  return path.join(app.getPath('documents'), 'Yumi POS Backups')
}

function listBackupFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('yumi-pos-auto-') && f.endsWith('.db'))
    .map((f) => path.join(dir, f))
    .sort() // ISO timestamps en el nombre, orden lexicográfico = cronológico
}

function pruneOldBackups(dir: string, keep: number) {
  const files = listBackupFiles(dir)
  if (files.length <= keep) return
  const toDelete = files.slice(0, files.length - keep)
  for (const f of toDelete) {
    try {
      fs.unlinkSync(f)
    } catch {
      // ignore
    }
  }
}

/**
 * Si el backup automático está activado y han pasado >24h desde el
 * último, ejecuta uno usando db.backup() (atómico, incluye WAL).
 * Llamar al iniciar la app y después en intervalo de 6h por si alguien
 * deja la app abierta varios días.
 */
export async function maybeRunAutoBackup(): Promise<{ ran: boolean; path?: string; reason?: string }> {
  const settings = settingsRepo.getAll()
  if (!settings.backup.auto_daily) return { ran: false, reason: 'desactivado' }
  const last = settings.backup.last_run ? new Date(settings.backup.last_run).getTime() : 0
  const now = Date.now()
  if (now - last < 24 * 60 * 60 * 1000) return { ran: false, reason: 'reciente' }

  const dir = getAutoBackupDir()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const target = path.join(dir, `yumi-pos-auto-${stamp}.db`)

  try {
    await getDb().backup(target)
    settingsRepo.setPatch({ backup: { ...settings.backup, last_run: new Date().toISOString() } })
    pruneOldBackups(dir, settings.backup.keep_last)
    console.log('[autoBackup] respaldo creado:', target)
    return { ran: true, path: target }
  } catch (err) {
    console.error('[autoBackup] error:', err)
    return { ran: false, reason: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Programar revisiones cada 6h para que apps que llevan días abiertas
 * sigan generando un respaldo diario. Idempotente: si se llama dos veces
 * (p. ej. por hot-reload en dev), cancelamos el ciclo previo en lugar de
 * acumular timers en paralelo. `before-quit` también lo cancela para que
 * un cierre limpio no quede con un setInterval colgando.
 */
let initialKickoff: NodeJS.Timeout | null = null
let interval: NodeJS.Timeout | null = null

export function scheduleAutoBackup() {
  cancelAutoBackup()
  // Espera 1 minuto al iniciar para no competir con el resto del arranque.
  initialKickoff = setTimeout(() => {
    initialKickoff = null
    maybeRunAutoBackup()
  }, 60_000)
  interval = setInterval(() => {
    maybeRunAutoBackup()
  }, 6 * 60 * 60 * 1000)
  app.once('before-quit', cancelAutoBackup)
}

export function cancelAutoBackup() {
  if (initialKickoff) {
    clearTimeout(initialKickoff)
    initialKickoff = null
  }
  if (interval) {
    clearInterval(interval)
    interval = null
  }
}
