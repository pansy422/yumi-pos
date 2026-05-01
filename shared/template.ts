import type { SaleWithItems, StoreSettings } from './types'
import { formatCLP, formatWeight } from './money'

export type Align = 'left' | 'center' | 'right'
export type Size = 'normal' | 'large' | 'xl'
export type ShowWhen = 'always' | 'cash' | 'has_discount' | 'has_change'

type BlockMeta = {
  id: string
  align?: Align
  bold?: boolean
  size?: Size
  show?: ShowWhen
}

export type ReceiptBlock = BlockMeta &
  (
    | { type: 'store_name' }
    | { type: 'address' }
    | { type: 'rut' }
    | { type: 'phone' }
    | { type: 'separator'; char?: string }
    | { type: 'spacer'; lines?: number }
    | { type: 'sale_number_and_date' }
    | { type: 'sale_number' }
    | { type: 'date' }
    | { type: 'items' }
    | { type: 'subtotal' }
    | { type: 'discount' }
    | { type: 'net_amount' }
    | { type: 'tax_amount' }
    | { type: 'total' }
    | { type: 'payment_method' }
    | { type: 'cash_received' }
    | { type: 'change_given' }
    | { type: 'cashier' }
    | { type: 'text'; value: string }
  )

export type ReceiptTemplate = {
  version: 1
  blocks: ReceiptBlock[]
}

export const BLOCK_LABELS: Record<ReceiptBlock['type'], string> = {
  store_name: 'Nombre tienda',
  address: 'Dirección',
  rut: 'RUT',
  phone: 'Teléfono',
  separator: 'Línea separadora',
  spacer: 'Espacio en blanco',
  sale_number_and_date: 'N° de boleta + fecha',
  sale_number: 'N° de boleta',
  date: 'Fecha',
  items: 'Productos del ticket',
  subtotal: 'Subtotal',
  discount: 'Descuento',
  net_amount: 'Neto (sin IVA)',
  tax_amount: 'IVA',
  total: 'TOTAL',
  payment_method: 'Método de pago',
  cash_received: 'Recibido (efectivo)',
  change_given: 'Vuelto (efectivo)',
  cashier: 'Atendido por (cajero)',
  text: 'Texto libre',
}

export const DEFAULT_TEMPLATE: ReceiptTemplate = {
  version: 1,
  blocks: [
    { id: 'b_name', type: 'store_name', align: 'center', bold: true, size: 'large' },
    { id: 'b_sep1', type: 'separator' },
    { id: 'b_num_date', type: 'sale_number_and_date' },
    { id: 'b_sep2', type: 'separator' },
    { id: 'b_items', type: 'items' },
    { id: 'b_sep3', type: 'separator' },
    { id: 'b_sub', type: 'subtotal' },
    { id: 'b_disc', type: 'discount', show: 'has_discount' },
    { id: 'b_total', type: 'total', bold: true, size: 'large' },
    { id: 'b_sep4', type: 'separator' },
    { id: 'b_pm', type: 'payment_method' },
    { id: 'b_rec', type: 'cash_received', show: 'cash' },
    { id: 'b_chg', type: 'change_given', show: 'cash' },
    { id: 'b_sp1', type: 'spacer', lines: 1 },
    { id: 'b_thanks', type: 'text', value: 'Gracias por tu compra', align: 'center', bold: true },
    { id: 'b_footer', type: 'text', value: '{{footer}}', align: 'center' },
    { id: 'b_doctype', type: 'text', value: 'COMPROBANTE DE VENTA', align: 'center' },
    { id: 'b_sp2', type: 'spacer', lines: 2 },
  ],
}

