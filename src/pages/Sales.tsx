import { useEffect, useMemo, useState } from 'react'
import {
  Ban,
  Calendar,
  Filter,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Skeleton, SkeletonRow } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PageHeader } from '@/components/common/PageHeader'
import { ReceiptPreview } from '@/components/common/ReceiptPreview'
import { EmptyState, ChartEmptyArt } from '@/components/common/EmptyState'
import { useToast } from '@/hooks/useToast'
import { useSession } from '@/stores/session'
import { api } from '@/lib/api'
import { formatCLP, formatWeight, todayISO } from '@shared/money'
import { cn } from '@/lib/utils'
import type { PaymentMethod, Sale, SaleWithItems } from '@shared/types'

const PAY_LABEL: Record<PaymentMethod | 'mixto', string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  credito: 'Crédito',
  transferencia: 'Transferencia',
  otro: 'Otro',
  mixto: 'Mixto',
}

type Range = 'today' | '7d' | '30d' | 'custom'

export function Sales() {
  const { toast } = useToast()
  const settings = useSession((s) => s.settings)
  const [range, setRange] = useState<Range>('today')
  const [from, setFrom] = useState(todayISO())
  const [to, setTo] = useState(todayISO())
  const [method, setMethod] = useState<'all' | PaymentMethod>('all')
  const [showVoided, setShowVoided] = useState(false)
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [picked, setPicked] = useState<SaleWithItems | null>(null)
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)
  const [returnDlg, setReturnDlg] = useState(false)
  const [returnQty, setReturnQty] = useState<Record<string, number>>({})
  const [returnReason, setReturnReason] = useState('')
  const [returning, setReturning] = useState(false)

  const computeRange = (r: Range): { f: string; t: string } => {
    const today = new Date()
    if (r === 'today') return { f: todayISO(today), t: todayISO(today) }
    const d = new Date(today)
    d.setDate(today.getDate() - (r === '7d' ? 7 : 30))
    return { f: todayISO(d), t: todayISO(today) }
  }

  useEffect(() => {
    if (range !== 'custom') {
      const r = computeRange(range)
      setFrom(r.f)
      setTo(r.t)
    }
  }, [range])

  const load = async () => {
    setLoading(true)
    try {
      const list = await api.salesList({ from, to, limit: 1000 })
      setItems(list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [from, to])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return items.filter((s) => {
      if (!showVoided && s.voided) return false
      if (method !== 'all' && s.payment_method !== method) return false
      if (term) {
        const num = String(s.number)
        if (!num.includes(term) && !s.id.toLowerCase().includes(term)) return false
      }
      return true
    })
  }, [items, search, method, showVoided])

  const totals = useMemo(() => {
    let revenue = 0
    let count = 0
    for (const s of filtered) {
      if (s.voided) continue
      revenue += s.total
      count++
    }
    return { revenue, count }
  }, [filtered])

  const openDetail = async (sale: Sale) => {
    const full = await api.salesGet(sale.id)
    if (full) setPicked(full)
  }

  const reprint = async (saleId: string) => {
    const r = await api.printReceipt(saleId)
    if (r.ok) toast({ variant: 'success', title: 'Reimprimiendo' })
    else toast({ variant: 'destructive', title: 'No se pudo imprimir', description: r.error })
  }

  const submitVoid = async () => {
    if (!voidTarget) return
    setVoiding(true)
    try {
      await api.salesVoid(voidTarget.id, voidReason.trim() || 'Sin motivo')
      toast({
        variant: 'success',
        title: `Venta #${voidTarget.number} anulada`,
        description: 'Se restauró el stock',
      })
      setVoidTarget(null)
      setVoidReason('')
      setPicked(null)
      load()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'No se pudo anular',
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setVoiding(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Ventas"
        description={`${filtered.length} ${filtered.length === 1 ? 'boleta' : 'boletas'}${
          totals.count !== filtered.length ? '' : ` · ${formatCLP(totals.revenue)}`
        }`}
        actions={
          <Button variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Actualizar
          </Button>
        }
      />

      <div className="flex flex-col gap-4 p-6">
        <Card className="card-elev">
          <CardContent className="grid gap-3 p-4 md:grid-cols-[160px_repeat(2,_1fr)_180px_1fr]">
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-caps">Período</Label>
              <Select value={range} onValueChange={(v) => setRange(v as Range)}>
                <SelectTrigger>
                  <Calendar className="h-3.5 w-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="7d">Últimos 7 días</SelectItem>
                  <SelectItem value="30d">Últimos 30 días</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-caps">Desde</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setRange('custom')
                  setFrom(e.target.value)
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-caps">Hasta</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => {
                  setRange('custom')
                  setTo(e.target.value)
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-caps">Método de pago</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                <SelectTrigger>
                  <Filter className="h-3.5 w-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="debito">Débito</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-caps">Buscar #</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="N° de boleta…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="md:col-span-5 flex items-center gap-2">
              <button
                onClick={() => setShowVoided((v) => !v)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors',
                  showVoided ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-border hover:bg-accent',
                )}
              >
                <Ban className="h-3 w-3" />
                {showVoided ? 'Mostrando anuladas' : 'Ocultando anuladas'}
              </button>
              <div className="ml-auto flex items-center gap-4 text-xs">
                <span className="text-muted-foreground">
                  Total no anulado: <span className="num font-semibold text-foreground">{formatCLP(totals.revenue)}</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elev overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="divide-y divide-border/40">
                {[0, 1, 2, 3, 4].map((i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                illustration={<ChartEmptyArt />}
                title="Sin ventas en estos filtros"
                description="Cambia el rango de fechas o el método de pago."
              />
            ) : (
              <div className="overflow-auto scrollfade-y max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-card/90 text-[10px] font-semibold uppercase tracking-caps text-muted-foreground backdrop-blur-md backdrop-saturate-150">
                    <tr>
                      <th className="px-4 py-3 text-left">Boleta</th>
                      <th className="px-4 py-3 text-left">Fecha</th>
                      <th className="px-4 py-3 text-left">Método</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="w-16" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => openDetail(s)}
                        className={cn(
                          'group cursor-pointer border-t border-border/40 transition-colors hover:bg-accent/30',
                          s.voided && 'opacity-50',
                        )}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="num font-semibold">#{s.number}</span>
                            {s.voided === 1 ? (
                              <Badge variant="destructive">Anulada</Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 mono text-xs text-muted-foreground">
                          {new Date(s.completed_at).toLocaleString('es-CL', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="secondary">{PAY_LABEL[s.payment_method]}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right num font-semibold">
                          {formatCLP(s.total)}
                        </td>
                        <td className="px-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              reprint(s.id)
                            }}
                            className="opacity-0 group-hover:opacity-100"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
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

      <Dialog open={!!picked} onOpenChange={(v) => !v && setPicked(null)}>
        <DialogContent className="max-w-2xl">
          {picked && settings && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  Boleta #{picked.number}
                  {picked.voided ? <Badge variant="destructive">Anulada</Badge> : null}
                </DialogTitle>
                <DialogDescription>
                  {new Date(picked.completed_at).toLocaleString('es-CL')} ·{' '}
                  {PAY_LABEL[picked.payment_method]}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <ul className="divide-y divide-border/40 rounded-md border border-border/40 bg-card/30">
                    {picked.items.map((it, i) => {
                      const remaining = it.qty - it.returned_qty
                      const isWeight = it.is_weight === 1
                      return (
                      <li key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate">{it.name_snapshot}</span>
                            {it.returned_qty > 0 && (
                              <Badge variant="warning" className="text-[9px]">
                                {isWeight ? formatWeight(it.returned_qty) : it.returned_qty}{' '}
                                devuelto{!isWeight && it.returned_qty > 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground num">
                            {isWeight ? formatWeight(it.qty) : it.qty} ×{' '}
                            {formatCLP(it.price_snapshot)}
                            {isWeight ? '/kg' : ''}
                            {remaining < it.qty && (
                              <span className="ml-2 text-warning">
                                · pendientes {isWeight ? formatWeight(remaining) : remaining}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="num font-semibold">{formatCLP(it.line_total)}</div>
                      </li>
                      )
                    })}
                  </ul>
                  <div className="space-y-1 rounded-md border border-border/40 bg-muted/30 p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="num">{formatCLP(picked.subtotal)}</span>
                    </div>
                    {picked.discount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Descuento</span>
                        <span className="num">-{formatCLP(picked.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-bold">
                      <span>Total</span>
                      <span className="num brand-text">{formatCLP(picked.total)}</span>
                    </div>
                    {picked.payment_method === 'efectivo' && picked.cash_received != null && (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Recibido</span>
                          <span className="num">{formatCLP(picked.cash_received)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Vuelto</span>
                          <span className="num text-success">
                            {formatCLP(picked.change_given ?? 0)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="hidden lg:block">
                  <ReceiptPreview
                    sale={picked}
                    store={settings.store}
                    template={settings.receipt_template}
                    width={settings.printer.width_chars}
                    className="scale-90 origin-top"
                  />
                </div>
              </div>
              <DialogFooter className="border-t border-border/40 pt-3">
                <Button
                  variant="outline"
                  onClick={() => reprint(picked.id)}
                  disabled={picked.voided === 1}
                >
                  <Printer className="h-4 w-4" /> Reimprimir
                </Button>
                {!picked.voided &&
                  picked.items.some(
                    (i) => i.product_id != null && i.qty - i.returned_qty > 0,
                  ) && (
                    <Button
                      variant="warning"
                      onClick={() => {
                        const initial: Record<string, number> = {}
                        // Solo se pueden devolver líneas cuyo producto sigue
                        // existiendo: necesitamos restituir stock y eso no
                        // tiene sentido si el producto fue borrado.
                        for (const it of picked.items) {
                          if (it.product_id) initial[it.product_id] = 0
                        }
                        setReturnQty(initial)
                        setReturnReason('')
                        setReturnDlg(true)
                      }}
                    >
                      Devolver productos
                    </Button>
                  )}
                {!picked.voided && (
                  <Button variant="destructive" onClick={() => setVoidTarget(picked)}>
                    <Ban className="h-4 w-4" /> Anular venta
                  </Button>
                )}
                <Button onClick={() => setPicked(null)}>
                  <X className="h-4 w-4" /> Cerrar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!voidTarget} onOpenChange={(v) => !v && setVoidTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular boleta #{voidTarget?.number}</AlertDialogTitle>
            <AlertDialogDescription>
              Esto restaurará el stock de los productos vendidos y excluirá esta boleta de los
              reportes. La acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Label>Motivo</Label>
            <Input
              autoFocus
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="ej. cliente devolvió producto"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={voiding}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={submitVoid}
              disabled={voiding}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {voiding ? 'Anulando…' : 'Confirmar anulación'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={returnDlg} onOpenChange={setReturnDlg}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Devolver productos</DialogTitle>
            <DialogDescription>
              Marca cuántas unidades vuelven al stock. La venta queda registrada y se ajusta la
              caja si fue en efectivo.
            </DialogDescription>
          </DialogHeader>

          {picked && (
            <ul className="max-h-72 divide-y divide-border/40 overflow-auto rounded-md border border-border/40">
              {picked.items.map((it, idx) => {
                const remaining = it.qty - it.returned_qty
                const isWeight = it.is_weight === 1
                const isDeleted = it.product_id == null
                const key = it.product_id ?? `__deleted__${idx}`
                const value = it.product_id ? (returnQty[it.product_id] ?? 0) : 0
                return (
                  <li key={key} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{it.name_snapshot}</div>
                      <div className="text-[11px] text-muted-foreground num">
                        Pendiente:{' '}
                        {isWeight ? formatWeight(remaining) : remaining}
                        {remaining === 0 && ' (todo devuelto)'}
                        {isDeleted && ' · producto eliminado'}
                      </div>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={remaining}
                      value={value}
                      onChange={(e) => {
                        if (!it.product_id) return
                        const pid = it.product_id
                        setReturnQty({
                          ...returnQty,
                          [pid]: Math.max(
                            0,
                            Math.min(remaining, Number(e.target.value) || 0),
                          ),
                        })
                      }}
                      disabled={remaining === 0 || isDeleted}
                      title={isDeleted ? 'No se puede devolver: producto eliminado' : undefined}
                      className="h-8 w-20 text-center num"
                      placeholder={isWeight ? 'gramos' : 'qty'}
                    />
                  </li>
                )
              })}
            </ul>
          )}

          <div className="space-y-1">
            <Label>Motivo</Label>
            <Input
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="ej. cliente llevó equivocado"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDlg(false)} disabled={returning}>
              Cancelar
            </Button>
            <Button
              variant="warning"
              disabled={
                returning ||
                Object.values(returnQty).every((q) => !q) ||
                !returnReason.trim()
              }
              onClick={async () => {
                if (!picked) return
                const returns = Object.entries(returnQty)
                  .filter(([, qty]) => qty > 0)
                  .map(([product_id, qty]) => ({ product_id, qty }))
                if (returns.length === 0) return
                setReturning(true)
                try {
                  const r = await api.salesReturnItems(picked.id, returns, returnReason.trim())
                  toast({
                    variant: 'success',
                    title: 'Devolución registrada',
                    description: `Reembolsados ${formatCLP(r.refunded_total)}`,
                  })
                  setReturnDlg(false)
                  setPicked(r.sale)
                  load()
                } catch (err) {
                  toast({
                    variant: 'destructive',
                    title: 'No se pudo devolver',
                    description: err instanceof Error ? err.message : String(err),
                  })
                } finally {
                  setReturning(false)
                }
              }}
            >
              {returning ? 'Devolviendo…' : 'Confirmar devolución'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
