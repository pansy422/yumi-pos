import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  PackageX,
  ScanBarcode,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, BoxEmptyArt } from '@/components/common/EmptyState'
import { useToast } from '@/hooks/useToast'
import { useScanner } from '@/hooks/useScanner'
import { useSession } from '@/stores/session'
import { api } from '@/lib/api'
import { WRITEOFF_REASON_LABEL } from '@/lib/labels'
import { formatCLP, formatDateTimeCL, formatWeight } from '@shared/money'
import { cn } from '@/lib/utils'
import type { Product, StockWriteoff, WriteoffReason, WriteoffReport } from '@shared/types'

const REASONS: WriteoffReason[] = ['vencido', 'dañado', 'consumo', 'robo', 'conteo', 'otro']

function monthOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(m: string): string {
  const [y, mm] = m.split('-').map(Number)
  const s = new Date(y, mm - 1, 1).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
function shiftMonth(m: string, delta: number): string {
  const [y, mm] = m.split('-').map(Number)
  return monthOf(new Date(y, mm - 1 + delta, 1))
}

/** "1,5" / "1.234,5" / "2" → gramos. */
function toGrams(s: string): number {
  const t = (s || '').trim()
  if (!t) return 0
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  const n = parseFloat(normalized)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 1000)
}

export function Writeoffs() {
  const { toast } = useToast()
  const currentUser = useSession((s) => s.user)
  const userCount = useSession((s) => s.userCount)
  const needsLogin = userCount > 0 && !currentUser

  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [picked, setPicked] = useState<Product | null>(null)
  const [qty, setQty] = useState('1')
  const [reason, setReason] = useState<WriteoffReason | ''>('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [month, setMonth] = useState(monthOf(new Date()))
  const [report, setReport] = useState<WriteoffReport | null>(null)
  const [recent, setRecent] = useState<StockWriteoff[]>([])
  const searchRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const [r, list] = await Promise.all([api.writeoffsReport({ month }), api.writeoffsList({ limit: 50 })])
      setReport(r)
      setRecent(list)
    } catch (err) {
      console.error('[mermas]', err)
    }
  }, [month])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const q = search.trim()
    if (!q) {
      setResults([])
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      const list = await api.productsList({ search: q })
      if (!cancelled) setResults(list.slice(0, 10))
    }, 120)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [search])

  const pick = (p: Product) => {
    setPicked(p)
    setResults([])
    setSearch('')
    setQty(p.is_weight === 1 ? '' : '1')
  }

  const handleScan = useCallback(
    async (code: string) => {
      const p = await api.productsByBarcode(code)
      if (!p) {
        toast({ variant: 'warning', title: 'Código no encontrado', description: code })
        return
      }
      pick(p)
    },
    [toast],
  )
  useScanner({ enabled: true, onScan: handleScan })

  const qtyValue = picked?.is_weight === 1 ? toGrams(qty) : Math.round(Number(qty) || 0)
  const canSave = !saving && !needsLogin && !!picked && qtyValue > 0 && reason !== '' && (reason !== 'otro' || note.trim().length > 0)
  const costPreview = picked
    ? picked.is_weight === 1
      ? Math.round((qtyValue * picked.cost) / 1000)
      : qtyValue * picked.cost
    : 0

  const submit = async () => {
    // `canSave` ya garantiza picked y reason !== '' (TS lo propaga por alias).
    if (!canSave) return
    setSaving(true)
    try {
      const w = await api.writeoffsCreate({
        product_id: picked.id,
        qty: qtyValue,
        reason,
        note: note.trim() || null,
        user_id: currentUser?.id ?? null,
      })
      toast({
        variant: 'success',
        title: `Merma registrada: ${w.product_name}`,
        description: `${w.is_weight ? formatWeight(w.qty) : `${w.qty} u.`} · ${formatCLP(w.cost_total)} a costo`,
      })
      setPicked(null)
      setQty('1')
      setReason('')
      setNote('')
      await load()
      searchRef.current?.focus()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'No se pudo registrar',
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Vencidos y mermas"
        description="Baja de stock con motivo. Reemplaza el ajuste a mano: queda en el historial y en el reporte."
        actions={
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" onClick={() => setMonth(shiftMonth(month, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[160px] text-center text-sm font-medium">{monthLabel(month)}</div>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setMonth(shiftMonth(month, 1))}
              disabled={month >= monthOf(new Date())}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 p-6 lg:grid-cols-[400px_1fr]">
        <Card className="card-elev h-fit">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
              <PackageX className="h-3.5 w-3.5" /> Dar de baja
            </div>
            {needsLogin && (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-2 text-[11px] text-warning">
                Iniciá sesión con tu PIN para registrar mermas.
              </div>
            )}
            {!picked ? (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  autoFocus
                  data-scanner-scope="capture"
                  className="h-11 pl-9"
                  placeholder="Busca por nombre o pistolea el código"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {results.length > 0 && (
                  <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-lg">
                    {results.map((p) => (
                      <li
                        key={p.id}
                        className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-accent"
                        onClick={() => pick(p)}
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="text-[11px] text-muted-foreground">
                          stock {p.is_weight === 1 ? formatWeight(p.stock) : p.stock}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <ScanBarcode className="h-3 w-3" /> El lector está activo en esta pantalla.
                </p>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{picked.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Stock {picked.is_weight === 1 ? formatWeight(picked.stock) : picked.stock} · costo{' '}
                    {formatCLP(picked.cost)}
                    {picked.is_weight === 1 ? '/kg' : ''}
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPicked(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>{picked?.is_weight === 1 ? 'Cantidad (kg)' : 'Cantidad'}</Label>
                <Input
                  inputMode="decimal"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder={picked?.is_weight === 1 ? 'ej. 1,5' : '1'}
                  disabled={!picked}
                />
              </div>
              <div className="space-y-1">
                <Label>Motivo *</Label>
                <Select value={reason} onValueChange={(v) => setReason(v as WriteoffReason)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elegir…" />
                  </SelectTrigger>
                  <SelectContent>
                    {REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {WRITEOFF_REASON_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Nota {reason === 'otro' ? '*' : '(opcional)'}</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ej. lote vencido el 20-09" />
            </div>
            {picked && qtyValue > 0 && (
              <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Pérdida a costo</span>
                <span className="num font-semibold text-destructive">{formatCLP(costPreview)}</span>
              </div>
            )}
            <Button className="w-full" variant="destructive" disabled={!canSave} onClick={submit}>
              <Trash2 className="h-4 w-4" /> {saving ? 'Guardando…' : 'Dar de baja'}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <SmallStat label={`Mermas ${monthLabel(month)}`} value={formatCLP(report?.total_cost ?? 0)} accent />
            <SmallStat label="Bajas" value={String(report?.count ?? 0)} />
            <SmallStat
              label="Motivo principal"
              value={report?.by_reason[0] ? WRITEOFF_REASON_LABEL[report.by_reason[0].reason] : '—'}
            />
          </div>

          {report && report.by_reason.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="card-elev">
                <CardContent className="p-0">
                  <div className="border-b border-border/60 px-4 py-3 text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
                    Por motivo
                  </div>
                  <ul className="divide-y divide-border/40">
                    {report.by_reason.map((r) => (
                      <li key={r.reason} className="flex items-center justify-between px-4 py-2 text-sm">
                        <span>
                          {WRITEOFF_REASON_LABEL[r.reason]}{' '}
                          <span className="text-[11px] text-muted-foreground">· {r.count}</span>
                        </span>
                        <span className="num font-semibold">{formatCLP(r.cost)}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card className="card-elev">
                <CardContent className="p-0">
                  <div className="border-b border-border/60 px-4 py-3 text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
                    Por producto
                  </div>
                  <ul className="max-h-64 divide-y divide-border/40 overflow-auto">
                    {report.by_product.map((r) => (
                      <li key={`${r.product_id}-${r.product_name}`} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                        <span className="min-w-0 truncate">
                          {r.product_name}{' '}
                          <span className="text-[11px] text-muted-foreground">
                            · {r.is_weight ? formatWeight(r.qty) : `${r.qty} u.`}
                          </span>
                        </span>
                        <span className="num font-semibold">{formatCLP(r.cost)}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}

          <Card className="card-elev overflow-hidden">
            <CardContent className="p-0">
              <div className="border-b border-border/60 px-4 py-3 text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
                Últimas bajas
              </div>
              {recent.length === 0 ? (
                <EmptyState
                  illustration={<BoxEmptyArt />}
                  title="Sin mermas registradas"
                  description="Cuando algo se vence, se rompe o se consume, regístralo acá en vez de editar el stock a mano."
                />
              ) : (
                <div className="max-h-[40vh] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-card/90 text-[10px] font-semibold uppercase tracking-caps text-muted-foreground backdrop-blur-md">
                      <tr>
                        <th className="px-4 py-3 text-left">Fecha</th>
                        <th className="px-4 py-3 text-left">Producto</th>
                        <th className="px-4 py-3 text-left">Motivo</th>
                        <th className="px-4 py-3 text-right">Cantidad</th>
                        <th className="px-4 py-3 text-right">Costo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((w) => (
                        <tr key={w.id} className="border-t border-border/40 hover:bg-accent/30">
                          <td className="px-4 py-2.5 text-[12px]">{formatDateTimeCL(w.created_at)}</td>
                          <td className="px-4 py-2.5">
                            <div className="font-medium">{w.product_name}</div>
                            {(w.note || w.user_name) && (
                              <div className="text-[11px] text-muted-foreground">
                                {w.note}
                                {w.note && w.user_name ? ' · ' : ''}
                                {w.user_name}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant={w.reason === 'robo' ? 'destructive' : 'secondary'}>
                              {WRITEOFF_REASON_LABEL[w.reason]}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-right num">
                            {w.is_weight ? formatWeight(w.qty) : w.qty}
                          </td>
                          <td className="px-4 py-2.5 text-right num font-semibold text-destructive">
                            {formatCLP(w.cost_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function SmallStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className={cn('card-elev', accent && 'accent-border')}>
      <CardContent className="p-4">
        <div className="text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">{label}</div>
        <div className={cn('num mt-1.5 truncate text-2xl font-semibold leading-none tracking-display-tight', accent && 'brand-text')}>
          {value}
        </div>
      </CardContent>
    </Card>
  )
}
