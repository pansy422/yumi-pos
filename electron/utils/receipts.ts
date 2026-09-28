import { app, dialog, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Fotos de boletas de compra. Se copian a userData/boletas-compras/ para
 * que no dependan de la ubicación original (pendrive, celular montado).
 * El respaldo diario de la base NO incluye esta carpeta; son adjuntos.
 */
export function getReceiptsDir(): string {
  return path.join(app.getPath('userData'), 'boletas-compras')
}

export async function pickReceipt(): Promise<{ path: string } | null> {
  const result = await dialog.showOpenDialog({
    title: 'Foto de la boleta',
    properties: ['openFile'],
    filters: [
      { name: 'Imágenes y PDF', extensions: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'pdf'] },
    ],
  })
  if (result.canceled || !result.filePaths[0]) return null
  const src = result.filePaths[0]
  const dir = getReceiptsDir()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const safeName = path.basename(src).replace(/[^\w.\-]+/g, '_')
  const target = path.join(dir, `${stamp}-${safeName}`)
  fs.copyFileSync(src, target)
  return { path: target }
}

export async function openReceipt(filePath: string): Promise<void> {
  // Solo abrimos archivos dentro de nuestra carpeta: el path viene del
  // renderer y no queremos que sirva para abrir cualquier cosa del disco.
  const dir = getReceiptsDir()
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(dir + path.sep)) {
    throw new Error('La foto no está en la carpeta de boletas de Yumi POS.')
  }
  if (!fs.existsSync(resolved)) throw new Error('La foto ya no existe en el disco.')
  const err = await shell.openPath(resolved)
  if (err) throw new Error(err)
}
