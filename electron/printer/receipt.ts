import type { ThermalPrinter } from 'node-thermal-printer'
import type { Align, ReceiptTemplate, RenderedLine, Size } from '../../shared/template'
import { DEFAULT_TEMPLATE, pad, renderTemplate } from '../../shared/template'
import { formatCLP, formatWeight } from '../../shared/money'
import type { Product, SaleWithItems, StoreSettings } from '../../shared/types'

function applyAlign(tp: ThermalPrinter, align: Align) {
  if (align === 'center') tp.alignCenter()
  else if (align === 'right') tp.alignRight()
  else tp.alignLeft()
}

function applySize(tp: ThermalPrinter, size: Size) {
  if (size === 'large') tp.setTextDoubleHeight()
  else if (size === 'xl') tp.setTextQuadArea()
  else tp.setTextNormal()
}

function emitLine(tp: ThermalPrinter, line: RenderedLine, width: number, lineCharFallback: string) {
  if (line.kind === 'sep') {
    tp.alignLeft()
    tp.setTextNormal()
    tp.bold(false)
    const ch = (line.char || lineCharFallback).slice(0, 1) || '-'
    tp.println(ch.repeat(width))
    return
  }
  if (line.kind === 'spacer') {
    tp.newLine()
    return
  }
  applyAlign(tp, line.align)
  if (line.bold) tp.bold(true)
  applySize(tp, line.size)

  // Width adjustment for sized text: large/xl take more pixels per char.
  // We pad based on logical width but then setTextDoubleHeight only doubles height,
  // setTextQuadArea doubles both. For simplicity we use full width for normal+large,
  // and half width for xl since chars are double width.
  const usableWidth = line.size === 'xl' ? Math.max(8, Math.floor(width / 2)) : width

  let text: string
  if (line.right != null) {
    text = pad(line.left, line.right, usableWidth)
  } else {
    text = line.left
  }
  tp.println(text)
  if (line.bold) tp.bold(false)
  tp.setTextNormal()
}

export function formatReceiptFromTemplate(
  tp: ThermalPrinter,
  sale: SaleWithItems,
  store: StoreSettings,
  template: ReceiptTemplate,
  width: number,
): void {
  const w = width > 0 ? width : 42
  const lines = renderTemplate(template, sale, store, w)
  for (const l of lines) emitLine(tp, l, w, '-')
}

export function formatReceipt(
  tp: ThermalPrinter,
  sale: SaleWithItems,
  store: StoreSettings,
  width: number,
  template?: ReceiptTemplate,
): void {
  formatReceiptFromTemplate(tp, sale, store, template ?? DEFAULT_TEMPLATE, width)
}

export function formatZReport(
  tp: ThermalPrinter,
  z: import('../../shared/types').ZReport,
  store: StoreSettings,
  width: number,
): void {
  const w = width > 0 ? width : 42
  const fmt = (n: number) =>
    '$' + Math.round(n).toLocaleString('es-CL', { useGrouping: true })

  tp.alignCenter()
  tp.bold(true)
  tp.setTextDoubleHeight()
  tp.println(store.name || 'Yumi POS')
  tp.setTextNormal()
  tp.bold(false)
  tp.println('CIERRE DE CAJA')
  tp.println('---- INFORME Z ----')
  if (store.rut) tp.println(`RUT: ${store.rut}`)
  tp.println('-'.repeat(w))

  tp.alignLeft()
  const opened = new Date(z.session.opened_at).toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const closed = z.session.closed_at
    ? new Date(z.session.closed_at).toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-'
  tp.println(pad('Apertura', opened, w))
  if (z.session.opened_by_name) {
    tp.println(pad('Abierta por', z.session.opened_by_name, w))
  }
  tp.println(pad('Cierre', closed, w))
  if (z.session.closed_by_name) {
    tp.println(pad('Cerrada por', z.session.closed_by_name, w))
  }
  tp.println(pad('Apertura $', fmt(z.summary.opening), w))
  tp.println('-'.repeat(w))

  tp.bold(true)
  tp.println(pad('Ventas', String(z.summary.sales_count) + ' boletas', w))
  tp.bold(false)
  for (const bp of z.by_payment) {
    const label =
      bp.method === 'efectivo'
        ? 'Efectivo'
        : bp.method === 'debito'
          ? 'Debito'
          : bp.method === 'credito'
            ? 'Credito'
            : bp.method === 'transferencia'
              ? 'Transferencia'
              : 'Otro'
    tp.println(pad(`  ${label} (${bp.count})`, fmt(bp.total), w))
  }
  tp.println(pad('Total ventas', fmt(z.summary.gross_sales), w))
  if (z.voided_count > 0) {
    tp.println(pad(`Anuladas (${z.voided_count})`, '-' + fmt(z.voided_total), w))
  }
  tp.println('-'.repeat(w))

  tp.println(pad('Depositos', '+' + fmt(z.summary.deposits), w))
  tp.println(pad('Retiros', '-' + fmt(z.summary.withdraws), w))
  if (z.summary.adjustments !== 0) {
    const sign = z.summary.adjustments >= 0 ? '+' : '-'
    tp.println(pad('Ajustes', sign + fmt(Math.abs(z.summary.adjustments)), w))
  }
  tp.println('-'.repeat(w))

  tp.bold(true)
  tp.println(pad('Esperado', fmt(z.summary.expected), w))
  tp.bold(false)
  if (z.session.counted_close != null) {
    tp.println(pad('Contado', fmt(z.session.counted_close), w))
    tp.bold(true)
    tp.setTextDoubleHeight()
    tp.println(pad('DIFERENCIA', fmt(z.session.difference ?? 0), Math.floor(w / 2)))
    tp.setTextNormal()
    tp.bold(false)
  }
  tp.println('-'.repeat(w))
  if (z.session.notes) {
    tp.alignLeft()
    tp.println('Notas:')
    for (const line of (z.session.notes.match(/.{1,42}/g) ?? [z.session.notes])) {
      tp.println(line)
    }
  }
  tp.newLine()
  tp.alignCenter()
  tp.println(`Sesion ${z.session.id.slice(0, 8)}`)
  tp.newLine()
  tp.newLine()
}

