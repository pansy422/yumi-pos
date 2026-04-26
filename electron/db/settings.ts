import { getDb } from './index'
import type { AppFlags, PrinterSettings, Settings, StoreSettings } from '../../shared/types'
import { DEFAULT_TEMPLATE, isValidTemplate, type ReceiptTemplate } from '../../shared/template'

const DEFAULTS: Settings = {
  store: {
    name: 'Mi Minimarket',
    address: '',
    rut: '',
    phone: '',
    receipt_footer: '¡Gracias por tu compra!',
  },
  printer: {
    enabled: false,
    connection: 'usb',
    interface: '',
    width_chars: 42,
    auto_print: true,
    open_drawer_on_cash: true,
  },
  flags: {
    onboarded: false,
  },
  receipt_template: DEFAULT_TEMPLATE,
}

function readKey<T>(key: string, fallback: T): T {
  const db = getDb()
  const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as
    | { value: string }
    | undefined
  if (!row) return fallback
  try {
    return JSON.parse(row.value) as T
  } catch {
    return fallback
  }
}

function writeKey(key: string, value: unknown) {
  const db = getDb()
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, JSON.stringify(value))
}

export function getAll(): Settings {
  const tplRaw = readKey<unknown>('receipt_template', null)
  const receipt_template: ReceiptTemplate = isValidTemplate(tplRaw) ? tplRaw : DEFAULT_TEMPLATE
  return {
    store: { ...DEFAULTS.store, ...readKey<Partial<StoreSettings>>('store', {}) },
    printer: { ...DEFAULTS.printer, ...readKey<Partial<PrinterSettings>>('printer', {}) },
    flags: { ...DEFAULTS.flags, ...readKey<Partial<AppFlags>>('flags', {}) },
    receipt_template,
  }
}

export function setPatch(patch: Partial<Settings>): Settings {
  if (patch.store) writeKey('store', { ...getAll().store, ...patch.store })
  if (patch.printer) writeKey('printer', { ...getAll().printer, ...patch.printer })
  if (patch.flags) writeKey('flags', { ...getAll().flags, ...patch.flags })
  if (patch.receipt_template) {
    if (!isValidTemplate(patch.receipt_template)) {
      throw new Error('Plantilla de boleta inválida')
    }
    writeKey('receipt_template', patch.receipt_template)
  }
  return getAll()
}
