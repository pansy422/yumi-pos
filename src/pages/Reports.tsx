import { useEffect, useState } from 'react'
import { Printer, Snail, TrendingDown, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/common/PageHeader'
import { Sparkline } from '@/components/common/Sparkline'
import { Donut } from '@/components/common/Donut'
import { ChartEmptyArt, EmptyState } from '@/components/common/EmptyState'
import { useToast } from '@/hooks/useToast'
import { api } from '@/lib/api'
import { formatCLP, formatWeight, todayISO } from '@shared/money'
import type { DailyReport, RangeReport, SlowMovingProduct } from '@shared/types'
import { cn } from '@/lib/utils'

const PAY_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  credito: 'Crédito',
  transferencia: 'Transferencia',
  otro: 'Otro',
}

export function Reports() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Reportes" description="Ingresos, ganancia y productos top" />
      <div className="p-6">
        <Tabs defaultValue="daily">
          <TabsList>
            <TabsTrigger value="daily">Diario</TabsTrigger>
            <TabsTrigger value="range">Por rango</TabsTrigger>
            <TabsTrigger value="slow">Sin rotación</TabsTrigger>
          </TabsList>
          <TabsContent value="daily">
            <DailyView />
          </TabsContent>
          <TabsContent value="range">
            <RangeView />
          </TabsContent>
          <TabsContent value="slow">
            <SlowMovingView />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function KPI({
  label,
  value,
  delta,
  hint,
  spark,
  accent,
}: {
  label: string
  value: string
  delta?: number
  hint?: string
  spark?: number[]
  accent?: 'primary' | 'success'
}) {
  return (
    <Card className="card-elev accent-border lift relative overflow-hidden">
      <CardContent className="relative p-5">
        <div className="text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
          {label}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <div
            className={cn(
              'num text-[26px] font-semibold leading-none tracking-display-tight',
              accent === 'primary' && 'brand-text',
              accent === 'success' && 'text-success',
            )}
          >
            {value}
          </div>
          {typeof delta === 'number' && (
            <span
              className={cn(
                'flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
                delta >= 0
                  ? 'border-success/20 bg-success/10 text-success'
                  : 'border-destructive/20 bg-destructive/10 text-destructive',
              )}
            >
              {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(Math.round(delta))}%
            </span>
          )}
        </div>
        {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
        {spark && spark.length > 0 && (
          <div className="mt-3 -mx-1">
            <Sparkline data={spark} height={36} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function KPISkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <Skeleton className="mb-2 h-3 w-24" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-3 h-9 w-full" />
      </CardContent>
    </Card>
  )
}

function DailyView() {
  const [date, setDate] = useState(todayISO())
  const [report, setReport] = useState<DailyReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.reportDaily(date).then((r) => {
      setReport(r)
      setLoading(false)
    })
  }, [date])

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label>Fecha</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-44"
          />
        </div>
      </div>
      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <KPISkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          <KPI label="Ventas" value={String(report?.sales_count ?? 0)} />
          <KPI label="Ingresos" value={formatCLP(report?.revenue ?? 0)} accent="primary" />
          <KPI label="Ganancia" value={formatCLP(report?.profit ?? 0)} accent="success" />
          <KPI
            label="Ticket promedio"
            value={formatCLP(
              report && report.sales_count ? report.revenue / report.sales_count : 0,
            )}
          />
        </div>
      )}

      {!loading && (report?.sales_count ?? 0) === 0 ? (
        <Card className="card-elev">
          <EmptyState
            illustration={<ChartEmptyArt />}
            title="Sin ventas en esta fecha"
            description="Cuando registres ventas, los reportes aparecerán acá."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <PaymentBreakdown items={report?.by_payment ?? []} loading={loading} />
            <TopProducts items={report?.top_products ?? []} loading={loading} />
          </div>
          <CategoryBreakdown items={report?.by_category ?? []} loading={loading} />
          <CashierBreakdown items={report?.by_cashier ?? []} loading={loading} />
        </>
      )}
    </div>
  )
}

