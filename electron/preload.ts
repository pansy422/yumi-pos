import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'

const invoke = (ch: string) => (...args: unknown[]) => ipcRenderer.invoke(ch, ...args)

const api = {
  productsList: invoke(IPC.productsList),
  productsGet: invoke(IPC.productsGet),
  productsByBarcode: invoke(IPC.productsByBarcode),
  productsCreate: invoke(IPC.productsCreate),
  productsUpdate: invoke(IPC.productsUpdate),
  productsArchive: invoke(IPC.productsArchive),
  productsScanIn: invoke(IPC.productsScanIn),
  productsAdjustStock: invoke(IPC.productsAdjustStock),
  productsImport: invoke(IPC.productsImport),
  categoriesList: invoke(IPC.categoriesList),
  categoriesRename: invoke(IPC.categoriesRename),

  salesCreate: invoke(IPC.salesCreate),
  salesList: invoke(IPC.salesList),
  salesGet: invoke(IPC.salesGet),
  salesVoid: invoke(IPC.salesVoid),
  salesNextNumber: invoke(IPC.salesNextNumber),

  cashCurrent: invoke(IPC.cashCurrent),
  cashOpen: invoke(IPC.cashOpen),
  cashClose: invoke(IPC.cashClose),
  cashMove: invoke(IPC.cashMove),
  cashMovements: invoke(IPC.cashMovements),
  cashSummary: invoke(IPC.cashSummary),
  cashZReport: invoke(IPC.cashZReport),
  printZReport: invoke(IPC.printZReport),

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

  appInfo: invoke(IPC.appInfo),
}

contextBridge.exposeInMainWorld('api', api)
