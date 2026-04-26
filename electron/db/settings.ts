import { getDb } from './index'
import type { PrinterSettings, Settings, StoreSettings } from '../../shared/types'

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
    interface: 'printer:auto',
    width_chars: 32,
    auto_print: true,
    open_drawer_on_cash: true,
  },
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
  return {
    store: { ...DEFAULTS.store, ...readKey<Partial<StoreSettings>>('store', {}) },
    printer: { ...DEFAULTS.printer, ...readKey<Partial<PrinterSettings>>('printer', {}) },
  }
}

export function setPatch(patch: Partial<Settings>): Settings {
  if (patch.store) writeKey('store', { ...getAll().store, ...patch.store })
  if (patch.printer) writeKey('printer', { ...getAll().printer, ...patch.printer })
  return getAll()
}
