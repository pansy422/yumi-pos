import { BrowserWindow } from 'electron'
import type { DetectedPrinter } from '../../shared/types'
import { listRawPrinters } from '../printer/thermal'

export async function listSystemPrinters(): Promise<DetectedPrinter[]> {
  const raw = listRawPrinters()
  if (raw.length > 0) {
    return raw.map((p) => ({
      name: p.name,
      isDefault: p.isDefault,
      status: p.status,
      port: p.port,
      driver: p.driver,
    }))
  }

  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return []
  try {
    const printers = await win.webContents.getPrintersAsync()
    return printers.map((p) => ({
      name: p.name,
      isDefault: !!p.isDefault,
      status: typeof p.status === 'number' ? String(p.status) : undefined,
    }))
  } catch {
    return []
  }
}
