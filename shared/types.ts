import type { ReceiptTemplate } from './template'

export type PaymentMethod = 'efectivo' | 'debito' | 'credito' | 'transferencia' | 'otro'

export type Product = {
  id: string
  barcode: string | null
  name: string
  sku: string | null
  cost: number
  price: number
  stock: number
  stock_min: number
  stock_max: number
  category: string | null
  is_weight: 0 | 1
  archived: 0 | 1
  created_at: string
  updated_at: string
}

export type ProductInput = {
  barcode?: string | null
  name: string
  sku?: string | null
  cost: number
  price: number
  stock?: number
  stock_min?: number
  stock_max?: number
  category?: string | null
  is_weight?: 0 | 1
}

export type ProductPatch = Partial<ProductInput> & {
  archived?: 0 | 1
  /** Obligatorio cuando `stock` cambia: queda en `stock_movements`. */
  stock_reason?: string
}

export type PurchasePaymentMethod = 'efectivo' | 'transferencia' | 'debito' | 'credito'

export type WriteoffReason = 'vencido' | 'dañado' | 'consumo' | 'robo' | 'conteo' | 'otro'

export type CashFundMovementKind =
  | 'in_from_register'
  | 'out_supplier'
  | 'out_expense'
  | 'out_owner'
  | 'out_transfer_swap'
  | 'adjustment'

export type Purchase = {
  id: number
  /** Fecha de la compra, AAAA-MM-DD. */
  purchased_at: string
  supplier: string
  amount: number
  payment_method: PurchasePaymentMethod
  note: string | null
  /** Ruta local de la foto de la boleta (opcional). */
  receipt_path: string | null
  user_id: string | null
  user_name: string | null
  created_at: string
}

export type PurchaseInput = {
  purchased_at?: string
  supplier: string
  amount: number
  payment_method: PurchasePaymentMethod
  note?: string | null
  receipt_path?: string | null
  user_id?: string | null
}

export type PurchaseMonth = {
  month: string
  items: Purchase[]
  total: number
  by_supplier: { supplier: string; count: number; total: number }[]
  by_method: { method: PurchasePaymentMethod; count: number; total: number }[]
}

export type StockWriteoff = {
  id: number
  product_id: string | null
  product_name: string
  /** Unidades, o gramos si es por peso. */
  qty: number
  reason: WriteoffReason
  cost_snapshot: number
  is_weight: 0 | 1
  note: string | null
  user_id: string | null
  user_name: string | null
  created_at: string
  /** qty × costo (con /1000 para peso). */
  cost_total: number
}

export type WriteoffInput = {
  product_id: string
  qty: number
  reason: WriteoffReason
  note?: string | null
  user_id?: string | null
}

export type WriteoffReport = {
  month: string
  count: number
  total_cost: number
  by_reason: { reason: WriteoffReason; count: number; cost: number }[]
  by_product: {
    product_id: string | null
    product_name: string
    is_weight: 0 | 1
    qty: number
    cost: number
  }[]
}

// ── Cuadre semanal ──────────────────────────────────────────────────────

export type BankRow = {
  /** AAAA-MM-DD */
  date: string
  description: string
  debit: number
  credit: number
  balance: number | null
}

export type ReconciliationStatus = {
  /** true ⇒ la pantalla de venta se bloquea hasta confirmar. */
  required: boolean
  week_start: string
  week_end: string
  confirmed: boolean
  has_activity: boolean
  weekday: number
}

export type ReconciliationExplanation = { note: string; pending: boolean }

