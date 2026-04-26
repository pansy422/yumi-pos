import type { ThermalPrinter } from 'node-thermal-printer'
import type { Align, ReceiptTemplate, RenderedLine, Size } from '../../shared/template'
import { DEFAULT_TEMPLATE, pad, renderTemplate } from '../../shared/template'
import type { SaleWithItems, StoreSettings } from '../../shared/types'

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
