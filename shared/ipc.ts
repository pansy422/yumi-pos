export const IPC = {
  productsList: 'products:list',
  productsGet: 'products:get',
  productsByBarcode: 'products:byBarcode',
  productsCreate: 'products:create',
  productsUpdate: 'products:update',
  productsArchive: 'products:archive',
  productsDelete: 'products:delete',
  productsReactivate: 'products:reactivate',
  productsScanIn: 'products:scanIn',
  productsAdjustStock: 'products:adjustStock',
  productsImport: 'products:import',
  productsCritical: 'products:critical',
  categoriesRename: 'categories:rename',
  categoriesCrud: 'categories:crud',
  categoriesSaveMeta: 'categories:saveMeta',
  categoriesRemove: 'categories:remove',
  productsBulkPrice: 'products:bulkPrice',

  heldTicketsList: 'heldTickets:list',
  heldTicketsSave: 'heldTickets:save',
  heldTicketsRemove: 'heldTickets:remove',
  heldTicketsClear: 'heldTickets:clear',

  promotionsList: 'promotions:list',
  promotionsSave: 'promotions:save',
  promotionsDelete: 'promotions:delete',
  promotionsCompute: 'promotions:compute',

  usersList: 'users:list',
  usersSave: 'users:save',
  usersDelete: 'users:delete',
  usersVerifyPin: 'users:verifyPin',
  usersCount: 'users:count',

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
