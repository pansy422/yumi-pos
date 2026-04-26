import * as React from 'react'
import { AlertTriangle, Download, FileUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/useToast'
import { api } from '@/lib/api'
import { formatCLP } from '@shared/money'
import { cn } from '@/lib/utils'
import type { ProductInput } from '@shared/types'

const REQUIRED_HEADERS = ['name', 'price'] as const
const OPTIONAL_HEADERS = ['barcode', 'sku', 'category', 'cost', 'stock'] as const
type Header = (typeof REQUIRED_HEADERS)[number] | (typeof OPTIONAL_HEADERS)[number]

const HEADER_ALIASES: Record<string, Header> = {
  name: 'name',
  nombre: 'name',
  producto: 'name',
  descripcion: 'name',
  description: 'name',
  barcode: 'barcode',
  codigo: 'barcode',
  'codigo de barras': 'barcode',
  ean: 'barcode',
  sku: 'sku',
  category: 'category',
  categoria: 'category',
  cost: 'cost',
  costo: 'cost',
  price: 'price',
  precio: 'price',
  'precio venta': 'price',
  stock: 'stock',
  cantidad: 'stock',
  inventario: 'stock',
}

type ParsedRow = {
  raw: string[]
  data: ProductInput | null
  error?: string
}

function parseCsv(text: string): string[][] {
  const lines: string[][] = []
  let cur = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === ',' && !inQuotes) {
      row.push(cur)
      cur = ''
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      if (cur || row.length > 0) {
        row.push(cur)
        lines.push(row)
        row = []
        cur = ''
      }
      if (c === '\r' && text[i + 1] === '\n') i++
    } else {
      cur += c
    }
  }
  if (cur || row.length > 0) {
    row.push(cur)
    lines.push(row)
  }
  return lines
    .map((r) => r.map((cell) => cell.trim()))
    .filter((r) => r.some((cell) => cell !== ''))
}

function detectDelimiter(firstLine: string): ',' | ';' {
  const commas = (firstLine.match(/,/g) ?? []).length
  const semis = (firstLine.match(/;/g) ?? []).length
  return semis > commas ? ';' : ','
}

function normalizeHeader(h: string): Header | null {
  const key = h.toLowerCase().trim()
  return (HEADER_ALIASES[key] ?? null) as Header | null
}

function parseNumber(s: string): number {
  if (!s) return 0
  return Math.round(Number(s.replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '')) || 0)
}

