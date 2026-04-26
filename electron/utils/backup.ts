import { app, dialog } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { closeDb, getDb, getDbPath, initDb } from '../db'

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
