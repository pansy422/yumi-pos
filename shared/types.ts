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

export type ProductPatch = Partial<ProductInput> & { archived?: 0 | 1 }

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
}

export type SaleItem = {
  product_id: string
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
}

export type CategoryStat = {
  name: string
  count: number
  stock: number
  value: number
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
  created_at: string
  sale_id: string | null
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
}

export type BackupSettings = {
  auto_daily: boolean
  /** ISO timestamp del último respaldo automático correcto. */
  last_run: string | null
  /** Cuántos respaldos antiguos conservar antes de borrar. */
  keep_last: number
}

export type Settings = {
  store: StoreSettings
  printer: PrinterSettings
  flags: AppFlags
  backup: BackupSettings
  receipt_template: ReceiptTemplate
}

export type DailyReport = {
  date: string
  sales_count: number
  revenue: number
  profit: number
  by_payment: { method: PaymentMethod; total: number; count: number }[]
  top_products: { product_id: string; name: string; qty: number; revenue: number }[]
  by_category: CategoryRevenue[]
}

export type RangeReport = {
  from: string
  to: string
  sales_count: number
  revenue: number
  profit: number
  by_payment: { method: PaymentMethod; total: number; count: number }[]
  top_products: { product_id: string; name: string; qty: number; revenue: number }[]
  by_category: CategoryRevenue[]
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
  | { kind: 'needs_info'; barcode: string }

export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

export type Api = {
  productsList: (q?: { search?: string; includeArchived?: boolean; category?: string | null }) => Promise<Product[]>
  productsGet: (id: string) => Promise<Product | null>
  productsByBarcode: (barcode: string) => Promise<Product | null>
  productsCreate: (input: ProductInput) => Promise<Product>
  productsUpdate: (id: string, patch: ProductPatch) => Promise<Product>
  productsArchive: (id: string, archived: boolean) => Promise<void>
  productsScanIn: (barcode: string, opts?: { newProduct?: ProductInput }) => Promise<ScanInResult>
  productsAdjustStock: (id: string, delta: number, note?: string) => Promise<Product>
  productsImport: (rows: ProductInput[]) => Promise<{ created: number; updated: number }>
  productsCritical: () => Promise<Product[]>
  categoriesList: () => Promise<CategoryStat[]>
  categoriesRename: (from: string, to: string) => Promise<{ updated: number }>

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
  cashOpen: (openingAmount: number, notes?: string) => Promise<CashSession>
  cashClose: (countedAmount: number, notes?: string) => Promise<CashSession>
  cashMove: (kind: 'withdraw' | 'deposit' | 'adjustment', amount: number, note: string) => Promise<CashMovement>
  cashMovements: (sessionId: string) => Promise<CashMovement[]>
  cashSummary: (sessionId: string) => Promise<CashSummary>
  cashZReport: (sessionId: string) => Promise<ZReport>
  printZReport: (sessionId: string) => Promise<Result<void>>
  printLowStock: () => Promise<Result<void>>

  reportDaily: (date: string) => Promise<DailyReport>
  reportRange: (from: string, to: string) => Promise<RangeReport>

  settingsGet: () => Promise<Settings>
  settingsSet: (patch: Partial<Settings>) => Promise<Settings>

  printerList: () => Promise<DetectedPrinter[]>
  printerTest: () => Promise<Result<void>>
  printerOpenDrawer: () => Promise<Result<void>>
  printReceipt: (saleId: string) => Promise<Result<void>>

  backupExport: () => Promise<{ path: string } | null>
  backupImport: () => Promise<{ path: string } | null>
  backupRunAuto: () => Promise<Result<{ ran: boolean; path?: string; reason?: string }>>
  backupAutoDir: () => Promise<string>

  appInfo: () => Promise<{ version: string; dbPath: string; userDataPath: string }>
}
