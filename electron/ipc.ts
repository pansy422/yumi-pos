import { app, ipcMain } from 'electron'
import { IPC } from '../shared/ipc'
import type { Result } from '../shared/types'
import * as products from './db/products'
import * as sales from './db/sales'
import * as cash from './db/cashSessions'
import * as reports from './db/reports'
import * as settingsRepo from './db/settings'
import { exportBackup, importBackup } from './utils/backup'
import { listSystemPrinters } from './utils/printersList'
import {
  openDrawer,
  printReceipt as printReceiptHw,
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

function safe<T>(fn: () => Promise<T> | T): Promise<Result<T>> {
  return Promise.resolve()
    .then(fn)
    .then((data) => ({ ok: true as const, data }))
    .catch((err: unknown) => {
      console.error('[IPC safe] error:', err)
      return { ok: false as const, error: humanize(err) }
    })
}

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
  handle(IPC.productsScanIn, (barcode: string, opts?: Parameters<typeof products.scanIn>[1]) =>
    products.scanIn(barcode, opts),
  )
  handle(IPC.productsAdjustStock, (id: string, delta: number, note?: string) =>
    products.adjustStock(id, delta, note),
  )
  handle(IPC.productsImport, (rows: Parameters<typeof products.importMany>[0]) =>
    products.importMany(rows),
  )
  handle(IPC.categoriesList, () => products.categories())
  handle(IPC.categoriesRename, (from: string, to: string) => ({
    updated: products.renameCategory(from, to),
  }))

  // Logging extra para sales:create — es el flujo crítico.
  ipcMain.handle(IPC.salesCreate, async (_e, input: Parameters<typeof sales.create>[0]) => {
    try {
      const itemsBrief = input.items.map((i) => ({
        product_id: i.product_id,
        qty: i.qty,
        price: i.price,
      }))
      console.log('[sales:create] payload', {
        items: itemsBrief,
        discount: input.discount,
        payment_method: input.payment_method,
        cash_received: input.cash_received,
      })
      const result = sales.create(input)
      console.log('[sales:create] ok', { id: result.id, number: result.number, total: result.total })
      return result
    } catch (err) {
      console.error('[sales:create] failed:', err)
      throw new Error(humanize(err))
    }
  })
  handle(IPC.salesList, (q?: Parameters<typeof sales.list>[0]) => sales.list(q ?? {}))
  handle(IPC.salesGet, (id: string) => sales.getById(id))
  handle(IPC.salesVoid, (id: string, reason: string) => {
    sales.voidSale(id, reason)
  })

  handle(IPC.cashCurrent, () => cash.current())
  handle(IPC.cashOpen, (amt: number, notes?: string) => cash.open(amt, notes))
  handle(IPC.cashClose, (amt: number, notes?: string) => cash.close(amt, notes))
  handle(IPC.cashMove, (kind: 'withdraw' | 'deposit' | 'adjustment', amt: number, note: string) =>
    cash.move(kind, amt, note),
  )
  handle(IPC.cashMovements, (sessionId: string) => cash.movements(sessionId))
  handle(IPC.cashSummary, (sessionId: string) => cash.summary(sessionId))
  handle(IPC.cashZReport, (sessionId: string) => cash.buildZReport(sessionId))
  ipcMain.handle(IPC.printZReport, (_e, sessionId: string) =>
    safe(async () => {
      const z = cash.buildZReport(sessionId)
      const s = settingsRepo.getAll()
      await printZReportHw(z, s.store, s.printer)
    }),
  )

  handle(IPC.reportDaily, (date: string) => reports.daily(date))
  handle(IPC.reportRange, (from: string, to: string) => reports.range(from, to))

  handle(IPC.settingsGet, () => settingsRepo.getAll())
  handle(IPC.settingsSet, (patch: Parameters<typeof settingsRepo.setPatch>[0]) =>
    settingsRepo.setPatch(patch),
  )

  handle(IPC.printerList, () => listSystemPrinters())
  ipcMain.handle(IPC.printerTest, () =>
    safe(async () => {
      const s = settingsRepo.getAll()
      await printTest(s.printer, s.store)
    }),
  )
  ipcMain.handle(IPC.printerOpenDrawer, () =>
    safe(async () => {
      const s = settingsRepo.getAll()
      await openDrawer(s.printer)
    }),
  )
  ipcMain.handle(IPC.printReceipt, (_e, saleId: string) =>
    safe(async () => {
      const sale = sales.getById(saleId)
      if (!sale) throw new Error('Venta no encontrada')
      const s = settingsRepo.getAll()
      await printReceiptHw(sale, s.store, s.printer, s.receipt_template)
    }),
  )

  handle(IPC.backupExport, () => exportBackup())
  handle(IPC.backupImport, () => importBackup())

  handle(IPC.appInfo, () => ({
    version: app.getVersion(),
    dbPath: getDbPath(),
    userDataPath: app.getPath('userData'),
  }))
}