export type WeekReconciliation = {
  week_start: string
  week_end: string
  generated_at: string
  sales: {
    count: number
    total: number
    by_method: { method: PaymentMethod; count: number; total: number }[]
    by_day: {
      date: string
      efectivo: number
      debito: number
      credito: number
      transferencia: number
      otro: number
      total: number
    }[]
  }
  purchases: {
    count: number
    total: number
    by_method: { method: string; count: number; total: number }[]
    by_supplier: { supplier: string; count: number; total: number }[]
  }
  cash: {
    cash_sales: number
    withdrawals_total: number
    withdrawals: {
      amount: number
      reason: string
      counterparty: string | null
      created_at: string
      user_name: string | null
    }[]
    sessions: {
      id: string
      opened_at: string
      closed_at: string | null
      opening_amount: number
      expected_close: number | null
      counted_close: number | null
      difference: number | null
      difference_note: string | null
      register_float: number | null
    }[]
    sessions_difference: number
    fund_start: number
    fund_in_from_register: number
    /** Negativo. */
    fund_out_total: number
    fund_adjustments: number
    fund_out_by_kind: { kind: string; total: number; count: number }[]
    fund_out: {
      kind: string
      amount: number
      reason: string
      counterparty: string | null
      created_at: string
      user_name: string | null
    }[]
    fund_end_calc: number
  }
  cards: {
    expected_total: number
    received_total: number | null
    rows: {
      settle_date: string
      sales_days: string[]
      expected: number
      received: number | null
      difference: number | null
      flagged: boolean
    }[]
  }
  transfers: {
    expected_total: number
    received_total: number | null
    rows: {
      sale_number: number
      date: string
      amount: number
      matched: boolean | null
      bank_date: string | null
    }[]
    unmatched_count: number | null
  }
  inventory: {
    value_start: number
    entries: number
    returns: number
    /** Vendido a costo según líneas de venta (neto de devoluciones). */
    sold_cost: number
    /** Vendido a costo según movimientos de stock. */
    sold_movements: number
    /** Parte vendida sin stock (el historial quedó negativo). */
    sold_without_stock: number
    writeoffs: number
    manual: number
    value_end_calc: number
    value_end_real: number
    difference: number
    movements_count: number
  }
  carried_pending: { key: string; note: string; week_start: string }[]
  bank_rows: BankRow[]
  bank_rows_count: number
  manual: { fund_counted: number | null; bank_balance: number | null }
  explanations: Record<string, ReconciliationExplanation>
}

export type WeeklyReconciliationRecord = {
  id: number
  week_start: string
  week_end: string
  confirmed_at: string
  user_id: string | null
  user_name: string | null
  data: WeekReconciliation | null
}

export type ReconciliationConfirmInput = {
  week_start: string
  data: WeekReconciliation
  user_id?: string | null
}

export type StockMovementKind =
  | 'sale'
  | 'return'
  | 'entry'
  | 'writeoff'
  | 'manual'
  | 'archive'

export type StockMovement = {
  id: number
  /** null si el producto fue borrado después. */
  product_id: string | null
  product_name: string
  kind: StockMovementKind
  /** Con signo: negativo sale, positivo entra. Gramos si `is_weight`. */
  qty: number
  /** Stock resultante. Puede ser negativo en `sale` (venta sin stock)
   * aunque `products.stock` se mantenga en 0. */
  stock_after: number
  cost_snapshot: number
  is_weight: 0 | 1
  reason: string | null
  ref_table: string | null
  ref_id: string | null
  user_id: string | null
  user_name: string | null
  created_at: string
}

/** Totales del inventario calculados en la base sobre TODOS los productos. */
export type ProductStats = {
  active: number
  archived: number
  /** Valor a costo del stock activo (pesos enteros). */
  stock_value: number
  out_of_stock: number
  low_stock: number
}

export type SlowMovingProduct = {
  id: string
  name: string
  category: string | null
  stock: number
  cost: number
  is_weight: 0 | 1
  /** ISO timestamp UTC de la última venta no anulada. null si nunca se vendió. */
  last_sold_at: string | null
  /** Días desde la última venta (entero). null si nunca se vendió. */
  days_since_sold: number | null
  /** Días desde que se creó el producto. */
  days_since_created: number
  /** Valor inmovilizado en pesos (cost × stock, /1000 para peso). */
  stock_value: number
}

export type CartItem = {
  product_id: string
  barcode: string | null
  name: string
  price: number
  cost: number
  qty: number
  stock: number
  surcharge: number
  is_weight: 0 | 1
  category: string | null
}

export type SalePayment = {
  method: PaymentMethod
  amount: number
  cash_received?: number
  change_given?: number
}

