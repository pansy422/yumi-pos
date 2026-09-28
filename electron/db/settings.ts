import { getDb } from './index'
import type {
  AppFlags,
  BackupSettings,
  CashSettings,
  PrinterSettings,
  ReconciliationSettings,
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
  cash: {
    register_float: 30000,
  },
  reconciliation: {
    weekday: 1,
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
    cash: { ...DEFAULTS.cash, ...readKey<Partial<CashSettings>>('cash', {}) },
    reconciliation: {
      ...DEFAULTS.reconciliation,
      ...readKey<Partial<ReconciliationSettings>>('reconciliation', {}),
    },
    receipt_template,
  }
}

export function setPatch(patch: Partial<Settings>): Settings {
  if (patch.store) writeKey('store', { ...getAll().store, ...patch.store })
  if (patch.printer) writeKey('printer', { ...getAll().printer, ...patch.printer })
  if (patch.flags) writeKey('flags', { ...getAll().flags, ...patch.flags })
  if (patch.backup) writeKey('backup', { ...getAll().backup, ...patch.backup })
  if (patch.cash) {
    const rf = Math.round(Number(patch.cash.register_float))
    if (!Number.isFinite(rf) || rf < 0) throw new Error('El fondo fijo del cajón debe ser 0 o más.')
    writeKey('cash', { ...getAll().cash, register_float: rf })
  }
  if (patch.reconciliation) {
    const wd = Math.round(Number(patch.reconciliation.weekday))
    if (!Number.isFinite(wd) || wd < 1 || wd > 7) throw new Error('El día del cuadre debe ser 1 (lunes) a 7 (domingo).')
    writeKey('reconciliation', { ...getAll().reconciliation, weekday: wd })
  }
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
