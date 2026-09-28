#!/usr/bin/env node
/**
 * Smoke test del flujo crítico, corriendo el MISMO código compilado del
 * proceso main (dist-electron/) contra una base temporal.
 *
 * Reemplaza al test anterior, que copiaba a mano el esquema y el SQL: si
 * un repo cambiaba, el test seguía verde. Acá se stubbea el módulo
 * `electron` (app.getPath → carpeta temporal) y se importan los repos
 * reales, así que las migraciones, el historial de stock, la caja, el
 * fondo, las compras y las mermas se prueban tal cual corren en la app.
 *
 * Corre con:
 *   npm run test:smoke          (compila electron/ y ejecuta)
 *   node scripts/smoke-test.cjs (si dist-electron ya está compilado)
 */

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')

const ANSI = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
}

let pass = 0
let fail = 0

function assert(cond, label, detail) {
  if (cond) {
    console.log(`${ANSI.green}  ✓${ANSI.reset} ${label}`)
    pass++
  } else {
    console.log(`${ANSI.red}  ✗${ANSI.reset} ${label}`)
    if (detail !== undefined) console.log(`     ${ANSI.dim}${detail}${ANSI.reset}`)
    fail++
  }
}

function throwsWith(fn, pattern, label) {
  try {
    fn()
    assert(false, label, 'no lanzó error')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    assert(pattern.test(msg), label, msg)
  }
}

function step(label) {
  console.log(`\n${ANSI.cyan}▶${ANSI.reset} ${label}`)
}

// ── Stub de electron ────────────────────────────────────────────────────
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yumi-smoke-'))
const userData = path.join(tmpRoot, 'userData')
const documents = path.join(tmpRoot, 'Documents')
fs.mkdirSync(userData, { recursive: true })
fs.mkdirSync(documents, { recursive: true })

const electronStub = {
  app: {
    getPath: (name) => (name === 'documents' ? documents : userData),
    getVersion: () => '0.0.0-smoke',
    isPackaged: false,
    isReady: () => true,
    on: () => undefined,
    once: () => undefined,
  },
  dialog: {},
  ipcMain: { handle: () => undefined, on: () => undefined },
  shell: {},
}
const originalLoad = Module._load
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'electron') return electronStub
  return originalLoad.call(this, request, parent, isMain)
}

const dist = path.join(__dirname, '..', 'dist-electron', 'electron', 'db')
if (!fs.existsSync(path.join(dist, 'index.js'))) {
  console.error(
    `${ANSI.red}No existe dist-electron/. Ejecuta "npm run build:electron" primero (o "npm run test:smoke").${ANSI.reset}`,
  )
  process.exit(1)
}
const Database = require('better-sqlite3')
const schema = require(path.join(dist, 'schema.js'))
const dbmod = require(path.join(dist, 'index.js'))
const products = require(path.join(dist, 'products.js'))
const sales = require(path.join(dist, 'sales.js'))
const cash = require(path.join(dist, 'cashSessions.js'))
const stock = require(path.join(dist, 'stock.js'))
const users = require(path.join(dist, 'users.js'))
const settings = require(path.join(dist, 'settings.js'))
const fund = fs.existsSync(path.join(dist, 'cashFund.js')) ? require(path.join(dist, 'cashFund.js')) : null
const purchases = fs.existsSync(path.join(dist, 'purchases.js')) ? require(path.join(dist, 'purchases.js')) : null
const writeoffs = fs.existsSync(path.join(dist, 'writeoffs.js')) ? require(path.join(dist, 'writeoffs.js')) : null
const reconciliation = fs.existsSync(path.join(dist, 'reconciliation.js'))
  ? require(path.join(dist, 'reconciliation.js'))
  : null

