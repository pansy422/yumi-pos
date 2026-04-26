import { ThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer'
import type { PrinterSettings, SaleWithItems, StoreSettings } from '../../shared/types'
import { formatReceipt, formatTestPage } from './receipt'

let driver: unknown = null

function loadDriver(): unknown {
  if (driver) return driver
  try {
    driver = require('@thiagoelg/node-printer')
  } catch (err) {
    driver = null
  }
  return driver
}

function buildPrinter(settings: PrinterSettings): ThermalPrinter {
  const isUsb = settings.connection === 'usb' || settings.interface.startsWith('printer:')
  const drv = isUsb ? loadDriver() : undefined

  if (isUsb && !drv) {
    throw new Error(
      'El driver de impresora del sistema no está disponible. Reinstala Yumi POS o usa modo Red (IP).',
    )
  }

  return new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: settings.interface,
    characterSet: CharacterSet.PC850_MULTILINGUAL,
    width: settings.width_chars > 0 ? settings.width_chars : 42,
    removeSpecialCharacters: false,
    lineCharacter: '-',
    options: { timeout: 8000 },
    driver: drv as object | undefined,
  })
}

async function ensureConnected(tp: ThermalPrinter): Promise<void> {
  let connected = false
  try {
    connected = await tp.isPrinterConnected()
  } catch {
    connected = false
  }
  if (!connected) {
    throw new Error(
      'No se pudo conectar a la impresora. Verifica que esté encendida, conectada y seleccionada en Ajustes → Impresora.',
    )
  }
}

export async function printReceipt(
  sale: SaleWithItems,
  store: StoreSettings,
  printer: PrinterSettings,
): Promise<void> {
  if (!printer.enabled) throw new Error('Impresora deshabilitada en Ajustes')
  if (!printer.interface || printer.interface.trim() === '') {
    throw new Error('Configura la impresora antes de imprimir (Ajustes → Impresora)')
  }
  const tp = buildPrinter(printer)
  await ensureConnected(tp)
  formatReceipt(tp, sale, store, printer.width_chars)
  if (printer.open_drawer_on_cash && sale.payment_method === 'efectivo') {
    tp.openCashDrawer()
  }
  tp.cut()
  await tp.execute()
}

export async function printTest(printer: PrinterSettings, store: StoreSettings): Promise<void> {
  if (!printer.enabled) throw new Error('Impresora deshabilitada en Ajustes')
  if (!printer.interface || printer.interface.trim() === '') {
    throw new Error('Configura la interfaz de la impresora antes de imprimir')
  }
  const tp = buildPrinter(printer)
  await ensureConnected(tp)
  formatTestPage(tp, store, printer.width_chars)
  tp.cut()
  await tp.execute()
}

export async function openDrawer(printer: PrinterSettings): Promise<void> {
  if (!printer.enabled) throw new Error('Impresora deshabilitada en Ajustes')
  if (!printer.interface || printer.interface.trim() === '') {
    throw new Error('Configura la impresora antes de abrir el cajón')
  }
  const tp = buildPrinter(printer)
  await ensureConnected(tp)
  tp.openCashDrawer()
  await tp.execute()
}

export type RawPrinterEntry = {
  name: string
  isDefault: boolean
  status?: string
  port?: string
  driver?: string
}

export function listRawPrinters(): RawPrinterEntry[] {
  const drv = loadDriver() as
    | { getPrinters?: () => Array<Record<string, unknown>>; getDefaultPrinterName?: () => string }
    | null
  if (!drv || typeof drv.getPrinters !== 'function') return []
  try {
    const def = typeof drv.getDefaultPrinterName === 'function' ? drv.getDefaultPrinterName() : ''
    const list = drv.getPrinters() as Array<Record<string, unknown>>
    return list.map((p) => ({
      name: String(p.name ?? ''),
      isDefault: String(p.name ?? '') === def,
      status: Array.isArray(p.status) ? (p.status as string[]).join(',') : undefined,
      port: typeof p.portName === 'string' ? p.portName : undefined,
      driver: typeof p.driverName === 'string' ? p.driverName : undefined,
    }))
  } catch {
    return []
  }
}