export function CsvImport({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onImported: () => void
}) {
  const { toast } = useToast()
  const [rows, setRows] = React.useState<ParsedRow[]>([])
  const [headers, setHeaders] = React.useState<(Header | null)[]>([])
  const [importing, setImporting] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!open) {
      setRows([])
      setHeaders([])
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [open])

  const handleFile = async (file: File) => {
    const text = await file.text()
    const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
    const delim = detectDelimiter(firstLine)
    const normalized =
      delim === ';' ? text.replace(/;/g, ',').replace(/,(?=,)/g, ',') : text
    const matrix = parseCsv(normalized)
    if (matrix.length < 2) {
      toast({
        variant: 'destructive',
        title: 'CSV vacío o inválido',
        description: 'Asegúrate de incluir cabeceras y al menos una fila de datos.',
      })
      return
    }
    const rawHeaders = matrix[0]
    const detected = rawHeaders.map(normalizeHeader)
    const missing = REQUIRED_HEADERS.filter((h) => !detected.includes(h))
    if (missing.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Faltan columnas obligatorias',
        description: `Se requiere: ${missing.join(', ')}. Detectadas: ${rawHeaders.join(', ')}`,
      })
      return
    }
    const parsed: ParsedRow[] = matrix.slice(1).map((cells) => {
      const data: Partial<ProductInput> = {}
      for (let i = 0; i < detected.length; i++) {
        const h = detected[i]
        if (!h) continue
        const value = cells[i] ?? ''
        switch (h) {
          case 'name':
            data.name = value
            break
          case 'barcode':
            data.barcode = value || null
            break
          case 'sku':
            data.sku = value || null
            break
          case 'category':
            data.category = value || null
            break
          case 'cost':
            data.cost = parseNumber(value)
            break
          case 'price':
            data.price = parseNumber(value)
            break
          case 'stock':
            data.stock = parseNumber(value)
            break
        }
      }
      const errors: string[] = []
      if (!data.name || !data.name.trim()) errors.push('falta nombre')
      if (data.price == null || data.price <= 0) errors.push('precio inválido')
      return {
        raw: cells,
        data: errors.length === 0 ? (data as ProductInput) : null,
        error: errors.length ? errors.join(', ') : undefined,
      }
    })
    setHeaders(detected)
    setRows(parsed)
  }

  const validRows = rows.filter((r) => r.data && !r.error)
  const errorRows = rows.filter((r) => r.error)

  const submit = async () => {
    if (validRows.length === 0) return
    setImporting(true)
    try {
      const result = await api.productsImport(validRows.map((r) => r.data!))
      toast({
        variant: 'success',
        title: 'Importación lista',
        description: `${result.created} creado(s) · ${result.updated} actualizado(s)`,
      })
      onImported()
      onOpenChange(false)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'No se pudo importar',
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setImporting(false)
    }
  }

  const downloadTemplate = () => {
    const csv =
      'name,barcode,sku,category,cost,price,stock\n' +
      '"Coca-Cola 500ml",7801234567890,COCA500,Bebidas,800,1290,10\n' +
      '"Pan amasado",,,Panadería,150,350,0\n'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla-productos.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar productos desde CSV</DialogTitle>
          <DialogDescription>
            Carga una planilla con tus productos. Si un código de barras ya existe en la base, se
            actualiza el producto en vez de duplicarlo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <label className="cursor-pointer">
                <FileUp className="h-4 w-4" /> Seleccionar archivo
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(f)
                  }}
                />
              </label>
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadTemplate}>
              <Download className="h-3.5 w-3.5" /> Descargar plantilla
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Columnas reconocidas: <span className="mono">name (obligatorio), price (obligatorio), barcode, sku, category, cost, stock</span>. Soporta los nombres en español también.
          </p>

          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/40 bg-muted/30 p-3 text-sm">
                <Badge variant="success">{validRows.length} válidos</Badge>
                {errorRows.length > 0 && (
                  <Badge variant="destructive">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    {errorRows.length} con error
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {headers.filter((h): h is Header => !!h).length} columnas reconocidas
                </span>
              </div>
              <div className="max-h-72 overflow-auto rounded-md border border-border/40">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1 text-left">#</th>
                      <th className="px-2 py-1 text-left">Nombre</th>
                      <th className="px-2 py-1 text-left">Código</th>
                      <th className="px-2 py-1 text-left">Categoría</th>
                      <th className="px-2 py-1 text-right">Precio</th>
                      <th className="px-2 py-1 text-right">Stock</th>
                      <th className="px-2 py-1 text-left">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr
                        key={i}
                        className={cn(
                          'border-t border-border/40',
                          r.error && 'bg-destructive/5',
                        )}
                      >
                        <td className="px-2 py-1.5 text-xs text-muted-foreground">{i + 2}</td>
                        <td className="px-2 py-1.5">{r.data?.name ?? r.raw[0]}</td>
                        <td className="px-2 py-1.5 mono text-xs text-muted-foreground">
                          {r.data?.barcode ?? '—'}
                        </td>
                        <td className="px-2 py-1.5 text-xs">
                          {r.data?.category ?? <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right num">
                          {r.data ? formatCLP(r.data.price) : '—'}
                        </td>
                        <td className="px-2 py-1.5 text-right num">{r.data?.stock ?? 0}</td>
                        <td className="px-2 py-1.5">
                          {r.error ? (
                            <span className="text-xs text-destructive">{r.error}</span>
                          ) : (
                            <span className="text-xs text-success">Listo</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={importing || validRows.length === 0}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {importing
              ? 'Importando…'
              : `Importar ${validRows.length} producto${validRows.length === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