export const PRESETS: { id: string; label: string; description: string; template: ReceiptTemplate }[] = [
  {
    id: 'default',
    label: 'Estándar',
    description: 'Cabecera con datos de tienda, ítems, totales, pago y pie',
    template: DEFAULT_TEMPLATE,
  },
  {
    id: 'compact',
    label: 'Compacta',
    description: 'Lo mínimo: tienda, ítems, total y pago',
    template: {
      version: 1,
      blocks: [
        { id: 'c_name', type: 'store_name', align: 'center', bold: true, size: 'large' },
        { id: 'c_sep', type: 'separator' },
        { id: 'c_num', type: 'sale_number_and_date' },
        { id: 'c_items', type: 'items' },
        { id: 'c_sep2', type: 'separator' },
        { id: 'c_total', type: 'total', bold: true, size: 'xl', align: 'right' },
        { id: 'c_pm', type: 'payment_method', align: 'right' },
        { id: 'c_chg', type: 'change_given', show: 'cash', align: 'right' },
        { id: 'c_doctype', type: 'text', value: 'COMPROBANTE DE VENTA', align: 'center' },
        { id: 'c_sp', type: 'spacer', lines: 2 },
      ],
    },
  },
  {
    id: 'with_iva',
    label: 'Con desglose IVA',
    description: 'Estándar mostrando Neto, IVA 19% y TOTAL',
    template: {
      version: 1,
      blocks: [
        { id: 'i_name', type: 'store_name', align: 'center', bold: true, size: 'large' },
        { id: 'i_sep1', type: 'separator' },
        { id: 'i_num', type: 'sale_number_and_date' },
        { id: 'i_sep2', type: 'separator' },
        { id: 'i_items', type: 'items' },
        { id: 'i_sep3', type: 'separator' },
        { id: 'i_disc', type: 'discount', show: 'has_discount' },
        { id: 'i_net', type: 'net_amount' },
        { id: 'i_tax', type: 'tax_amount' },
        { id: 'i_total', type: 'total', bold: true, size: 'large' },
        { id: 'i_sep4', type: 'separator' },
        { id: 'i_pm', type: 'payment_method' },
        { id: 'i_rec', type: 'cash_received', show: 'cash' },
        { id: 'i_chg', type: 'change_given', show: 'cash' },
        { id: 'i_sp1', type: 'spacer', lines: 1 },
        { id: 'i_thanks', type: 'text', value: 'Gracias por tu compra', align: 'center', bold: true },
        { id: 'i_foot', type: 'text', value: '{{footer}}', align: 'center' },
        { id: 'i_doctype', type: 'text', value: 'COMPROBANTE DE VENTA', align: 'center' },
        { id: 'i_sp2', type: 'spacer', lines: 2 },
      ],
    },
  },
  {
    id: 'with_message',
    label: 'Con mensaje',
    description: 'Estándar con frase destacada al final',
    template: {
      version: 1,
      blocks: [
        ...DEFAULT_TEMPLATE.blocks.filter((b) => b.id !== 'b_sp2'),
        { id: 'm_sep', type: 'separator', char: '*' },
        { id: 'm_msg1', type: 'text', value: 'Llévate cualquier bebida 2x1', align: 'center', bold: true },
        { id: 'm_msg2', type: 'text', value: 'solo presentando esta boleta', align: 'center' },
        { id: 'm_sep2', type: 'separator', char: '*' },
        { id: 'b_sp2', type: 'spacer', lines: 2 },
      ],
    },
  },
]

export type RenderVars = Record<string, string>

export function computeTax(sale: SaleWithItems, store: StoreSettings): { net: number; tax: number; rate: number } {
  const rate = Math.max(0, Number(store.tax_rate ?? 0))
  if (rate === 0) return { net: sale.total, tax: 0, rate }
  if (store.tax_inclusive ?? true) {
    const net = Math.round(sale.total / (1 + rate / 100))
    return { net, tax: sale.total - net, rate }
  }
  const tax = Math.round(sale.total * (rate / 100))
  return { net: sale.total, tax, rate }
}

