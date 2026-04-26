import { BrowserWindow } from 'electron'
import type { DetectedPrinter } from '../../shared/types'

export async function listSystemPrinters(): Promise<DetectedPrinter[]> {
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
