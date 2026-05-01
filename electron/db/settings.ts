import { getDb } from './index'
import type {
  AppFlags,
  BackupSettings,
  PrinterSettings,
  Settings,
  StoreSettings,
} from '../../shared/types'
import { DEFAULT_TEMPLATE, isValidTemplate, type ReceiptTemplate } from '../../shared/template'

const DEFAULTS: Settings = {
  store: {
    name: 'Minimarket Entre Palmas',
    address: '',
    rut: '',
    phone: '',
    // El bloque "¡GRACIAS POR TU COMPRA!" ya viene en la plantilla por
    // defecto (b_thanks), así que el footer arranca vacío para no
    // duplicar el agradecimiento. Si la cajera quiere agregar un mensaje
    // extra (horario, redes, slogan), lo edita desde Ajustes → Boleta.
    receipt_footer: '',
    tax_rate: 19,
    tax_inclusive: true,
  },
  printer: {
    enabled: false,
    connection: 'usb',
    interface: '',
    width_chars: 42,
    auto_print: true,
    open_drawer_on_cash: true,
    extra_copy: false,
  },
  flags: {
    onboarded: false,
    theme: 'light',
  },
  backup: {
    auto_daily: true,
    last_run: null,
    keep_last: 30,
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
    backup: { ...DEFAULTS.backup, ...readKey<Partial<BackupSettings>>('backup', {}) },
    receipt_template,
  }
}

export function setPatch(patch: Partial<Settings>): Settings {
  if (patch.store) writeKey('store', { ...getAll().store, ...patch.store })
  if (patch.printer) writeKey('printer', { ...getAll().printer, ...patch.printer })
  if (patch.flags) writeKey('flags', { ...getAll().flags, ...patch.flags })
  if (patch.backup) writeKey('backup', { ...getAll().backup, ...patch.backup })
  if (patch.receipt_template) {
    if (!isValidTemplate(patch.receipt_template)) {
      throw new Error('Plantilla de boleta inválida')
    }
    // Defensa contra plantilla vacía: si la cajera borra todos los
    // bloques desde el editor, la boleta saldría en blanco. Mejor
    // rechazarlo explícitamente y dejarla volver a Estándar.
    if (patch.receipt_template.blocks.length === 0) {
      throw new Error(
        'La plantilla necesita al menos un bloque. Reset a "Estándar" si te equivocaste.',
      )
    }
    writeKey('receipt_template', patch.receipt_template)
  }
  return getAll()
}