export function buildVars(sale: SaleWithItems, store: StoreSettings): RenderVars {
  const date = new Date(sale.completed_at).toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const { net, tax, rate } = computeTax(sale, store)
  const surchargeTotal = sale.items.reduce((a, i) => a + i.surcharge * i.qty, 0)
  return {
    store_name: store.name || '',
    address: store.address || '',
    rut: store.rut || '',
    phone: store.phone || '',
    footer: store.receipt_footer || '',
    number: String(sale.number),
    date,
    total: formatCLP(sale.total),
    subtotal: formatCLP(sale.subtotal),
    discount: formatCLP(sale.discount),
    received: sale.cash_received != null ? formatCLP(sale.cash_received) : '',
    change: sale.change_given != null ? formatCLP(sale.change_given) : '',
    payment: paymentLabel(sale.payment_method),
    net: formatCLP(net),
    tax: formatCLP(tax),
    tax_rate: String(rate),
    surcharge: surchargeTotal > 0 ? formatCLP(surchargeTotal) : '',
    cashier: sale.cashier_name ?? '',
  }
}

export function paymentLabel(m: string): string {
  switch (m) {
    case 'efectivo':
      return 'EFECTIVO'
    case 'debito':
      return 'DEBITO'
    case 'credito':
      return 'CREDITO'
    case 'transferencia':
      return 'TRANSFERENCIA'
    case 'mixto':
      return 'MIXTO'
    default:
      return m.toUpperCase()
  }
}

export function interpolate(s: string, vars: RenderVars): string {
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
}

export function shouldShow(block: ReceiptBlock, sale: SaleWithItems): boolean {
  const cond = block.show ?? 'always'
  if (cond === 'always') return true
  // Mostrar bloques 'cash' si el pago fue 100% efectivo o si fue mixto
  // y al menos uno de los métodos fue efectivo. Antes solo chequeaba
  // payment_method === 'efectivo', dejando al cliente sin ver el
  // recibido/vuelto en ventas mixtas que sí incluían efectivo.
  if (cond === 'cash') {
    if (sale.payment_method === 'efectivo') return true
    return sale.payments?.some((p) => p.method === 'efectivo') ?? false
  }
  if (cond === 'has_discount') return sale.discount > 0
  if (cond === 'has_change') return (sale.change_given ?? 0) > 0
  return true
}

export function isValidTemplate(t: unknown): t is ReceiptTemplate {
  if (!t || typeof t !== 'object') return false
  const obj = t as Record<string, unknown>
  if (obj.version !== 1) return false
  if (!Array.isArray(obj.blocks)) return false
  return obj.blocks.every((b) => {
    if (!b || typeof b !== 'object') return false
    const r = b as Record<string, unknown>
    return typeof r.id === 'string' && typeof r.type === 'string' && r.type in BLOCK_LABELS
  })
}

export type RenderedLine =
  | { kind: 'sep'; char: string }
  | { kind: 'spacer' }
  | {
      kind: 'line'
      align: Align
      bold: boolean
      size: Size
      left: string
      right?: string
    }

export function pad(left: string, right: string, width: number): string {
  const space = Math.max(1, width - left.length - right.length)
  return left + ' '.repeat(space) + right
}

