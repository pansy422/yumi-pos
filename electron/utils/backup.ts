import { app, dialog } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { closeDb, getDb, getDbPath, initDb } from '../db'

/**
 * Antes de sobrescribir la DB en uso con un archivo elegido por la cajera,
 * lo abrimos en modo readonly y verificamos que tenga las tablas mínimas
 * de Yumi POS. Si la cajera eligió por error otro .db (de otra app, una
 * descarga corrupta, etc.) abortamos y dejamos la base actual intacta.
 */
function validateBackupFile(filePath: string): { ok: true } | { ok: false; reason: string } {
  if (!fs.existsSync(filePath)) {
    return { ok: false, reason: 'El archivo no existe.' }
  }
  const stat = fs.statSync(filePath)
  if (stat.size < 1024) {
    return { ok: false, reason: 'El archivo está vacío o es demasiado chico para ser un respaldo.' }
  }
  let probe: Database.Database | null = null
  try {
    probe = new Database(filePath, { readonly: true, fileMustExist: true })
    const row = probe
      .prepare(
        `SELECT COUNT(*) AS c FROM sqlite_master
         WHERE type = 'table' AND name IN ('sales','products','cash_sessions')`,
      )
      .get() as { c: number }
    if (Number(row.c) < 3) {
      return {
        ok: false,
        reason: 'El archivo no parece un respaldo válido de Yumi POS (faltan tablas).',
      }
    }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, reason: `No se pudo abrir el archivo como base SQLite (${msg}).` }
  } finally {
    try {
      probe?.close()
    } catch {
      // ignore
    }
  }
}

export async function exportBackup(): Promise<{ path: string } | null> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const defaultName = `yumi-pos-backup-${stamp}.db`
  const result = await dialog.showSaveDialog({
    title: 'Guardar respaldo',
    defaultPath: path.join(app.getPath('documents'), defaultName),
    filters: [{ name: 'SQLite DB', extensions: ['db'] }],
  })
  if (result.canceled || !result.filePath) return null

  // Usamos el backup nativo de SQLite: hace un checkpoint del WAL y copia
  // la base completa de forma atómica, sin tener que copiar -wal/-shm.
  // El archivo resultante es una DB autocontenida.
  const db = getDb()
  await db.backup(result.filePath)
  return { path: result.filePath }
}

export async function importBackup(): Promise<{ path: string } | null> {
  const result = await dialog.showOpenDialog({
    title: 'Restaurar respaldo',
    properties: ['openFile'],
    filters: [{ name: 'SQLite DB', extensions: ['db'] }],
  })
  if (result.canceled || !result.filePaths[0]) return null

  const check = validateBackupFile(result.filePaths[0])
  if (!check.ok) {
    await dialog.showMessageBox({
      type: 'error',
      title: 'Respaldo inválido',
      message: 'No se puede restaurar este archivo.',
      detail: check.reason,
    })
    return null
  }

  const confirm = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Cancelar', 'Restaurar y reiniciar'],
    defaultId: 0,
    cancelId: 0,
    title: 'Restaurar respaldo',
    message: 'Esto reemplazará tu base de datos actual.',
    detail:
      'Se hará una copia de seguridad de la base actual antes de reemplazarla. La aplicación se reiniciará al terminar.',
  })
  if (confirm.response !== 1) return null

  const target = getDbPath()
  closeDb()
  if (fs.existsSync(target)) {
    fs.copyFileSync(target, target + '.bak-' + Date.now())
  }
  // También limpiamos los sidecars del WAL para evitar mezclar el WAL viejo
  // con la base nueva.
  for (const ext of ['-wal', '-shm']) {
    const sidecar = target + ext
    if (fs.existsSync(sidecar)) {
      try {
        fs.unlinkSync(sidecar)
      } catch {
        // ignore
      }
    }
  }
  fs.copyFileSync(result.filePaths[0], target)
  initDb()
  app.relaunch()
  app.exit(0)
  return { path: result.filePaths[0] }
}
