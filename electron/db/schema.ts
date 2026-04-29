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
  (db) => {
    // Productos al peso (verduras, frutas). is_weight=1 indica que el
    // precio es por kg y la cantidad se interpreta como gramos
    // (entero) tanto en stock como en sale_items.qty.
    db.exec(`ALTER TABLE products ADD COLUMN is_weight INTEGER NOT NULL DEFAULT 0`)
    db.exec(`ALTER TABLE sale_items ADD COLUMN is_weight INTEGER NOT NULL DEFAULT 0`)
  },
  (db) => {
    // Umbrales de reposición: 0 = sin alerta. Para productos al peso
    // están en gramos (igual que stock).
    db.exec(`ALTER TABLE products ADD COLUMN stock_min INTEGER NOT NULL DEFAULT 0`)
    db.exec(`ALTER TABLE products ADD COLUMN stock_max INTEGER NOT NULL DEFAULT 0`)
    // Devoluciones parciales por línea de venta.
    db.exec(`ALTER TABLE sale_items ADD COLUMN returned_qty INTEGER NOT NULL DEFAULT 0`)
    // Pago dividido: cada venta puede tener múltiples métodos de pago.
    db.exec(`
      CREATE TABLE IF NOT EXISTS sale_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
        method TEXT NOT NULL,
        amount INTEGER NOT NULL,
        cash_received INTEGER,
        change_given INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON sale_payments(sale_id);
    `)
    // Migrar pagos existentes: una fila sale_payments por cada sales.
    db.exec(`
      INSERT INTO sale_payments (sale_id, method, amount, cash_received, change_given)
      SELECT id, payment_method, total, cash_received, change_given
      FROM sales
      WHERE NOT EXISTS (SELECT 1 FROM sale_payments WHERE sale_id = sales.id)
    `)
    // Promociones automáticas (catálogo simple).
    db.exec(`
      CREATE TABLE IF NOT EXISTS promotions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL, -- 'percent_off_category' | 'percent_off_product' | 'buy_n_get_m_free'
        target TEXT,         -- nombre de categoría o id de producto según kind
        params TEXT NOT NULL DEFAULT '{}', -- JSON con percent / n / m
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    // Cajeros con PIN.
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        pin TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'cashier', -- 'admin' | 'cashier'
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    db.exec(`ALTER TABLE sales ADD COLUMN cashier_id TEXT REFERENCES users(id)`)
  },
  (db) => {
    // Preferencia de tamaño de letra por usuario para accesibilidad
    // (1.0 = normal). El front aplica html { font-size: 16px * scale }.
    db.exec(`ALTER TABLE users ADD COLUMN font_scale REAL NOT NULL DEFAULT 1.0`)
  },
  (db) => {
    // Categorías con metadata: color para etiquetas en UI y un margen
    // por defecto que se sugiere al crear productos en esa categoría.
    // Los productos siguen guardando la categoría como TEXT en
    // products.category — esta tabla solo agrega metadata y permite
    // tener categorías "vacías" (sin productos todavía).
    db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        color TEXT,
        default_margin REAL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name COLLATE NOCASE);
    `)
    // Migrar las categorías ya en uso a la tabla nueva.
    db.exec(`
      INSERT OR IGNORE INTO categories (id, name)
      SELECT lower(hex(randomblob(8))), TRIM(category) FROM products
      WHERE category IS NOT NULL AND TRIM(category) <> ''
      GROUP BY TRIM(category)
    `)
  },
  (db) => {
    // Tickets en espera persistidos en SQLite (antes vivían solo en
    // localStorage del renderer y se podían perder a mitad de turno si
    // se limpiaba el perfil de Electron). El payload se serializa como
    // JSON porque la forma del CartItem evoluciona y no queremos un
    // FK a productos (un producto borrado no debería romper la lectura
    // del ticket — al recuperar reconciliamos contra la realidad).
    db.exec(`
      CREATE TABLE IF NOT EXISTS held_tickets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        items_json TEXT NOT NULL,
        discount INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_held_tickets_created ON held_tickets(created_at);
    `)
  },
  (db) => {
    // Permitir borrar productos definitivamente aunque tengan ventas.
    // Antes el FK sale_items.product_id era NOT NULL → no se podía
    // borrar el producto (la cajera quedaba trabada y solo podía
    // archivar). Ahora es nullable + ON DELETE SET NULL: el delete
    // funciona y las boletas históricas siguen mostrándose perfectas
    // porque ya guardamos name/price/cost en snapshots por línea.
    //
    // SQLite no soporta cambiar la FK con ALTER, así que recreamos la
    // tabla con la dance estándar (CREATE → INSERT SELECT → DROP →
    // RENAME). Como nada FK-referencia a sale_items (es el lado
    // "child"), es seguro hacerlo dentro de la transacción de la
    // migración.
    db.exec(`
      CREATE TABLE sale_items_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
        product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
        name_snapshot TEXT NOT NULL,
        price_snapshot INTEGER NOT NULL,
        cost_snapshot INTEGER NOT NULL,
        surcharge INTEGER NOT NULL DEFAULT 0,
        qty INTEGER NOT NULL,
        line_total INTEGER NOT NULL,
        is_weight INTEGER NOT NULL DEFAULT 0,
        returned_qty INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO sale_items_new (
        id, sale_id, product_id, name_snapshot, price_snapshot, cost_snapshot,
        surcharge, qty, line_total, is_weight, returned_qty
      )
      SELECT id, sale_id, product_id, name_snapshot, price_snapshot, cost_snapshot,
             surcharge, qty, line_total, is_weight, returned_qty
      FROM sale_items;
      DROP TABLE sale_items;
      ALTER TABLE sale_items_new RENAME TO sale_items;
      CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
      CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
    `)
  },
  (db) => {
    // Auditoría de caja: trackear quién abrió, cerró y quién hizo cada
    // movimiento. Antes solo sabíamos el total de la caja, no quién
    // operaba en el momento. La cajera entra con su PIN y queda todo
    // a su nombre.
    //
    // No usamos ON DELETE SET NULL acá (recreate-table dance es caro
    // por las tablas hijas). En su lugar `users.remove` ya limpia
    // las referencias antes del DELETE.
    db.exec(`
      ALTER TABLE cash_sessions ADD COLUMN opened_by_id TEXT REFERENCES users(id);
      ALTER TABLE cash_sessions ADD COLUMN closed_by_id TEXT REFERENCES users(id);
      ALTER TABLE cash_movements ADD COLUMN cashier_id TEXT REFERENCES users(id);
    `)
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
