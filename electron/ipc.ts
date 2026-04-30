import { app, ipcMain } from 'electron'
import { IPC } from '../shared/ipc'
import type { Result } from '../shared/types'
import * as products from './db/products'
import * as sales from './db/sales'
import * as cash from './db/cashSessions'
import * as reports from './db/reports'
import * as settingsRepo from './db/settings'
import * as promotions from './db/promotions'
import * as users from './db/users'
import * as categoriesRepo from './db/categories'
import * as heldTicketsRepo from './db/heldTickets'
import { exportBackup, importBackup } from './utils/backup'
import { listSystemPrinters } from './utils/printersList'
import {
  openDrawer,
  printLowStockHw,
  printReceipt as printReceiptHw,
  printSlowMovingHw,
  printTest,
  printZReportHw,
} from './printer/thermal'
import { getDbPath } from './db'

/**
 * Convierte errores técnicos (SQLite, FS, etc.) en mensajes en español
 * neutro y entendibles por un cajero. Usado por todos los handlers IPC
 * para que NUNCA llegue al usuario un texto crudo tipo
 * "FOREIGN KEY constraint failed".
 */
function humanize(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const code = (err as { code?: string } | undefined)?.code

  if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || /FOREIGN KEY constraint failed/i.test(raw)) {
    return 'No se pudo guardar: alguna referencia (caja, producto o venta) ya no existe en la base. Cierra y vuelve a abrir la pantalla.'
  }
  if (code === 'SQLITE_CONSTRAINT_UNIQUE' || /UNIQUE constraint failed/i.test(raw)) {
    return 'Ya existe un registro con esos datos (código de barras o número repetido).'
  }
  if (code === 'SQLITE_CONSTRAINT_NOTNULL' || /NOT NULL constraint failed/i.test(raw)) {
    return 'Falta completar un dato obligatorio.'
  }
  if (code === 'SQLITE_BUSY' || /database is locked/i.test(raw)) {
    return 'La base de datos está ocupada. Vuelve a intentar en un segundo.'
  }
  if (code === 'SQLITE_FULL' || /disk is full/i.test(raw)) {
    return 'No queda espacio en disco. Libera espacio y vuelve a intentar.'
  }
  if (code === 'ENOENT') {
    return 'No se encontró el archivo solicitado.'
  }
  if (code === 'EACCES' || code === 'EPERM') {
    return 'Sin permisos para acceder al archivo o impresora.'
  }
  return raw
}

/**
 * Handler estándar: lanza el error humanizado si la función falla. El
 * frontend lo recibe en su try/catch y muestra el toast. Usalo para
 * todo lo que no sea hardware externo (impresora, drawer, backup) —
 * cuando la operación falla, casi siempre es un bug que querés que se
 * loggee y propague.
 */
function handle<TArgs extends unknown[], TResult>(
  channel: string,
  fn: (...args: TArgs) => TResult | Promise<TResult>,
) {
  ipcMain.handle(channel, async (_e, ...args: unknown[]) => {
    try {
      return await fn(...(args as TArgs))
    } catch (err) {
      console.error(`[IPC ${channel}] error:`, err)
      throw new Error(humanize(err))
    }
  })
}

/**
 * Handler "seguro": atrapa los errores y los devuelve como `Result<T>`
 * (`{ ok: true, data }` o `{ ok: false, error }`). El frontend NO
 * necesita try/catch — ya recibe un objeto que puede mostrar
 * directamente. Usalo para operaciones donde el fallo es esperable
 * (impresora desconectada, archivo no encontrado en backup) y la app
 * sigue funcionando normal aunque falle.
 */
function handleSafe<TArgs extends unknown[], TResult>(
  channel: string,
  fn: (...args: TArgs) => TResult | Promise<TResult>,
) {
  ipcMain.handle(channel, async (_e, ...args: unknown[]): Promise<Result<TResult>> => {
    try {
      const data = await fn(...(args as TArgs))
      return { ok: true, data }
    } catch (err) {
      console.error(`[IPC ${channel}] error:`, err)
      return { ok: false, error: humanize(err) }
    }
  })
}