export function wrap(text: string, width: number): string[] {
  if (!text) return ['']
  if (text.length <= width) return [text]
  const out: string[] = []
  let cur = ''
  for (const word of text.split(/\s+/)) {
    if (!cur) cur = word
    else if (cur.length + 1 + word.length <= width) cur += ' ' + word
    else {
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

export function renderTemplate(
  template: ReceiptTemplate,
  sale: SaleWithItems,
  store: StoreSettings,
  width: number,
): RenderedLine[] {
  const vars = buildVars(sale, store)
  const w = width > 0 ? width : 42
  const out: RenderedLine[] = []

  const baseLine = (b: ReceiptBlock, left: string, right?: string): RenderedLine => ({
    kind: 'line',
    align: b.align ?? 'left',
    bold: !!b.bold,
    size: b.size ?? 'normal',
    left,
    right,
  })

  for (const b of template.blocks) {
    if (!shouldShow(b, sale)) continue
    switch (b.type) {
      case 'store_name': {
        const lines = wrap(vars.store_name, w)
        for (const l of lines) out.push(baseLine(b, l))
        break
      }
      case 'address':
        if (vars.address) for (const l of wrap(vars.address, w)) out.push(baseLine(b, l))
        break
      case 'rut':
        if (vars.rut) out.push(baseLine(b, `RUT: ${vars.rut}`))
        break
      case 'phone':
        if (vars.phone) out.push(baseLine(b, `Tel: ${vars.phone}`))
        break
      case 'separator':
        out.push({ kind: 'sep', char: b.char ?? '-' })
        break
      case 'spacer': {
        const n = Math.max(1, b.lines ?? 1)
        for (let i = 0; i < n; i++) out.push({ kind: 'spacer' })
        break
      }
      case 'sale_number_and_date':
        out.push(baseLine({ ...b, align: b.align ?? 'left' }, `Boleta N° ${vars.number}`, vars.date))
        break
      case 'sale_number':
        out.push(baseLine(b, `Boleta N° ${vars.number}`))
        break
      case 'date':
        out.push(baseLine(b, vars.date))
        break
      case 'items':
        for (const it of sale.items) {
          for (const l of wrap(it.name_snapshot, w)) {
            out.push(baseLine({ ...b, align: 'left' }, l))
          }
          if (it.is_weight === 1) {
            out.push(
              baseLine(
                { ...b, align: 'left' },
                `  ${formatWeight(it.qty)} x ${formatCLP(it.price_snapshot)}/kg`,
                formatCLP(it.line_total),
              ),
            )
          } else {
            out.push(
              baseLine(
                { ...b, align: 'left' },
                `  ${it.qty} x ${formatCLP(it.price_snapshot)}`,
                formatCLP(it.line_total),
              ),
            )
          }
        }
        break
      case 'subtotal':
        out.push(baseLine({ ...b, align: b.align ?? 'left' }, 'Subtotal', vars.subtotal))
        break
      case 'discount':
        out.push(baseLine({ ...b, align: b.align ?? 'left' }, 'Descuento', '-' + vars.discount))
        break
      case 'net_amount':
        out.push(baseLine({ ...b, align: b.align ?? 'left' }, 'Neto', vars.net))
        break
      case 'tax_amount':
        out.push(
          baseLine(
            { ...b, align: b.align ?? 'left' },
            `IVA ${vars.tax_rate}%`,
            vars.tax,
          ),
        )
        break
      case 'total':
        out.push(baseLine({ ...b, align: b.align ?? 'left' }, 'TOTAL', vars.total))
        break
      case 'payment_method':
        if (sale.payments && sale.payments.length > 1) {
          // Pago dividido: mostramos "Pago: MIXTO" + una línea por método
          out.push(baseLine({ ...b, align: b.align ?? 'left' }, 'Pago', 'MIXTO'))
          for (const p of sale.payments) {
            out.push(
              baseLine(
                { ...b, align: b.align ?? 'left' },
                `  ${paymentLabel(p.method)}`,
                formatCLP(p.amount),
              ),
            )
          }
        } else {
          out.push(baseLine({ ...b, align: b.align ?? 'left' }, 'Pago', vars.payment))
        }
        break
      case 'cash_received':
        out.push(baseLine({ ...b, align: b.align ?? 'left' }, 'Recibido', vars.received))
        break
      case 'change_given':
        out.push(baseLine({ ...b, align: b.align ?? 'left' }, 'Vuelto', vars.change))
        break
      case 'cashier':
        if (vars.cashier) {
          out.push(baseLine({ ...b, align: b.align ?? 'center' }, `Atendido por: ${vars.cashier}`))
        }
        break
      case 'text': {
        const text = interpolate(b.value, vars)
        if (!text) break
        for (const l of wrap(text, w)) out.push(baseLine(b, l))
        break
      }
    }
  }

  return out
}