export function formatLowStockReport(
  tp: ThermalPrinter,
  products: Product[],
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
  tp.println('REPOSICION DE STOCK')
  tp.println(
    new Date().toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  )
  tp.println('-'.repeat(w))

  if (products.length === 0) {
    tp.alignCenter()
    tp.println('Sin productos críticos')
    tp.newLine()
    tp.newLine()
    return
  }

  tp.alignLeft()
  tp.bold(true)
  tp.println(pad('Producto', 'Stock / Min', w))
  tp.bold(false)
  tp.println('-'.repeat(w))

  for (const p of products) {
    const left = p.name.length > w - 14 ? p.name.slice(0, w - 14) : p.name
    const stock = p.is_weight === 1 ? formatWeight(p.stock) : String(p.stock)
    const min = p.is_weight === 1 ? formatWeight(p.stock_min) : String(p.stock_min)
    tp.println(pad(left, `${stock} / ${min}`, w))
    if (p.barcode) {
      tp.println(`  ${p.barcode}`)
    }
  }

  tp.println('-'.repeat(w))
  tp.println(pad('Total productos', String(products.length), w))
  const valor = products.reduce(
    (a, p) => a + (p.is_weight === 1 ? Math.round((p.cost * p.stock_min) / 1000) : p.cost * p.stock_min),
    0,
  )
  if (valor > 0) {
    tp.println(pad('Costo aprox. reponer', formatCLP(valor), w))
  }
  tp.newLine()
  tp.newLine()
}

export function formatSlowMovingReport(
  tp: ThermalPrinter,
  products: import('../../shared/types').SlowMovingProduct[],
  store: StoreSettings,
  days: number,
  width: number,
): void {
  const w = width > 0 ? width : 42
  tp.alignCenter()
  tp.bold(true)
  tp.setTextDoubleHeight()
  tp.println(store.name || 'Yumi POS')
  tp.setTextNormal()
  tp.bold(false)
  tp.println('PRODUCTOS SIN ROTACION')
  tp.println(`Sin venta en ${days} dias`)
  tp.println(
    new Date().toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  )
  tp.println('-'.repeat(w))

  if (products.length === 0) {
    tp.alignCenter()
    tp.println('Todos los productos rotaron')
    tp.newLine()
    tp.newLine()
    return
  }

  tp.alignLeft()
  tp.bold(true)
  tp.println(pad('Producto', 'Ult. venta', w))
  tp.bold(false)
  tp.println('-'.repeat(w))

  for (const p of products) {
    const left = p.name.length > w - 12 ? p.name.slice(0, w - 12) : p.name
    const right =
      p.days_since_sold == null
        ? 'nunca'
        : p.days_since_sold === 0
          ? 'hoy'
          : `${p.days_since_sold}d`
    tp.println(pad(left, right, w))
    const stockStr = p.is_weight === 1 ? formatWeight(p.stock) : String(p.stock)
    tp.println(`  Stock ${stockStr} · ${formatCLP(p.stock_value)} inmovilizado`)
  }

  const totalValue = products.reduce((a, p) => a + p.stock_value, 0)
  tp.println('-'.repeat(w))
  tp.println(pad('Total productos', String(products.length), w))
  tp.println(pad('Valor inmovilizado', formatCLP(totalValue), w))
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
    pad(
      'Fecha',
      new Date().toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      w,
    ),
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
