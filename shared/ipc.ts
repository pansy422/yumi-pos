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
  productsCritical: 'products:critical',
  categoriesList: 'categories:list',
  categoriesRename: 'categories:rename',

  salesCreate: 'sales:create',
  salesList: 'sales:list',
  salesGet: 'sales:get',
  salesVoid: 'sales:void',
  salesNextNumber: 'sales:nextNumber',
  salesReturnItems: 'sales:returnItems',

  cashCurrent: 'cash:current',
  cashOpen: 'cash:open',
  cashClose: 'cash:close',
  cashMove: 'cash:move',
  cashMovements: 'cash:movements',
  cashSummary: 'cash:summary',
  cashZReport: 'cash:zreport',
  printZReport: 'printer:zreport',
  printLowStock: 'printer:lowStock',

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
  backupRunAuto: 'backup:runAuto',
  backupAutoDir: 'backup:autoDir',

  appInfo: 'app:info',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