function main() {
  // ── 1. Base en versión 9 con fechas en formato viejo ─────────────────
  step('Migración v9 → v10: fechas ISO, tablas nuevas y respaldo previo')
  const dbPath = dbmod.getDbPath()
  {
    const old = new Database(dbPath)
    old.pragma('journal_mode = WAL')
    schema.runMigrations(old, 9)
    assert(schema.getDbVersion(old) === 9, 'base construida en db_version 9')
    old.prepare(
      `INSERT INTO products (id, name, cost, price, stock, created_at, updated_at)
       VALUES ('p-old', 'Producto viejo', 100, 200, 4, datetime('now'), datetime('now'))`,
    ).run()
    old.prepare(
      `INSERT INTO cash_sessions (id, opened_at, closed_at, opening_amount)
       VALUES ('cs-old', datetime('now','-1 day'), datetime('now','-1 day','+8 hours'), 0)`,
    ).run()
    old.close()
  }
  const db = dbmod.initDb()
  assert(schema.getDbVersion(db) === schema.DB_TARGET_VERSION, `db_version = ${schema.DB_TARGET_VERSION}`)
  const backups = fs.readdirSync(path.join(documents, 'Yumi POS Backups'))
  assert(
    backups.some((f) => f.startsWith('yumi-pos-pre-migracion-v9-') && f.endsWith('.db')),
    'respaldo pre-migración creado en Documentos/Yumi POS Backups',
    backups.join(', '),
  )
  const oldProduct = db.prepare(`SELECT created_at, updated_at FROM products WHERE id = 'p-old'`).get()
  assert(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(oldProduct.created_at),
    'products.created_at normalizado a ISO con T y Z',
    oldProduct.created_at,
  )
  const oldSession = db.prepare(`SELECT opened_at, closed_at FROM cash_sessions WHERE id = 'cs-old'`).get()
  assert(oldSession.opened_at.includes('T') && oldSession.closed_at.endsWith('Z'), 'cash_sessions normalizadas')
  for (const t of ['purchases', 'stock_writeoffs', 'cash_fund_movements', 'stock_movements', 'weekly_reconciliations']) {
    const r = db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`).get(t)
    assert(!!r, `tabla ${t} existe`)
  }
  const cols = db.prepare(`PRAGMA table_info(cash_movements)`).all().map((c) => c.name)
  assert(cols.includes('reason') && cols.includes('counterparty'), 'cash_movements tiene reason y counterparty')
  const scols = db.prepare(`PRAGMA table_info(cash_sessions)`).all().map((c) => c.name)
  assert(scols.includes('register_float'), 'cash_sessions tiene register_float')

  // ── 2. Usuarios ──────────────────────────────────────────────────────
  step('Usuarios: admin y cajero')
  const admin = users.save({ name: 'Dueño', pin: '1234', role: 'admin', active: true })
  const cashier = users.save({ name: 'Cajera', pin: '5678', role: 'cashier', active: true })
  assert(users.count() === 2, 'dos usuarios activos')

  // ── 3. Producto + historial ──────────────────────────────────────────
  step('Producto: alta con stock, cambio manual con motivo, borrado bloqueado')
  const p = products.create(
    { barcode: '7802500037059', name: 'Salsa de tomate', cost: 850, price: 990, stock: 5, category: 'Abarrotes' },
    { user_id: admin.id },
  )
  assert(p.stock === 5, 'producto creado con stock 5')
  let hist = stock.forProduct(p.id)
  assert(hist.length === 1 && hist[0].kind === 'entry' && hist[0].qty === 5 && hist[0].stock_after === 5, 'alta registrada como entry +5')
  throwsWith(
    () => products.update(p.id, { stock: 8 }),
    /motivo/i,
    'cambiar stock desde la ficha sin motivo se rechaza',
  )
  const p2 = products.update(p.id, { stock: 8, stock_reason: 'Conteo físico' }, { user_id: admin.id })
  assert(p2.stock === 8, 'stock manual con motivo → 8')
  hist = stock.forProduct(p.id)
  assert(hist[0].kind === 'manual' && hist[0].qty === 3 && hist[0].reason === 'Conteo físico', 'movimiento manual +3 con motivo')
  throwsWith(() => products.deleteHard(p.id), /stock/i, 'no se puede eliminar con stock ≠ 0')
  const st = products.stats()
  assert(st.active === 2 && st.stock_value === 8 * 850 + 4 * 100, 'stats: activos y valor a costo sobre toda la tabla', JSON.stringify(st))
  const pg = products.page({ status: 'active', offset: 0, limit: 1 })
  assert(pg.total === 2 && pg.items.length === 1, 'page: total real con bloque de 1')

  // ── 4. Caja + venta ──────────────────────────────────────────────────
  step('Caja abierta y venta en efectivo')
  const session = cash.open(10000, undefined, cashier.id)
  assert(!!session && session.opening_amount === 10000, 'sesión abierta con $10.000')
  const sale = sales.create({
    items: [{ product_id: p.id, qty: 2, price: 990 }],
    discount: 0,
    payments: [{ method: 'efectivo', amount: 1980, cash_received: 2000 }],
    cashier_id: cashier.id,
  })
  assert(sale.total === 1980 && sale.items.length === 1, 'venta creada por $1.980')
  assert(products.get(p.id).stock === 6, 'stock 8 → 6')
  hist = stock.forProduct(p.id)
  assert(hist[0].kind === 'sale' && hist[0].qty === -2 && hist[0].stock_after === 6 && hist[0].ref_id === sale.id, 'movimiento sale −2 ligado a la venta')
  const sum = cash.summary(session.id)
  assert(sum.cash_sales === 1980 && sum.expected === 11980, 'esperado en caja = 10.000 + 1.980')

  step('Venta sin stock suficiente: NO se bloquea, historial en negativo')
  const over = sales.create({
    items: [{ product_id: p.id, qty: 10, price: 990 }],
    discount: 0,
    payments: [{ method: 'debito', amount: 9900 }],
    cashier_id: cashier.id,
  })
  assert(over.total === 9900, 'venta de 10 con stock 6 se acepta')
  assert(products.get(p.id).stock === 0, 'products.stock queda en 0')
  hist = stock.forProduct(p.id)
  assert(hist[0].stock_after === -4, 'stock_after −4 en el historial')

  step('Anular venta restaura stock vía historial')
  sales.voidSale(over.id, 'prueba')
  assert(products.get(p.id).stock === 10, 'stock restaurado (+10)')
  hist = stock.forProduct(p.id)
  assert(hist[0].kind === 'return' && hist[0].qty === 10, 'movimiento return +10')

  // ── 5. Retiro con motivo y destinatario ──────────────────────────────
  step('Retiros de caja exigen motivo y destinatario')
  throwsWith(
    () => cash.move('withdraw', 5000, '', cashier.id),
    /motivo|destinatario/i,
    'retiro sin motivo se rechaza',
  )
  const wd = cash.move('withdraw', 5000, 'Pan', cashier.id, { counterparty: 'Panadería' })
  assert(wd.amount === 5000 && wd.reason === 'Pan' && wd.counterparty === 'Panadería', 'retiro con motivo y destinatario')

  // ── 6. Fondo de efectivo ─────────────────────────────────────────────
  if (fund) {
    step('Fondo de efectivo')
    const seed = fund.add({ kind: 'adjustment', amount: 50000, reason: 'Saldo inicial', user_id: admin.id })
    assert(seed.amount === 50000 && fund.balance() === 50000, 'saldo inicial $50.000')
    throwsWith(() => fund.add({ kind: 'out_owner', amount: -1000, reason: '', user_id: admin.id }), /motivo/i, 'salida sin motivo se rechaza')
    const out = fund.add({ kind: 'out_expense', amount: -12000, reason: 'Gas', user_id: admin.id })
    assert(out.amount === -12000 && fund.balance() === 38000, 'gasto baja el fondo a $38.000')
    const cnt = fund.count(40000, admin.id)
    assert(cnt.difference === 2000 && fund.balance() === 40000, 'conteo del fondo registra ajuste +2.000')
  }

  // ── 7. Compras ───────────────────────────────────────────────────────
  if (purchases && fund) {
    step('Compras: pago en efectivo genera salida del fondo')
    const before = fund.balance()
    const pu = purchases.create({
      purchased_at: '2026-09-28',
      supplier: 'Coca-Cola',
      amount: 25000,
      payment_method: 'efectivo',
      note: 'bebidas',
      user_id: admin.id,
    })
    assert(pu.id > 0 && pu.supplier === 'Coca-Cola', 'compra registrada')
    assert(fund.balance() === before - 25000, 'fondo bajó $25.000')
    const linked = db.prepare(`SELECT * FROM cash_fund_movements WHERE purchase_id = ?`).get(pu.id)
    assert(linked && linked.kind === 'out_supplier' && linked.amount === -25000, 'salida ligada a la compra')
    const tr = purchases.create({
      purchased_at: '2026-09-28',
      supplier: 'Soprole',
      amount: 18000,
      payment_method: 'transferencia',
      user_id: admin.id,
    })
    assert(fund.balance() === before - 25000, 'transferencia no toca el fondo')
    const month = purchases.listMonth({ month: '2026-09' })
    assert(month.total === 43000 && month.by_supplier.length === 2, 'total del mes y por proveedor', JSON.stringify(month))
    purchases.remove(pu.id)
    assert(fund.balance() === before, 'borrar la compra revierte la salida del fondo')
    assert(purchases.suppliers().includes('Soprole'), 'autocompletar de proveedores')
    void tr
  }

  // ── 8. Mermas ────────────────────────────────────────────────────────
  if (writeoffs) {
    step('Vencidos y mermas')
    const w = writeoffs.create({ product_id: p.id, qty: 3, reason: 'vencido', note: 'lote viejo', user_id: admin.id })
    assert(w.qty === 3 && w.cost_snapshot === 850, 'merma registrada con costo del momento')
    assert(products.get(p.id).stock === 7, 'stock 10 → 7')
    hist = stock.forProduct(p.id)
    assert(hist[0].kind === 'writeoff' && hist[0].qty === -3, 'movimiento writeoff −3')
    throwsWith(() => writeoffs.create({ product_id: p.id, qty: 50, reason: 'robo', user_id: admin.id }), /solo hay/i, 'merma mayor al stock se rechaza')
    const rep = writeoffs.report({ month: new Date().toISOString().slice(0, 7) })
    assert(rep.total_cost === 2550 && rep.by_reason[0].reason === 'vencido', 'reporte mensual a costo', JSON.stringify(rep))
  }

  // ── 9. Cierre bloqueado ──────────────────────────────────────────────
  step('Cierre de caja: contado, queda en cajón, destinos y diferencia')
  const expected = cash.summary(session.id).expected
  throwsWith(
    () =>
      cash.close({
        counted: expected,
        register_float: 30000,
        destinations: [],
        cashier_id: cashier.id,
      }),
    /queda en cajón|contado/i,
    'fondo fijo mayor al contado se rechaza',
  )
  throwsWith(
    () =>
      cash.close({
        counted: expected,
        register_float: 2000,
        destinations: [{ kind: 'fondo', amount: 1000 }],
        cashier_id: cashier.id,
      }),
    /destinos/i,
    'destinos que no suman contado − queda se rechazan',
  )
  throwsWith(
    () =>
      cash.close({
        counted: expected - 500,
        register_float: 2000,
        destinations: [{ kind: 'fondo', amount: expected - 2500 }],
        cashier_id: cashier.id,
      }),
    /diferencia/i,
    'diferencia sin explicación se rechaza',
  )
  const fundBefore = fund ? fund.balance() : 0
  const closed = cash.close({
    counted: expected - 500,
    register_float: 2000,
    destinations: [
      { kind: 'fondo', amount: expected - 2500 - 3000 },
      { kind: 'proveedor', amount: 3000, name: 'Verdulería' },
    ],
    difference_note: 'Faltó un vuelto',
    cashier_id: cashier.id,
  })
  assert(closed.closed_at && closed.difference === -500 && closed.register_float === 2000, 'sesión cerrada con diferencia y fondo fijo')
  if (fund) {
    assert(fund.balance() === fundBefore + (expected - 2500 - 3000), 'el fondo recibió el retiro neto (proveedor entra y sale)')
    const movs = db.prepare(`SELECT kind, amount FROM cash_fund_movements WHERE cash_session_id = ? ORDER BY id`).all(session.id)
    assert(movs.length === 3, 'tres movimientos del fondo ligados al cierre', JSON.stringify(movs))
  }
  assert(cash.lastRegisterFloat() === 2000, 'la apertura siguiente propone $2.000')
  throwsWith(
    () =>
      sales.create({
        items: [{ product_id: p.id, qty: 1, price: 990 }],
        discount: 0,
        payments: [{ method: 'debito', amount: 990 }],
      }),
    /iniciar sesión|cajero/i,
    'venta sin cajero se rechaza cuando hay usuarios',
  )

  // ── 10. Cuadre semanal ───────────────────────────────────────────────
  if (reconciliation) {
    step('Cuadre semanal')
    const status = reconciliation.status()
    assert(typeof status.required === 'boolean' && /^\d{4}-\d{2}-\d{2}$/.test(status.week_start), 'status devuelve la semana anterior')
    const week = reconciliation.compute(status.week_start)
    assert(week.week_start === status.week_start && Array.isArray(week.sales.by_method), 'compute arma las secciones')
    const wk = reconciliation.currentWeekStart()
    const cur = reconciliation.compute(wk)
    assert(cur.sales.total === 1980, 'ventas de la semana en curso = $1.980 (la anulada no cuenta)', JSON.stringify(cur.sales))
    assert(cur.inventory.sold_cost === 2 * 850 + 10 * 850 - 10 * 850 || cur.inventory.sold_cost === 1700, 'vendido a costo de la semana', JSON.stringify(cur.inventory))
    const bank = reconciliation.parseBciCsv(
      'Fecha;Descripción;Cargo;Abono;Saldo\n28/09/2026;Abono Transbank;;1.980;100.000\n28/09/2026;Transferencia de Juan;;9.900;109.900\n',
    )
    assert(bank.length === 2 && bank[1].credit === 9900, 'parser de cartola BCI (; y miles con punto)', JSON.stringify(bank))
    throwsWith(
      () =>
        reconciliation.confirm({
          week_start: wk,
          data: { ...cur, bank_rows: bank, explanations: {} },
          user_id: admin.id,
        }),
      /explicar|pendiente/i,
      'confirmar con diferencias sin explicar se rechaza (cierre de caja con −500)',
    )
    throwsWith(
      () =>
        reconciliation.confirm({
          week_start: wk,
          data: { ...cur, bank_rows: bank, explanations: { cash_sessions: { note: 'vuelto', pending: false } } },
          user_id: cashier.id,
        }),
      /administrador/i,
      'solo un admin confirma',
    )
    const explanations = {
      cash_sessions: { note: 'Faltó un vuelto, revisado', pending: false },
      inventory: { note: '', pending: true },
      cards: { note: '', pending: true },
    }
    const confirmed = reconciliation.confirm({
      week_start: wk,
      data: { ...cur, bank_rows: bank, explanations },
      user_id: admin.id,
    })
    assert(confirmed.week_start === wk && !!confirmed.confirmed_at, 'cuadre confirmado')
    assert(reconciliation.history().length === 1, 'historial de cuadres')
  }

  console.log(`\n${fail === 0 ? ANSI.green : ANSI.red}${pass} pass · ${fail} fail${ANSI.reset}\n`)
  dbmod.closeDb()
  try {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  } catch {
    // ignore
  }
  process.exit(fail === 0 ? 0 : 1)
}

try {
  main()
} catch (err) {
  console.error(`${ANSI.red}✗ El smoke test abortó:${ANSI.reset}`, err)
  process.exit(1)
}
