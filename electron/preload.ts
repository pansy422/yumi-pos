import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'

/**
 * Electron envuelve los errores de ipcMain.handle con un prefijo feo:
 *   "Error invoking remote method 'foo:bar': Error: <mensaje real>"
 * Aquí en el preload limpiamos ese prefijo para que la UI reciba SOLO
 * el mensaje en español que devuelve nuestro humanize() en el main.
 */
function cleanInvokeError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err)
  const clean = raw
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^Error:\s*/, '')
  return new Error(clean)
}

const invoke =
  (ch: string) =>
  async (...args: unknown[]) => {
    try {
      return await ipcRenderer.invoke(ch, ...args)
    } catch (err) {
      throw cleanInvokeError(err)
    }
  }

const api = {
  productsList: invoke(IPC.productsList),
  productsGet: invoke(IPC.productsGet),
  productsByBarcode: invoke(IPC.productsByBarcode),
  productsCreate: invoke(IPC.productsCreate),
  productsUpdate: invoke(IPC.productsUpdate),
  productsArchive: invoke(IPC.productsArchive),
  productsDelete: invoke(IPC.productsDelete),
  productsReactivate: invoke(IPC.productsReactivate),
  productsScanIn: invoke(IPC.productsScanIn),
  productsAdjustStock: invoke(IPC.productsAdjustStock),
  productsImport: invoke(IPC.productsImport),
  productsCritical: invoke(IPC.productsCritical),
  categoriesList: invoke(IPC.categoriesList),
  categoriesRename: invoke(IPC.categoriesRename),

  promotionsList: invoke(IPC.promotionsList),
  promotionsSave: invoke(IPC.promotionsSave),
  promotionsDelete: invoke(IPC.promotionsDelete),
  promotionsCompute: invoke(IPC.promotionsCompute),

  usersList: invoke(IPC.usersList),
  usersSave: invoke(IPC.usersSave),
  usersDelete: invoke(IPC.usersDelete),
  usersVerifyPin: invoke(IPC.usersVerifyPin),
  usersCount: invoke(IPC.usersCount),

  salesCreate: invoke(IPC.salesCreate),
  salesList: invoke(IPC.salesList),
  salesGet: invoke(IPC.salesGet),
  salesVoid: invoke(IPC.salesVoid),
  salesNextNumber: invoke(IPC.salesNextNumber),
  salesReturnItems: invoke(IPC.salesReturnItems),

  cashCurrent: invoke(IPC.cashCurrent),
  cashOpen: invoke(IPC.cashOpen),
  cashClose: invoke(IPC.cashClose),
  cashMove: invoke(IPC.cashMove),
  cashMovements: invoke(IPC.cashMovements),
  cashSummary: invoke(IPC.cashSummary),
  cashZReport: invoke(IPC.cashZReport),
  printZReport: invoke(IPC.printZReport),
  printLowStock: invoke(IPC.printLowStock),

  reportDaily: invoke(IPC.reportDaily),
  reportRange: invoke(IPC.reportRange),

  settingsGet: invoke(IPC.settingsGet),
  settingsSet: invoke(IPC.settingsSet),

  printerList: invoke(IPC.printerList),
  printerTest: invoke(IPC.printerTest),
  printerOpenDrawer: invoke(IPC.printerOpenDrawer),
  printReceipt: invoke(IPC.printReceipt),

  backupExport: invoke(IPC.backupExport),
  backupImport: invoke(IPC.backupImport),
  backupRunAuto: invoke(IPC.backupRunAuto),
  backupAutoDir: invoke(IPC.backupAutoDir),

  appInfo: invoke(IPC.appInfo),
}

contextBridge.exposeInMainWorld('api', api)
