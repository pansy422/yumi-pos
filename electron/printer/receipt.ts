import type { ThermalPrinter } from 'node-thermal-printer'
import type { SaleWithItems, StoreSettings } from '../../shared/types'
import { formatCLP } from '../../shared/money'

const PAYMENT_LABEL: Record<string, string> = {
  efectivo: 'EFECTIVO',
  debito: 'DEBITO',
  credito: 'CREDITO',
  transferencia: 'TRANSFERENCIA',
  otro: 'OTRO',
}

function visibleLength(s: string): number {
  return s.length
}

function pad(left: string, right: string, width: number): string {
  const space = Math.max(1, width - visibleLength(left) - visibleLength(right))
  return left + ' '.repeat(space) + right
}

function wrap(text: string, width: number): string[] {
  if (text.length <= width) return [text]
  const out: string[] = []
  let cur = ''
  for (const word of text.split(/\s+/)) {
    if (!cur) {
      cur = word
    } else if (cur.length + 1 + word.length <= width) {
      cur += ' ' + word
    } else {
      out.push(cur)
      cur = word
    }
    while (cur.length > width) {
      out.push(cur.slice(0, width))
      cur = cur.slice(width)
    }
  }
  if (cur) out.push(cur)
  return out
}

export function formatReceipt(
  tp: ThermalPrinter,
  sale: SaleWithItems,
  store: StoreSettings,
  width: number,
): void {
  const w = width > 0 ? width : 42

  tp.alignCenter()
  tp.bold(true)
  tp.setTextDoubleHeight()
  tp.println(store.name || 'Yumi POS')
  tp.setTextNormal()
  tp.bold(false)
  if (store.address) {
    for (const line of wrap(store.address, w)) tp.println(line)
  }
  if (store.rut) tp.println(`RUT: ${store.rut}`)
  if (store.phone) tp.println(`Tel: ${store.phone}`)
  tp.drawLine()

  tp.alignLeft()
  const date = new Date(sale.completed_at).toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  tp.println(pad(`Boleta N° ${sale.number}`, date, w))
  tp.drawLine()

  for (const it of sale.items) {
    for (const line of wrap(it.name_snapshot, w)) tp.println(line)
    const qtyLine = `  ${it.qty} x ${formatCLP(it.price_snapshot)}`
    tp.println(pad(qtyLine, formatCLP(it.line_total), w))
  }

  tp.drawLine()
  tp.println(pad('Subtotal', formatCLP(sale.subtotal), w))
  if (sale.discount > 0) tp.println(pad('Descuento', '-' + formatCLP(sale.discount), w))
  tp.bold(true)
  tp.setTextDoubleHeight()
  tp.println(pad('TOTAL', formatCLP(sale.total), Math.floor(w / 2)))
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
  if (store.receipt_footer) {
    for (const line of wrap(store.receipt_footer, w)) tp.println(line)
  }
  tp.println(`#${sale.number}`)
  tp.newLine()
  tp.newLine()
}

export function formatTestPage(tp: ThermalPrinter, store: StoreSettings, width: number): void {
  const w = width > 0 ? width : 42
  tp.alignCenter()
  tp.bold(true)
  tp.setTextDoubleHeight()
  tp.println('PRUEBA DE IMPRESION')
  tp.setTextNormal()
  tp.bold(false)
  tp.println(store.name || 'Yumi POS')
  tp.drawLine()
  tp.alignLeft()
  tp.println(pad('Ancho', `${w} chars`, w))
  tp.println(pad('Codepage', 'PC850', w))
  tp.println(
    pad('Fecha', new Date().toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }), w),
  )
  tp.println(pad('Estado', 'OK', w))
  tp.newLine()
  tp.println('Acentos: cañón añejo cielo niño')
  tp.newLine()
  tp.alignCenter()
  tp.bold(true)
  tp.println('Si lees esto, la impresora funciona.')
  tp.bold(false)
  tp.newLine()
  tp.newLine()
}