export type SaleInput = {
  items: { product_id: string; qty: number; price: number; surcharge?: number }[]
  discount: number
  payments: SalePayment[]
  note?: string
  cashier_id?: string | null
}

export type SaleItem = {
  /** null si el producto fue borrado después de la venta. El nombre,
   * precio y costo siguen disponibles en los snapshots. */
  product_id: string | null
  name_snapshot: string
  price_snapshot: number
  cost_snapshot: number
  surcharge: number
  qty: number
  line_total: number
  is_weight: 0 | 1
  returned_qty: number
}

export type Sale = {
  id: string
  number: number
  started_at: string
  completed_at: string
  subtotal: number
  discount: number
  total: number
  /** Si hay un solo método, ese. Si hay varios, "mixto". */
  payment_method: PaymentMethod | 'mixto'
  cash_received: number | null
  change_given: number | null
  cash_session_id: string | null
  cashier_id: string | null
  /** Nombre del cajero al momento de la venta (snapshot via JOIN en
   * lectura). null si el user fue borrado o nunca hubo. */
  cashier_name: string | null
  voided: 0 | 1
}

export type SaleWithItems = Sale & {
  items: SaleItem[]
  payments: SalePayment[]
}

export type CashSession = {
  id: string
  opened_at: string
  closed_at: string | null
  opening_amount: number
  expected_close: number | null
  counted_close: number | null
  difference: number | null
  notes: string | null
  /** Efectivo que quedó en el cajón al cerrar (fondo fijo). */
  register_float: number | null
  /** Explicación obligatoria cuando contado ≠ esperado. */
  difference_note: string | null
  /** Cajero que abrió la sesión. null si era anónimo / borrado. */
  opened_by_id: string | null
  opened_by_name: string | null
  /** Cajero que cerró la sesión (puede diferir de quien abrió). */
  closed_by_id: string | null
  closed_by_name: string | null
}

export type Category = {
  id: string
  name: string
  color: string | null
  default_margin: number | null
  created_at: string
  product_count: number
  total_stock_value: number
}

export type CategoryInput = {
  id?: string
  name: string
  color?: string | null
  default_margin?: number | null
}

export type HeldTicket = {
  id: string
  name: string
  items: CartItem[]
  discount: number
  /** ISO timestamp en SQLite ('YYYY-MM-DD HH:MM:SS', UTC). */
  created_at: string
}

export type PromotionKind =
  | 'percent_off_category'
  | 'percent_off_product'
  | 'percent_off_total'

export type Promotion = {
  id: string
  name: string
  kind: PromotionKind
  /** Categoría o product_id según kind. null para percent_off_total. */
  target: string | null
  params: { percent?: number; min_amount?: number }
  active: 0 | 1
  created_at: string
}

export type PromotionInput = {
  id?: string
  name: string
  kind: PromotionKind
  target?: string | null
  params: { percent?: number; min_amount?: number }
  active?: boolean
}

export type AppliedPromotion = {
  promo_id: string
  name: string
  amount: number
}

export type UserRole = 'admin' | 'cashier'

export type User = {
  id: string
  name: string
  role: UserRole
  active: 0 | 1
  font_scale: number
  created_at: string
}

export type UserInput = {
  id?: string
  name: string
  pin?: string
  role: UserRole
  active?: boolean
  font_scale?: number
}

export type CategoryRevenue = {
  name: string | null
  count: number
  qty: number
  revenue: number
  profit: number
}

export type ZReport = {
  session: CashSession
  summary: CashSummary
  by_payment: { method: PaymentMethod; count: number; total: number }[]
  voided_count: number
  voided_total: number
}

export type CashSummary = {
  session_id: string
  opening: number
  sales_count: number
  cash_sales: number
  gross_sales: number
  deposits: number
  withdraws: number
  adjustments: number
  expected: number
}

export type CashMovementKind = 'sale' | 'withdraw' | 'deposit' | 'adjustment'

