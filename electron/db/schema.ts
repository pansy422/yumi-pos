import type Database from 'better-sqlite3'

const MIGRATIONS: ((db: Database.Database) => void)[] = [
  (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS _meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS products (
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
      CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
      CREATE INDEX IF NOT EXISTS idx_products_archived ON products(archived);

      CREATE TABLE IF NOT EXISTS cash_sessions (
        id TEXT PRIMARY KEY,
        opened_at TEXT NOT NULL DEFAULT (datetime('now')),
        closed_at TEXT,
        opening_amount INTEGER NOT NULL,
        expected_close INTEGER,
        counted_close INTEGER,
        difference INTEGER,
        notes TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_cash_open ON cash_sessions(closed_at);

      CREATE TABLE IF NOT EXISTS sales (
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
      CREATE INDEX IF NOT EXISTS idx_sales_completed ON sales(completed_at);
      CREATE INDEX IF NOT EXISTS idx_sales_session ON sales(cash_session_id);

      CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL REFERENCES products(id),
        name_snapshot TEXT NOT NULL,
        price_snapshot INTEGER NOT NULL,
        cost_snapshot INTEGER NOT NULL,
        qty INTEGER NOT NULL,
        line_total INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
      CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

      CREATE TABLE IF NOT EXISTS cash_movements (
        id TEXT PRIMARY KEY,
        cash_session_id TEXT NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        amount INTEGER NOT NULL,
        note TEXT,
        sale_id TEXT REFERENCES sales(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_cash_mov_session ON cash_movements(cash_session_id);

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sale_counter (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_number INTEGER NOT NULL DEFAULT 0
      );
      INSERT OR IGNORE INTO sale_counter (id, last_number) VALUES (1, 0);
    `)
  },
  (db) => {
    db.exec(`ALTER TABLE sale_items ADD COLUMN surcharge INTEGER NOT NULL DEFAULT 0`)
  },
]

export function runMigrations(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`)
  const row = db.prepare(`SELECT value FROM _meta WHERE key = 'db_version'`).get() as
    | { value: string }
    | undefined
  const current = row ? Number(row.value) : 0
  const target = MIGRATIONS.length

  if (current >= target) return

  const upsert = db.prepare(
    `INSERT INTO _meta (key, value) VALUES ('db_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  )

  const tx = db.transaction(() => {
    for (let i = current; i < target; i++) {
      MIGRATIONS[i](db)
    }
    upsert.run(String(target))
  })
  tx()
}
