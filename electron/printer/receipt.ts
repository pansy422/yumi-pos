import type { ThermalPrinter } from 'node-thermal-printer'
import type { SaleWithItems, StoreSettings } from '../../shared/types'
import { formatCLP } from '../../shared/money'

const PAYMENT_LABEL: Record<string, string> = {
  efectivo: 'EFECTIVO',
  debito: 'DÉBITO',
  credito: 'CRÉDITO',
  transferencia: 'TRANSFERENCIA',
  otro: 'OTRO',
}

function pad(left: string, right: string, width: number): string {
  const space = Math.max(1, width - left.length - right.length)
  return left + ' '.repeat(space) + right
}

export function formatReceipt(
  tp: ThermalPrinter,
  sale: SaleWithItems,
  store: StoreSettings,
  width: number,
): void {
  const w = width > 0 ? width : 32
  tp.alignCenter()
  tp.bold(true)
  tp.setTextDoubleHeight()
  tp.println(store.name || 'Yumi POS')
  tp.setTextNormal()
  tp.bold(false)
  if (store.address) tp.println(store.address)
  if (store.rut) tp.println(`RUT: ${store.rut}`)
  if (store.phone) tp.println(`Tel: ${store.phone}`)
  tp.drawLine()

  tp.alignLeft()
  const date = new Date(sale.completed_at).toLocaleString('es-CL')
  tp.println(`Boleta N° ${sale.number}`)
  tp.println(date)
  tp.drawLine()

  for (const it of sale.items) {
    tp.println(it.name_snapshot)
    tp.println(
      pad(
        `  ${it.qty} x ${formatCLP(it.price_snapshot)}`,
        formatCLP(it.line_total),
        w,
      ),
    )
  }

  tp.drawLine()
  tp.println(pad('Subtotal', formatCLP(sale.subtotal), w))
  if (sale.discount > 0) tp.println(pad('Descuento', '-' + formatCLP(sale.discount), w))
  tp.bold(true)
  tp.setTextDoubleHeight()
  tp.println(pad('TOTAL', formatCLP(sale.total), Math.max(16, Math.floor(w / 2))))
  tp.setTextNormal()
  tp.bold(false)
  tp.drawLine()

  tp.println(pad('Pago', PAYMENT_LABEL[sale.payment_method] ?? sale.payment_method, w))
  if (sale.payment_method === 'efectivo' && sale.cash_received != null) {
    tp.println(pad('Recibido', formatCLP(sale.cash_received), w))
    tp.println(pad('Vuelto', formatCLP(sale.change_given ?? 0), w))
  }
  tp.newLine()
  tp.alignCenter()
  if (store.receipt_footer) tp.println(store.receipt_footer)
  tp.newLine()
}

export function formatTestPage(tp: ThermalPrinter, store: StoreSettings, width: number): void {
  const w = width > 0 ? width : 32
  tp.alignCenter()
  tp.bold(true)
  tp.println('PRUEBA DE IMPRESIÓN')
  tp.bold(false)
  tp.println(store.name || 'Yumi POS')
  tp.drawLine()
  tp.alignLeft()
  tp.println(pad('Ancho', `${w} chars`, w))
  tp.println(pad('Fecha', new Date().toLocaleString('es-CL'), w))
  tp.println(pad('Estado', 'OK', w))
  tp.newLine()
  tp.alignCenter()
  tp.println('Si lees esto, la impresora funciona.')
  tp.newLine()
}
