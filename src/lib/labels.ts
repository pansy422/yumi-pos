import type {
  CashFundMovementKind,
  PaymentMethod,
  PurchasePaymentMethod,
  StockMovementKind,
  WriteoffReason,
} from '@shared/types'

/** Etiquetas en español para los enums que se muestran en pantalla. */

export const STOCK_KIND_LABEL: Record<StockMovementKind, string> = {
  sale: 'Venta',
  return: 'Devolución',
  entry: 'Ingreso',
  writeoff: 'Merma',
  manual: 'Ajuste manual',
  archive: 'Archivado / reactivado',
}

export const PAY_LABEL: Record<PaymentMethod | 'mixto', string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  credito: 'Crédito',
  transferencia: 'Transferencia',
  otro: 'Otro',
  mixto: 'Mixto',
}

export const PURCHASE_PAY_LABEL: Record<PurchasePaymentMethod, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  debito: 'Débito',
  credito: 'Crédito',
}

export const WRITEOFF_REASON_LABEL: Record<WriteoffReason, string> = {
  vencido: 'Vencido',
  dañado: 'Dañado',
  consumo: 'Consumo propio',
  robo: 'Robo',
  conteo: 'Diferencia de conteo',
  otro: 'Otro',
}

export const FUND_KIND_LABEL: Record<CashFundMovementKind, string> = {
  in_from_register: 'Retiro de caja al fondo',
  out_supplier: 'Pago a proveedor',
  out_expense: 'Gasto',
  out_owner: 'Retiro del dueño',
  out_transfer_swap: 'Cambio por transferencia',
  adjustment: 'Ajuste por conteo',
}
