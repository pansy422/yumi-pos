import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/common/PageHeader'
import { api } from '@/lib/api'
import { formatCLP, todayISO } from '@shared/money'
import type { DailyReport, RangeReport } from '@shared/types'

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
          </TabsList>
          <TabsContent value="daily">
            <DailyView />
          </TabsContent>
          <TabsContent value="range">
            <RangeView />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function KPI({ label, value, accent }: { label: string; value: string; accent?: 'success' | 'primary' }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div
          className={`num text-2xl font-bold ${accent === 'success' ? 'text-success' : accent === 'primary' ? 'text-primary' : ''}`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  )
}

function DailyView() {
  const [date, setDate] = useState(todayISO())
  const [report, setReport] = useState<DailyReport | null>(null)
  useEffect(() => {
    api.reportDaily(date).then(setReport)
  }, [date])

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label>Fecha</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <KPI label="Ventas" value={String(report?.sales_count ?? 0)} />
        <KPI label="Ingresos" value={formatCLP(report?.revenue ?? 0)} accent="primary" />
        <KPI label="Ganancia" value={formatCLP(report?.profit ?? 0)} accent="success" />
        <KPI
          label="Ticket promedio"
          value={formatCLP(report && report.sales_count ? report.revenue / report.sales_count : 0)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <PaymentBreakdown items={report?.by_payment ?? []} />
        <TopProducts items={report?.top_products ?? []} />
      </div>
    </div>
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

  useEffect(() => {
    api.reportRange(from, to).then(setReport)
  }, [from, to])

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label>Desde</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Hasta</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <KPI label="Ventas" value={String(report?.sales_count ?? 0)} />
        <KPI label="Ingresos" value={formatCLP(report?.revenue ?? 0)} accent="primary" />
        <KPI label="Ganancia" value={formatCLP(report?.profit ?? 0)} accent="success" />
        <KPI
          label="Ticket promedio"
          value={formatCLP(report && report.sales_count ? report.revenue / report.sales_count : 0)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <PaymentBreakdown items={report?.by_payment ?? []} />
        <TopProducts items={report?.top_products ?? []} />
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-2 text-xs uppercase text-muted-foreground">Día a día</div>
          {(report?.daily ?? []).length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Sin ventas en el rango</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Fecha</th>
                  <th className="px-4 py-2 text-right">Ventas</th>
                  <th className="px-4 py-2 text-right">Ingresos</th>
                  <th className="px-4 py-2 text-right">Ganancia</th>
                </tr>
              </thead>
              <tbody>
                {report!.daily.map((d) => (
                  <tr key={d.date} className="border-t">
                    <td className="px-4 py-2">{d.date}</td>
                    <td className="px-4 py-2 text-right num">{d.count}</td>
                    <td className="px-4 py-2 text-right num">{formatCLP(d.revenue)}</td>
                    <td className="px-4 py-2 text-right num text-success">{formatCLP(d.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PaymentBreakdown({
  items,
}: {
  items: { method: string; total: number; count: number }[]
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b px-4 py-2 text-xs uppercase text-muted-foreground">
          Por método de pago
        </div>
        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Sin datos</p>
        ) : (
          <ul className="divide-y">
            {items.map((it) => (
              <li key={it.method} className="flex items-center justify-between px-4 py-2 text-sm">
                <div>
                  <div>{PAY_LABEL[it.method] ?? it.method}</div>
                  <div className="text-xs text-muted-foreground">{it.count} venta(s)</div>
                </div>
                <div className="num font-semibold">{formatCLP(it.total)}</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function TopProducts({
  items,
}: {
  items: { product_id: string; name: string; qty: number; revenue: number }[]
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b px-4 py-2 text-xs uppercase text-muted-foreground">
          Top productos
        </div>
        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Sin datos</p>
        ) : (
          <ul className="divide-y">
            {items.map((it) => (
              <li
                key={it.product_id}
                className="flex items-center justify-between px-4 py-2 text-sm"
              >
                <div>
                  <div>{it.name}</div>
                  <div className="text-xs text-muted-foreground">{it.qty} unidades</div>
                </div>
                <div className="num font-semibold">{formatCLP(it.revenue)}</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
