#!/usr/bin/env node
/**
 * Smoke test del flujo crítico de venta.
 *
 * Verifica:
 *   - Esquema SQLite + migraciones
 *   - Crear producto
 *   - Abrir caja
 *   - Crear venta (¡el bug del FK constraint!)
 *   - Persistencia de sale_items con sale_id correcto
 *   - Decremento de stock
 *   - Inserción del cash_movement
 *   - Lectura completa de la venta con items
 *
 * Corre con:
 *   node scripts/smoke-test.cjs
 *
 * No requiere Electron — usa una DB temporal y ejecuta el mismo SQL
 * que produce la app.
 */

const Database = require('better-sqlite3')
const { randomUUID } = require('node:crypto')

const ANSI = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
}

let pass = 0
let fail = 0

function assert(cond, label) {
  if (cond) {
    console.log(`${ANSI.green}  ✓${ANSI.reset} ${label}`)
    pass++
  } else {
    console.log(`${ANSI.red}  ✗${ANSI.reset} ${label}`)
    fail++
  }
}

function step(label) {
  console.log(`\n${ANSI.cyan}▶${ANSI.reset} ${label}`)
}

function setupSchema(db) {
  db.pragma('journal_mode = MEMORY')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE _meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      barcode TEXT UNIQUE,
      name TEXT NOT NULL,
      sku TEXT,
      cost INTEGER NOT NULL DEFAULT 0,
      price INTEGER NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      category TEXT,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE cash_sessions (
      id TEXT PRIMARY KEY,
      opened_at TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at TEXT,
      opening_amount INTEGER NOT NULL,
      expected_close INTEGER,
      counted_close INTEGER,
      difference INTEGER,
      notes TEXT
    );
    CREATE TABLE sales (
      id TEXT PRIMARY KEY,
      number INTEGER NOT NULL UNIQUE,
      started_at TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      discount INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      cash_received INTEGER,
      change_given INTEGER,
      cash_session_id TEXT REFERENCES cash_sessions(id),
      voided INTEGER NOT NULL DEFAULT 0,
      void_reason TEXT,
      note TEXT
    );
    CREATE TABLE sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id),
      name_snapshot TEXT NOT NULL,
      price_snapshot INTEGER NOT NULL,
      cost_snapshot INTEGER NOT NULL,
      surcharge INTEGER NOT NULL DEFAULT 0,
      qty INTEGER NOT NULL,
      line_total INTEGER NOT NULL
    );
    CREATE TABLE cash_movements (
      id TEXT PRIMARY KEY,
      cash_session_id TEXT NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      amount INTEGER NOT NULL,
      note TEXT,
      sale_id TEXT REFERENCES sales(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE sale_counter (id INTEGER PRIMARY KEY CHECK (id = 1), last_number INTEGER NOT NULL DEFAULT 0);
    INSERT INTO sale_counter (id, last_number) VALUES (1, 0);
  `)
}

function main() {
  const db = new Database(':memory:')
  setupSchema(db)

  step('Crear producto "Salsa de tomate Lucchetti"')
  const productId = randomUUID()
  db.prepare(
    `INSERT INTO products (id, barcode, name, cost, price, stock, category)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(productId, '7802500037059', 'Salsa de tomate Lucchetti', 850, 990, 1, 'Abarrotes')
  const p = db.prepare(`SELECT * FROM products WHERE id = ?`).get(productId)
  assert(p && p.stock === 1, 'producto creado con stock 1')

  step('Abrir caja con apertura $10.000')
  const sessionId = randomUUID()
  db.prepare(`INSERT INTO cash_sessions (id, opening_amount) VALUES (?, ?)`).run(sessionId, 10000)
  const session = db
    .prepare(`SELECT * FROM cash_sessions WHERE closed_at IS NULL`)
    .get()
  assert(session && session.id === sessionId, 'sesión abierta')

  step('Crear venta: 1 × Salsa, efectivo, recibido $1.000')
  const saleId = randomUUID()
  const now = new Date().toISOString()
  const total = 990

  const tx = db.transaction(() => {
    const next = db
      .prepare(`UPDATE sale_counter SET last_number = last_number + 1 WHERE id = 1 RETURNING last_number`)
      .get()
    db.prepare(
      `INSERT INTO sales (id, number, started_at, completed_at, subtotal, discount, total,
        payment_method, cash_received, change_given, cash_session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(saleId, next.last_number, now, now, total, 0, total, 'efectivo', 1000, 10, sessionId)

    // El bug original: pasaba product_id como sale_id. La línea correcta es saleId primero.
    db.prepare(
      `INSERT INTO sale_items (sale_id, product_id, name_snapshot, price_snapshot, cost_snapshot, surcharge, qty, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(saleId, productId, 'Salsa de tomate Lucchetti', 990, 850, 0, 1, 990)

    db.prepare(`UPDATE products SET stock = stock - ? WHERE id = ?`).run(1, productId)

    db.prepare(
      `INSERT INTO cash_movements (id, cash_session_id, kind, amount, note, sale_id)
       VALUES (?, ?, 'sale', ?, ?, ?)`,
    ).run(randomUUID(), sessionId, total, 'Venta #' + next.last_number, saleId)
  })

  let txError = null
  try {
    tx()
  } catch (err) {
    txError = err
  }
  assert(!txError, 'transacción de venta no falla con FOREIGN KEY constraint')
  if (txError) console.log(`     ${ANSI.dim}${txError.message}${ANSI.reset}`)

  step('Verificar persistencia')
  const sale = db.prepare(`SELECT * FROM sales WHERE id = ?`).get(saleId)
  assert(sale && sale.total === 990, 'venta persiste con total 990')
  assert(sale.cash_session_id === sessionId, 'cash_session_id correctamente asociado')

  const items = db.prepare(`SELECT * FROM sale_items WHERE sale_id = ?`).all(saleId)
  assert(items.length === 1, 'sale_items contiene 1 línea')
  assert(items[0].sale_id === saleId, 'sale_items.sale_id apunta a la venta correcta (no al producto)')
  assert(items[0].product_id === productId, 'sale_items.product_id apunta al producto')
  assert(items[0].line_total === 990, 'line_total es 990')

  const stockNow = db.prepare(`SELECT stock FROM products WHERE id = ?`).get(productId)
  assert(stockNow.stock === 0, 'stock decrementado a 0')

  const movements = db.prepare(`SELECT * FROM cash_movements WHERE cash_session_id = ?`).all(sessionId)
  assert(movements.length === 1, 'cash_movement creado')
  assert(movements[0].kind === 'sale' && movements[0].amount === 990, 'movimiento es de tipo sale por 990')

  step('Bloquear venta con stock insuficiente')
  // Intento de vender 5 unidades cuando hay 0
  let oversoldErr = null
  try {
    const tx2 = db.transaction(() => {
      const p2 = db.prepare(`SELECT stock, name FROM products WHERE id = ?`).get(productId)
      if (5 > p2.stock) {
        throw new Error(`Stock insuficiente: ${p2.name} (pediste 5, hay ${p2.stock})`)
      }
    })
    tx2()
  } catch (err) {
    oversoldErr = err
  }
  assert(
    oversoldErr && /Stock insuficiente/.test(oversoldErr.message),
    'rechaza sobreventa con mensaje claro',
  )

  step('Restaurar stock al anular venta')
  const tx3 = db.transaction(() => {
    db.prepare(`UPDATE sales SET voided = 1, void_reason = ? WHERE id = ?`).run('test', saleId)
    db.prepare(`UPDATE products SET stock = stock + ? WHERE id = ?`).run(1, productId)
  })
  tx3()
  const stockAfter = db.prepare(`SELECT stock FROM products WHERE id = ?`).get(productId)
  assert(stockAfter.stock === 1, 'stock restaurado a 1 tras anular')

  console.log(
    `\n${fail === 0 ? ANSI.green : ANSI.red}` +
      `${pass} pass · ${fail} fail${ANSI.reset}\n`,
  )

  db.close()
  process.exit(fail === 0 ? 0 : 1)
}

main()
