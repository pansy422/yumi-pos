import { ThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer'
import type { PrinterSettings, SaleWithItems, StoreSettings } from '../../shared/types'
import { formatReceipt, formatTestPage } from './receipt'

function buildPrinter(settings: PrinterSettings): ThermalPrinter {
  return new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: settings.interface,
    characterSet: CharacterSet.PC850_MULTILINGUAL,
    width: settings.width_chars > 0 ? settings.width_chars : 32,
    removeSpecialCharacters: false,
    options: { timeout: 5000 },
  })
}

export async function printReceipt(
  sale: SaleWithItems,
  store: StoreSettings,
  printer: PrinterSettings,
): Promise<void> {
  if (!printer.enabled) throw new Error('Impresora deshabilitada en Ajustes')
  const tp = buildPrinter(printer)
  const connected = await tp.isPrinterConnected()
  if (!connected) throw new Error('No se pudo conectar a la impresora')
  formatReceipt(tp, sale, store, printer.width_chars)
  if (printer.open_drawer_on_cash && sale.payment_method === 'efectivo') {
    tp.openCashDrawer()
  }
  tp.cut()
  await tp.execute()
}

export async function printTest(printer: PrinterSettings, store: StoreSettings): Promise<void> {
  if (!printer.enabled) throw new Error('Impresora deshabilitada en Ajustes')
  const tp = buildPrinter(printer)
  const connected = await tp.isPrinterConnected()
  if (!connected) throw new Error('No se pudo conectar a la impresora')
  formatTestPage(tp, store, printer.width_chars)
  tp.cut()
  await tp.execute()
}

export async function openDrawer(printer: PrinterSettings): Promise<void> {
  if (!printer.enabled) throw new Error('Impresora deshabilitada en Ajustes')
  const tp = buildPrinter(printer)
  const connected = await tp.isPrinterConnected()
  if (!connected) throw new Error('No se pudo conectar a la impresora')
  tp.openCashDrawer()
  await tp.execute()
}
