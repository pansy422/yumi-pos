export const IPC = {
  productsList: 'products:list',
  productsGet: 'products:get',
  productsByBarcode: 'products:byBarcode',
  productsCreate: 'products:create',
  productsUpdate: 'products:update',
  productsArchive: 'products:archive',
  productsScanIn: 'products:scanIn',
  productsAdjustStock: 'products:adjustStock',
  productsImport: 'products:import',

  salesCreate: 'sales:create',
  salesList: 'sales:list',
  salesGet: 'sales:get',
  salesVoid: 'sales:void',

  cashCurrent: 'cash:current',
  cashOpen: 'cash:open',
  cashClose: 'cash:close',
  cashMove: 'cash:move',
  cashMovements: 'cash:movements',
  cashSummary: 'cash:summary',

  reportDaily: 'report:daily',
  reportRange: 'report:range',

  settingsGet: 'settings:get',
  settingsSet: 'settings:set',

  printerList: 'printer:list',
  printerTest: 'printer:test',
  printerOpenDrawer: 'printer:openDrawer',
  printReceipt: 'printer:receipt',

  backupExport: 'backup:export',
  backupImport: 'backup:import',

  appInfo: 'app:info',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