function CashierBreakdown({
  items,
  loading,
}: {
  items: { cashier_id: string | null; name: string; count: number; revenue: number; profit: number }[]
  loading?: boolean
}) {
  const totalRevenue = items.reduce((a, i) => a + i.revenue, 0)
  return (
    <Card className="card-elev">
      <CardContent className="p-0">
        <div className="border-b border-border/60 px-4 py-3 text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
          Por cajero
        </div>
        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-7" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Sin datos</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {items.map((it, idx) => {
              const pct = totalRevenue > 0 ? (it.revenue / totalRevenue) * 100 : 0
              return (
                <li key={it.cashier_id ?? `__none__${idx}`} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-medium tracking-tight">{it.name}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="num">{it.count} venta{it.count === 1 ? '' : 's'}</span>
                      <span className="num text-success">{formatCLP(it.profit)}</span>
                      <span className="num font-semibold text-foreground">
                        {formatCLP(it.revenue)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full brand-gradient" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="num min-w-[36px] text-right text-[10px] text-muted-foreground">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function RangeView() {
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return todayISO(d)
  })
  const [to, setTo] = useState(todayISO())
  const [report, setReport] = useState<RangeReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.reportRange(from, to).then((r) => {
      setReport(r)
      setLoading(false)
    })
  }, [from, to])

  const revenueSpark = (report?.daily ?? []).map((d) => d.revenue)
  const profitSpark = (report?.daily ?? []).map((d) => d.profit)
  const countSpark = (report?.daily ?? []).map((d) => d.count)

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label>Desde</Label>
          <Input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="w-44"
          />
        </div>
        <div className="space-y-1">
          <Label>Hasta</Label>
          <Input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="w-44"
          />
        </div>
      </div>
      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <KPISkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          <KPI label="Ventas" value={String(report?.sales_count ?? 0)} spark={countSpark} />
          <KPI
            label="Ingresos"
            value={formatCLP(report?.revenue ?? 0)}
            spark={revenueSpark}
            accent="primary"
          />
          <KPI
            label="Ganancia"
            value={formatCLP(report?.profit ?? 0)}
            spark={profitSpark}
            accent="success"
          />
          <KPI
            label="Ticket promedio"
            value={formatCLP(
              report && report.sales_count ? report.revenue / report.sales_count : 0,
            )}
          />
        </div>
      )}

      {!loading && (report?.sales_count ?? 0) === 0 ? (
        <Card className="card-elev">
          <EmptyState
            illustration={<ChartEmptyArt />}
            title="Sin ventas en el rango"
            description="Selecciona otras fechas o registra ventas para ver datos."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <PaymentBreakdown items={report?.by_payment ?? []} loading={loading} />
            <TopProducts items={report?.top_products ?? []} loading={loading} />
          </div>
          <CategoryBreakdown items={report?.by_category ?? []} loading={loading} />
          <CashierBreakdown items={report?.by_cashier ?? []} loading={loading} />
          <Card className="card-elev">
            <CardContent className="p-0">
              <div className="border-b border-border/60 px-4 py-3 text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
                Día a día
              </div>
              {(report?.daily ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Sin ventas en el rango
                </p>
              ) : (
                <div className="max-h-[60vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Fecha</th>
                      <th className="px-4 py-2 text-right font-medium">Ventas</th>
                      <th className="px-4 py-2 text-right font-medium">Ingresos</th>
                      <th className="px-4 py-2 text-right font-medium">Ganancia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report!.daily.map((d) => (
                      <tr key={d.date} className="border-t border-border/40">
                        <td className="px-4 py-2.5 mono text-xs">{d.date}</td>
                        <td className="px-4 py-2.5 text-right num">{d.count}</td>
                        <td className="px-4 py-2.5 text-right num">{formatCLP(d.revenue)}</td>
                        <td className="px-4 py-2.5 text-right num text-success">
                          {formatCLP(d.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function PaymentBreakdown({
  items,
  loading,
}: {
  items: { method: string; total: number; count: number }[]
  loading?: boolean
}) {
  const total = items.reduce((a, i) => a + i.total, 0)
  return (
    <Card className="card-elev">
      <CardContent className="p-0">
        <div className="border-b border-border/60 px-4 py-3 text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
          Por método de pago
        </div>
        <div className="p-4">
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : items.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Sin datos</p>
          ) : (
            <Donut
              data={items.map((i) => ({ label: PAY_LABEL[i.method] ?? i.method, value: i.total }))}
              centerLabel="Total"
              centerValue={formatCLP(total)}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function CategoryBreakdown({
  items,
  loading,
}: {
  items: { name: string | null; qty: number; revenue: number; profit: number; count: number }[]
  loading?: boolean
}) {
  const totalRevenue = items.reduce((a, i) => a + i.revenue, 0)
  return (
    <Card className="card-elev">
      <CardContent className="p-0">
        <div className="border-b border-border/60 px-4 py-3 text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
          Por categoría
        </div>
        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-7" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Sin datos</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {items.map((it, idx) => {
              const pct = totalRevenue > 0 ? (it.revenue / totalRevenue) * 100 : 0
              return (
                <li key={idx} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      {it.name ?? <span className="italic text-muted-foreground">Sin categoría</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="num">{it.qty} u</span>
                      <span className="num text-success">{formatCLP(it.profit)}</span>
                      <span className="num font-semibold text-foreground">
                        {formatCLP(it.revenue)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full brand-gradient"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="num min-w-[36px] text-right text-[10px] text-muted-foreground">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

const SLOW_THRESHOLDS = [7, 15, 30, 60] as const
type SlowThreshold = (typeof SLOW_THRESHOLDS)[number]

function SlowMovingView() {
  const [days, setDays] = useState<SlowThreshold>(30)
  const [items, setItems] = useState<SlowMovingProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    setLoading(true)
    api.productsSlowMoving({ days }).then((rows) => {
      setItems(rows)
      setLoading(false)
    })
  }, [days])

  const totalValue = items.reduce((a, i) => a + i.stock_value, 0)
  const neverSold = items.filter((i) => i.last_sold_at === null).length

  const handlePrint = async () => {
    setPrinting(true)
    const r = await api.printSlowMoving(days)
    setPrinting(false)
    if (r.ok) toast({ variant: 'success', title: 'Reporte enviado a la impresora' })
    else
      toast({
        variant: 'destructive',
        title: 'No se pudo imprimir',
        description: r.error,
      })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <Label>Sin venta en los últimos</Label>
          <div className="flex gap-1 rounded-lg border border-border/60 bg-muted/30 p-1">
            {SLOW_THRESHOLDS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={cn(
                  'min-w-[64px] rounded-md px-3 py-1.5 text-sm font-medium transition',
                  days === d
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {d} días
              </button>
            ))}
          </div>
        </div>
        <Button
          variant="outline"
          onClick={handlePrint}
          disabled={printing || loading || items.length === 0}
        >
          <Printer className="h-4 w-4" /> Imprimir lista
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <KPISkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <KPI label="Productos sin rotación" value={String(items.length)} />
          <KPI
            label="Capital inmovilizado"
            value={formatCLP(totalValue)}
            accent="primary"
            hint="Valor a costo del stock detenido"
          />
          <KPI
            label="Nunca vendidos"
            value={String(neverSold)}
            hint={`Creados hace más de ${days} días`}
          />
        </div>
      )}

      {!loading && items.length === 0 ? (
        <Card className="card-elev">
          <EmptyState
            illustration={<Snail className="h-10 w-10 text-muted-foreground" />}
            title="Todo se está moviendo"
            description={`No hay productos sin venta en los últimos ${days} días.`}
          />
        </Card>
      ) : (
        <Card className="card-elev">
          <CardContent className="p-0">
            <div className="border-b border-border/60 px-4 py-3 text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
              Detalle
            </div>
            {loading ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-7" />
                ))}
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Producto</th>
                      <th className="px-4 py-2 text-left font-medium">Categoría</th>
                      <th className="px-4 py-2 text-right font-medium">Stock</th>
                      <th className="px-4 py-2 text-left font-medium">Última venta</th>
                      <th className="px-4 py-2 text-right font-medium">Días sin venta</th>
                      <th className="px-4 py-2 text-right font-medium">Inmovilizado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => (
                      <tr key={p.id} className="border-t border-border/40">
                        <td className="px-4 py-2.5 font-medium">{p.name}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {p.category ?? (
                            <span className="italic">Sin categoría</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right num">
                          {p.is_weight === 1 ? formatWeight(p.stock) : p.stock}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {p.last_sold_at ? (
                            <span className="mono text-xs">
                              {p.last_sold_at.slice(0, 10)}
                            </span>
                          ) : (
                            <span className="italic text-warning">Nunca vendido</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right num">
                          {p.days_since_sold ?? `+${p.days_since_created}`}
                        </td>
                        <td className="px-4 py-2.5 text-right num font-semibold">
                          {formatCLP(p.stock_value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function TopProducts({
  items,
  loading,
}: {
  items: { product_id: string | null; name: string; qty: number; revenue: number }[]
  loading?: boolean
}) {
  const max = items.reduce((a, i) => Math.max(a, i.qty), 0)
  return (
    <Card className="card-elev">
      <CardContent className="p-0">
        <div className="border-b border-border/60 px-4 py-3 text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
          Top productos
        </div>
        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-7" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Sin datos</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {items.map((it) => (
              <li key={it.product_id ?? `__deleted__${it.name}`} className="px-4 py-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <div className="truncate">{it.name}</div>
                  <div className="num text-xs text-muted-foreground">{it.qty} u</div>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full brand-gradient"
                      style={{ width: `${max > 0 ? (it.qty / max) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="num text-xs font-medium">{formatCLP(it.revenue)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
