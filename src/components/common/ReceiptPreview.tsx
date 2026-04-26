import { cn } from '@/lib/utils'
import type { SaleWithItems, StoreSettings } from '@shared/types'
import {
  type ReceiptTemplate,
  type RenderedLine,
  pad,
  renderTemplate,
} from '@shared/template'

export function ReceiptPreview({
  sale,
  store,
  template,
  width = 42,
  className,
}: {
  sale: SaleWithItems
  store: StoreSettings
  template: ReceiptTemplate
  width?: number
  className?: string
}) {
  const lines = renderTemplate(template, sale, store, width)

  return (
    <div
      className={cn(
        'rounded-md bg-white text-black shadow-soft',
        'mx-auto px-5 py-5 font-mono text-[12px] leading-[1.4]',
        className,
      )}
      style={{ width: `${width * 8 + 40}px`, maxWidth: '100%' }}
    >
      {lines.map((l, i) => (
        <Line key={i} line={l} width={width} />
      ))}
    </div>
  )
}

function Line({ line, width }: { line: RenderedLine; width: number }) {
  if (line.kind === 'sep') {
    const ch = (line.char || '-').slice(0, 1) || '-'
    return <div className="border-t border-dashed border-black/40 my-1" aria-hidden>
      <span className="sr-only">{ch.repeat(width)}</span>
    </div>
  }
  if (line.kind === 'spacer') {
    return <div>&nbsp;</div>
  }
  const usableWidth = line.size === 'xl' ? Math.max(8, Math.floor(width / 2)) : width
  const text =
    line.right != null ? pad(line.left, line.right, usableWidth) : line.left
  const sizeClass =
    line.size === 'xl'
      ? 'text-[18px] leading-[1.2]'
      : line.size === 'large'
        ? 'text-[14px] leading-[1.25]'
        : ''
  const alignClass =
    line.align === 'center' ? 'text-center' : line.align === 'right' ? 'text-right' : ''
  return (
    <div
      className={cn(
        'whitespace-pre',
        line.bold && 'font-bold',
        sizeClass,
        alignClass,
      )}
    >
      {text || ' '}
    </div>
  )
}
