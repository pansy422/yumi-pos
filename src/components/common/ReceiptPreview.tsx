import { cn } from '@/lib/utils'
import type { SaleWithItems, StoreSettings } from '@shared/types'
import { formatCLP } from '@shared/money'

const PAYMENT_LABEL: Record<string, string> = {
  efectivo: 'EFECTIVO',
  debito: 'DÉBITO',
  credito: 'CRÉDITO',
  transferencia: 'TRANSFERENCIA',
  otro: 'OTRO',
}

function pad(left: string, right: string, width: number) {
  const space = Math.max(1, width - left.length - right.length)
  return left + ' '.repeat(space) + right
}

export function ReceiptPreview({
  sale,
  store,
  width = 32,
  className,
}: {
  sale: SaleWithItems
  store: StoreSettings
  width?: number
  className?: string
}) {
  const date = new Date(sale.completed_at).toLocaleString('es-CL')
  const lines: { text: string; bold?: boolean; large?: boolean; center?: boolean; rule?: boolean }[] = []

  lines.push({ text: store.name || 'Yumi POS', bold: true, large: true, center: true })
  if (store.address) lines.push({ text: store.address, center: true })
  if (store.rut) lines.push({ text: `RUT: ${store.rut}`, center: true })
  if (store.phone) lines.push({ text: `Tel: ${store.phone}`, center: true })
  lines.push({ text: '', rule: true })
  lines.push({ text: `Boleta N° ${sale.number}` })
  lines.push({ text: date })
  lines.push({ text: '', rule: true })

  for (const it of sale.items) {
    lines.push({ text: it.name_snapshot })
    lines.push({
      text: pad(`  ${it.qty} x ${formatCLP(it.price_snapshot)}`, formatCLP(it.line_total), width),
    })
  }
  lines.push({ text: '', rule: true })
  lines.push({ text: pad('Subtotal', formatCLP(sale.subtotal), width) })
  if (sale.discount > 0) lines.push({ text: pad('Descuento', '-' + formatCLP(sale.discount), width) })
  lines.push({ text: pad('TOTAL', formatCLP(sale.total), width), bold: true, large: true })
  lines.push({ text: '', rule: true })
  lines.push({
    text: pad('Pago', PAYMENT_LABEL[sale.payment_method] ?? sale.payment_method, width),
  })
  if (sale.payment_method === 'efectivo' && sale.cash_received != null) {
    lines.push({ text: pad('Recibido', formatCLP(sale.cash_received), width) })
    lines.push({ text: pad('Vuelto', formatCLP(sale.change_given ?? 0), width) })
  }
  if (store.receipt_footer) {
    lines.push({ text: '' })
    lines.push({ text: store.receipt_footer, center: true })
  }

  return (
    <div
      className={cn(
        'rounded-md bg-white text-black shadow-soft',
        'mx-auto px-4 py-5 font-mono text-[12px] leading-[1.35]',
        className,
      )}
      style={{ width: `${width * 8 + 32}px`, maxWidth: '100%' }}
    >
      {lines.map((l, i) =>
        l.rule ? (
          <div key={i} className="my-1 border-t border-dashed border-black/30" />
        ) : (
          <div
            key={i}
            className={cn(
              'whitespace-pre',
              l.center && 'text-center',
              l.bold && 'font-bold',
              l.large && 'text-[14px]',
            )}
          >
            {l.text || ' '}
          </div>
        ),
      )}
    </div>
  )
}