export function registerIpc(): void {
  handle(
    IPC.productsList,
    (q?: { search?: string; includeArchived?: boolean; category?: string | null }) =>
      products.list(q ?? {}),
  )
  handle(IPC.productsGet, (id: string) => products.get(id))
  handle(IPC.productsByBarcode, (barcode: string) => products.byBarcode(barcode))
  handle(IPC.productsCreate, (input: Parameters<typeof products.create>[0]) =>
    products.create(input),
  )
  handle(IPC.productsUpdate, (id: string, patch: Parameters<typeof products.update>[1]) =>
    products.update(id, patch),
  )
  handle(IPC.productsArchive, (id: string, archived: boolean) => {
    products.archive(id, archived)
  })
  handle(IPC.productsDelete, (id: string) => {
    products.deleteHard(id)
  })
  handle(IPC.productsReactivate, (id: string, opts?: { newStock?: number }) =>
    products.reactivate(id, opts),
  )
  handle(IPC.productsScanIn, (barcode: string, opts?: Parameters<typeof products.scanIn>[1]) =>
    products.scanIn(barcode, opts),
  )
  handle(IPC.productsAdjustStock, (id: string, delta: number, note?: string) =>
    products.adjustStock(id, delta, note),
  )
  handle(IPC.productsImport, (rows: Parameters<typeof products.importMany>[0]) =>
    products.importMany(rows),
  )
  handle(IPC.productsCritical, () => products.critical())
  handle(IPC.productsSlowMoving, (opts: Parameters<typeof products.slowMoving>[0]) =>
    products.slowMoving(opts),
  )
  handle(IPC.categoriesRename, (from: string, to: string) => ({
    updated: products.renameCategory(from, to),
  }))
  handle(IPC.categoriesCrud, () => categoriesRepo.list())
  handle(IPC.categoriesSaveMeta, (input: Parameters<typeof categoriesRepo.save>[0]) =>
    categoriesRepo.save(input),
  )
  handle(IPC.categoriesRemove, (id: string, opts?: { reassignTo?: string | null }) => {
    categoriesRepo.remove(id, opts)
  })
  handle(IPC.productsBulkPrice, (filter: Parameters<typeof products.bulkPriceChange>[0]) =>
    products.bulkPriceChange(filter),
  )

  handle(IPC.heldTicketsList, () => heldTicketsRepo.list())
  handle(IPC.heldTicketsSave, (input: Parameters<typeof heldTicketsRepo.save>[0]) =>
    heldTicketsRepo.save(input),
  )
  handle(IPC.heldTicketsRemove, (id: string) => {
    heldTicketsRepo.remove(id)
  })
  handle(IPC.heldTicketsClear, () => {
    heldTicketsRepo.clear()
  })

  handle(IPC.promotionsList, (includeInactive?: boolean) => promotions.list(!!includeInactive))
  handle(IPC.promotionsSave, (input: Parameters<typeof promotions.save>[0]) =>
    promotions.save(input),
  )
  handle(IPC.promotionsDelete, (id: string) => {
    promotions.remove(id)
  })
  handle(IPC.promotionsCompute, (items: Parameters<typeof promotions.computeForCart>[0]) =>
    promotions.computeForCart(items),
  )

  handle(IPC.usersList, (includeInactive?: boolean) => users.list(!!includeInactive))
  handle(IPC.usersSave, (input: Parameters<typeof users.save>[0]) => users.save(input))
  handle(IPC.usersDelete, (id: string) => {
    users.remove(id)
  })
  handle(IPC.usersVerifyPin, (id: string, pin: string) => users.verifyPin(id, pin))
  handle(IPC.usersCount, () => users.count())

  // sales:create es el flujo crítico — agregamos logging breve en
  // entrada/salida para diagnosticar problemas en producción. El error
  // humanization sale por handle() como cualquier otro.
  handle(IPC.salesCreate, (input: Parameters<typeof sales.create>[0]) => {
    console.log('[sales:create] payload', {
      items: input.items.map((i) => ({
        product_id: i.product_id,
        qty: i.qty,
        price: i.price,
      })),
      discount: input.discount,
      payments: input.payments,
    })
    const result = sales.create(input)
    console.log('[sales:create] ok', {
      id: result.id,
      number: result.number,
      total: result.total,
    })
    return result
  })
  handle(IPC.salesList, (q?: Parameters<typeof sales.list>[0]) => sales.list(q ?? {}))
  handle(IPC.salesGet, (id: string) => sales.getById(id))
  handle(IPC.salesVoid, (id: string, reason: string) => {
    sales.voidSale(id, reason)
  })
  handle(IPC.salesNextNumber, () => sales.nextNumber())
  handle(
    IPC.salesReturnItems,
    (saleId: string, returns: { product_id: string; qty: number }[], reason: string) =>
      sales.returnItems(saleId, returns, reason),
  )

  handle(IPC.cashCurrent, () => cash.current())
  handle(
    IPC.cashOpen,
    (amt: number, notes?: string, cashierId?: string | null) =>
      cash.open(amt, notes, cashierId ?? null),
  )
  handle(
    IPC.cashClose,
    (amt: number, notes?: string, cashierId?: string | null) =>
      cash.close(amt, notes, cashierId ?? null),
  )
  handle(
    IPC.cashMove,
    (
      kind: 'withdraw' | 'deposit' | 'adjustment',
      amt: number,
      note: string,
      cashierId?: string | null,
    ) => cash.move(kind, amt, note, cashierId ?? null),
  )
  handle(IPC.cashMovements, (sessionId: string) => cash.movements(sessionId))
  handle(IPC.cashSummary, (sessionId: string) => cash.summary(sessionId))
  handle(IPC.cashZReport, (sessionId: string) => cash.buildZReport(sessionId))
  handle(IPC.cashHistory, (opts?: Parameters<typeof cash.history>[0]) =>
    cash.history(opts),
  )
  handleSafe(IPC.printZReport, async (sessionId: string) => {
    const z = cash.buildZReport(sessionId)
    const s = settingsRepo.getAll()
    await printZReportHw(z, s.store, s.printer)
  })

  handle(IPC.reportDaily, (date: string) => reports.daily(date))
  handle(IPC.reportRange, (from: string, to: string) => reports.range(from, to))

  handle(IPC.settingsGet, () => settingsRepo.getAll())
  handle(IPC.settingsSet, (patch: Parameters<typeof settingsRepo.setPatch>[0]) =>
    settingsRepo.setPatch(patch),
  )

  handle(IPC.printerList, () => listSystemPrinters())
  handleSafe(IPC.printerTest, async () => {
    const s = settingsRepo.getAll()
    await printTest(s.printer, s.store)
  })
  handleSafe(IPC.printerOpenDrawer, async () => {
    const s = settingsRepo.getAll()
    await openDrawer(s.printer)
  })
  handleSafe(IPC.printReceipt, async (saleId: string) => {
    const sale = sales.getById(saleId)
    if (!sale) throw new Error('Venta no encontrada')
    const s = settingsRepo.getAll()
    await printReceiptHw(sale, s.store, s.printer, s.receipt_template)
  })
  handleSafe(IPC.printLowStock, async () => {
    const list = products.critical()
    const s = settingsRepo.getAll()
    await printLowStockHw(list, s.store, s.printer)
  })
  handleSafe(IPC.printSlowMoving, async (days: number) => {
    const list = products.slowMoving({ days })
    const s = settingsRepo.getAll()
    await printSlowMovingHw(list, days, s.store, s.printer)
  })

  handle(IPC.backupExport, () => exportBackup())
  handle(IPC.backupImport, () => importBackup())
  handleSafe(IPC.backupRunAuto, async () => {
    const r = await import('./utils/autoBackup')
    return r.maybeRunAutoBackup()
  })
  handle(IPC.backupAutoDir, async () => {
    const r = await import('./utils/autoBackup')
    return r.getAutoBackupDir()
  })

  handle(IPC.appInfo, () => ({
    version: app.getVersion(),
    dbPath: getDbPath(),
    userDataPath: app.getPath('userData'),
  }))
}