export type CashMovement = {
  id: string
  cash_session_id: string
  kind: CashMovementKind
  amount: number
  note: string | null
  /** Motivo (obligatorio en retiros). */
  reason: string | null
  /** A quién se entregó el efectivo (obligatorio en retiros). */
  counterparty: string | null
  created_at: string
  sale_id: string | null
  /** Quién hizo el movimiento. null para movimientos de venta antiguos
   * (sale_id != null) o cuando el user fue borrado. */
  cashier_id: string | null
  cashier_name: string | null
}

export type CashCloseDestinationKind = 'fondo' | 'proveedor' | 'dueño' | 'otro'

export type CashCloseDestination = {
  kind: CashCloseDestinationKind
  amount: number
  /** Nombre del proveedor (obligatorio en `proveedor`). */
  name?: string
  /** Motivo (obligatorio en `otro`). */
  reason?: string
}

export type CashCloseInput = {
  /** Efectivo físico contado en el cajón. */
  counted: number
  /** Lo que queda en el cajón para mañana. */
  register_float: number
  /** Reparto de (contado − queda). Debe sumar exacto. */
  destinations: CashCloseDestination[]
  /** Obligatoria si contado ≠ esperado. */
  difference_note?: string
  notes?: string
  cashier_id?: string | null
}

export type CashFundMovement = {
  id: number
  kind: CashFundMovementKind
  /** Positivo entra al fondo, negativo sale. */
  amount: number
  reason: string
  counterparty: string | null
  purchase_id: number | null
  cash_session_id: string | null
  user_id: string | null
  user_name: string | null
  created_at: string
}

export type CashFundCount = {
  balance_before: number
  counted: number
  difference: number
  movement: CashFundMovement | null
}

/** Resumen de una sesión cerrada con conteo de ventas/movimientos para
 * la vista de historial. */
export type CashSessionSummary = CashSession & {
  sales_count: number
  cash_sales: number
}

export type StoreSettings = {
  name: string
  address: string
  rut: string
  phone: string
  receipt_footer: string
  tax_rate: number
  tax_inclusive: boolean
}

export type PrinterConnection = 'usb' | 'network'

export type PrinterSettings = {
  enabled: boolean
  connection: PrinterConnection
  interface: string
  width_chars: number
  auto_print: boolean
  open_drawer_on_cash: boolean
  extra_copy: boolean
}

export type AppFlags = {
  onboarded: boolean
  theme: 'light' | 'dark'
}

export type BackupSettings = {
  auto_daily: boolean
  /** ISO timestamp del último respaldo automático correcto. */
  last_run: string | null
  /** Cuántos respaldos antiguos conservar antes de borrar. */
  keep_last: number
}

export type CashSettings = {
  /** Fondo fijo que queda en el cajón al cerrar (propuesto en el cierre). */
  register_float: number
}

export type ReconciliationSettings = {
  /** Día del cuadre semanal: 1 = lunes … 7 = domingo. */
  weekday: number
}

export type Settings = {
  store: StoreSettings
  printer: PrinterSettings
  flags: AppFlags
  backup: BackupSettings
  cash: CashSettings
  reconciliation: ReconciliationSettings
  receipt_template: ReceiptTemplate
}

export type CashierStat = {
  cashier_id: string | null
  name: string
  count: number
  revenue: number
  profit: number
}

export type DailyReport = {
  date: string
  sales_count: number
  revenue: number
  profit: number
  by_payment: { method: PaymentMethod; total: number; count: number }[]
  top_products: { product_id: string | null; name: string; qty: number; revenue: number }[]
  by_category: CategoryRevenue[]
  by_cashier: CashierStat[]
}

export type RangeReport = {
  from: string
  to: string
  sales_count: number
  revenue: number
  profit: number
  by_payment: { method: PaymentMethod; total: number; count: number }[]
  top_products: { product_id: string | null; name: string; qty: number; revenue: number }[]
  by_category: CategoryRevenue[]
  by_cashier: CashierStat[]
  daily: { date: string; revenue: number; profit: number; count: number }[]
}

export type DetectedPrinter = {
  name: string
  isDefault: boolean
  status?: string
  port?: string
  driver?: string
}

export type ScanInResult =
  | { kind: 'created'; product: Product }
  | { kind: 'incremented'; product: Product }
  | { kind: 'needs_info'; barcode: string; archived_match?: Product }

export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

export type Api = {
  productsList: (q?: {
    search?: string
    includeArchived?: boolean
    onlyArchived?: boolean
    category?: string | null
  }) => Promise<Product[]>
  productsPage: (q: {
    search?: string
    status?: 'active' | 'archived' | 'all'
    offset?: number
    limit?: number
  }) => Promise<{ items: Product[]; total: number }>
  productsStats: () => Promise<ProductStats>
  productsGet: (id: string) => Promise<Product | null>
  productsGetMany: (ids: string[]) => Promise<(Product | null)[]>
  productsByBarcode: (barcode: string) => Promise<Product | null>
  productsCreate: (input: ProductInput) => Promise<Product>
  productsUpdate: (id: string, patch: ProductPatch) => Promise<Product>
  productsArchive: (id: string, archived: boolean) => Promise<void>
  productsDelete: (id: string) => Promise<void>
  productsReactivate: (id: string, opts?: { newStock?: number }) => Promise<Product>
  productsScanIn: (barcode: string, opts?: { newProduct?: ProductInput }) => Promise<ScanInResult>
  productsAdjustStock: (id: string, delta: number, note?: string) => Promise<Product>
  productsImport: (rows: ProductInput[]) => Promise<{ created: number; updated: number }>
  productsCritical: () => Promise<Product[]>
  productsSlowMoving: (opts: { days: number }) => Promise<SlowMovingProduct[]>
  categoriesRename: (from: string, to: string) => Promise<{ updated: number }>
  categoriesCrud: () => Promise<Category[]>
  categoriesSaveMeta: (input: CategoryInput) => Promise<Category>
  categoriesRemove: (id: string, opts?: { reassignTo?: string | null }) => Promise<void>
  productsBulkPrice: (filter: {
    category?: string | null
    productIds?: string[]
    percent: number
    field?: 'price' | 'cost'
  }) => Promise<{ updated: number; oldTotal: number; newTotal: number }>
  stockMovementsForProduct: (productId: string, limit?: number) => Promise<StockMovement[]>
  stockMovementsList: (q: {
    from?: string
    to?: string
    kind?: StockMovementKind
    search?: string
    limit?: number
  }) => Promise<StockMovement[]>
  /** Avisa al proceso main quién está logueado (para atribuir movimientos). */
  sessionSetUser: (userId: string | null) => Promise<void>

  heldTicketsList: () => Promise<HeldTicket[]>
  heldTicketsSave: (input: {
    name: string
    items: CartItem[]
    discount: number
  }) => Promise<HeldTicket>
  heldTicketsRemove: (id: string) => Promise<void>
  heldTicketsClear: () => Promise<void>

  promotionsList: (includeInactive?: boolean) => Promise<Promotion[]>
  promotionsSave: (input: PromotionInput) => Promise<Promotion>
  promotionsDelete: (id: string) => Promise<void>
  promotionsCompute: (
    items: (CartItem & { category?: string | null })[],
  ) => Promise<{ total_discount: number; applied: AppliedPromotion[] }>

  usersList: (includeInactive?: boolean) => Promise<User[]>
  usersSave: (input: UserInput) => Promise<User>
  usersDelete: (id: string) => Promise<void>
  usersVerifyPin: (id: string, pin: string) => Promise<User | null>
  usersCount: () => Promise<number>

  salesCreate: (input: SaleInput) => Promise<SaleWithItems>
  salesList: (q?: { from?: string; to?: string; limit?: number; cashSessionId?: string }) => Promise<Sale[]>
  salesGet: (id: string) => Promise<SaleWithItems | null>
  salesVoid: (id: string, reason: string) => Promise<void>
  salesNextNumber: () => Promise<number>
  salesReturnItems: (
    saleId: string,
    returns: { product_id: string; qty: number }[],
    reason: string,
  ) => Promise<{ refunded_total: number; sale: SaleWithItems }>

  cashCurrent: () => Promise<CashSession | null>
  cashOpen: (
    openingAmount: number,
    notes?: string,
    cashierId?: string | null,
  ) => Promise<CashSession>
  cashClose: (input: CashCloseInput) => Promise<CashSession>
  cashMove: (
    kind: 'withdraw' | 'deposit' | 'adjustment',
    amount: number,
    note: string,
    cashierId?: string | null,
    opts?: { counterparty?: string },
  ) => Promise<CashMovement>
  /** Fondo fijo propuesto para la próxima apertura (último cierre o ajuste). */
  cashLastRegisterFloat: () => Promise<number>
  fundBalance: () => Promise<number>
  fundList: (opts?: {
    limit?: number
    from?: string
    to?: string
    kind?: CashFundMovementKind
  }) => Promise<CashFundMovement[]>
  fundAdd: (input: {
    kind: CashFundMovementKind
    amount: number
    reason: string
    counterparty?: string | null
    user_id?: string | null
  }) => Promise<CashFundMovement>
  fundSinceLastCount: () => Promise<{ last_count_at: string | null; movements: CashFundMovement[] }>
  fundCount: (counted: number, userId?: string | null, note?: string) => Promise<CashFundCount>

  purchasesCreate: (input: PurchaseInput) => Promise<Purchase>
  purchasesRemove: (id: number) => Promise<void>
  purchasesSetReceipt: (id: number, receiptPath: string | null) => Promise<Purchase>
  purchasesMonth: (q: {
    month: string
    supplier?: string
    payment_method?: PurchasePaymentMethod
  }) => Promise<PurchaseMonth>
  purchasesSuppliers: () => Promise<string[]>
  purchasesPickReceipt: () => Promise<{ path: string } | null>
  purchasesOpenReceipt: (path: string) => Promise<Result<void>>

  writeoffsCreate: (input: WriteoffInput) => Promise<StockWriteoff>
  writeoffsList: (q: { from?: string; to?: string; limit?: number }) => Promise<StockWriteoff[]>
  writeoffsReport: (q: { month: string }) => Promise<WriteoffReport>

  reconciliationStatus: () => Promise<ReconciliationStatus>
  reconciliationWeeks: () => Promise<{ week_start: string; week_end: string; confirmed: boolean }[]>
  reconciliationCompute: (
    weekStart: string,
    opts?: { bank_rows?: BankRow[] },
  ) => Promise<WeekReconciliation>
  reconciliationConfirm: (input: ReconciliationConfirmInput) => Promise<WeeklyReconciliationRecord>
  reconciliationGet: (weekStart: string) => Promise<WeeklyReconciliationRecord | null>
  reconciliationHistory: (limit?: number) => Promise<WeeklyReconciliationRecord[]>
  reconciliationParseBci: (text: string) => Promise<BankRow[]>
  cashMovements: (sessionId: string) => Promise<CashMovement[]>
  cashSummary: (sessionId: string) => Promise<CashSummary>
  cashZReport: (sessionId: string) => Promise<ZReport>
  cashHistory: (opts?: {
    limit?: number
    cashierId?: string | null
  }) => Promise<CashSessionSummary[]>
  printZReport: (sessionId: string) => Promise<Result<void>>
  printLowStock: () => Promise<Result<void>>
  printSlowMoving: (days: number) => Promise<Result<void>>

  reportDaily: (date: string) => Promise<DailyReport>
  reportRange: (from: string, to: string) => Promise<RangeReport>

  settingsGet: () => Promise<Settings>
  settingsSet: (patch: Partial<Settings>) => Promise<Settings>

  printerList: () => Promise<DetectedPrinter[]>
  printerTest: () => Promise<Result<void>>
  printerOpenDrawer: () => Promise<Result<void>>
  printReceipt: (saleId: string, opts?: { reprint?: boolean }) => Promise<Result<void>>

  backupExport: () => Promise<{ path: string } | null>
  backupImport: () => Promise<{ path: string } | null>
  backupRunAuto: () => Promise<Result<{ ran: boolean; path?: string; reason?: string }>>
  backupAutoDir: () => Promise<string>

  appInfo: () => Promise<{ version: string; dbPath: string; userDataPath: string }>
}
