import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileUp,
  History,
  Lock,
  RefreshCw,
  Scale,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/common/PageHeader'
import { MoneyInput } from '@/components/common/MoneyInput'
import { useToast } from '@/hooks/useToast'
import { useIsAdmin } from '@/hooks/useRole'
import { useSession } from '@/stores/session'
import { api } from '@/lib/api'
import { FUND_KIND_LABEL, PAY_LABEL, PURCHASE_PAY_LABEL } from '@/lib/labels'
import { formatCLP, formatDateCL, formatDateTimeCL } from '@shared/money'
import { cn } from '@/lib/utils'
import type {
  BankRow,
  CashFundMovementKind,
  PurchasePaymentMethod,
  ReconciliationExplanation,
  ReconciliationStatus,
  WeekReconciliation,
  WeeklyReconciliationRecord,
} from '@shared/types'

type Week = { week_start: string; week_end: string; confirmed: boolean }

const EXPL_KEYS: { key: string; label: string }[] = [
  { key: 'cash_fund', label: 'Efectivo del fondo' },
  { key: 'cash_sessions', label: 'Cierres de caja' },
  { key: 'cards', label: 'Tarjetas vs cartola' },
  { key: 'transfers', label: 'Transferencias' },
  { key: 'inventory', label: 'Inventario' },
]

function weekLabel(w: { week_start: string; week_end: string }): string {
  return `${formatDateCL(w.week_start)} → ${formatDateCL(w.week_end)}`
}

export function Reconciliation() {
  const { toast } = useToast()
  const isAdmin = useIsAdmin()
  const currentUser = useSession((s) => s.user)
  const [status, setStatus] = useState<ReconciliationStatus | null>(null)
  const [weeks, setWeeks] = useState<Week[]>([])
  const [weekStart, setWeekStart] = useState<string>('')
  const [data, setData] = useState<WeekReconciliation | null>(null)
  const [record, setRecord] = useState<WeeklyReconciliationRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [historyItems, setHistoryItems] = useState<WeeklyReconciliationRecord[]>([])
  const [bankRows, setBankRows] = useState<BankRow[]>([])
  const [fundCounted, setFundCounted] = useState<number | null>(null)
  const [bankBalance, setBankBalance] = useState<number | null>(null)
  const [explanations, setExplanations] = useState<Record<string, ReconciliationExplanation>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const loadMeta = useCallback(async () => {
    const [st, ws, hist] = await Promise.all([
      api.reconciliationStatus(),
      api.reconciliationWeeks(),
      api.reconciliationHistory(52),
    ])
    setStatus(st)
    setWeeks(ws)
    setHistoryItems(hist)
    setWeekStart((cur) => cur || st.week_start)
  }, [])

  useEffect(() => {
    loadMeta().catch((err) =>
      toast({ variant: 'destructive', title: 'No se pudo cargar el cuadre', description: String(err) }),
    )
  }, [loadMeta, toast])

  const compute = useCallback(
    async (rows: BankRow[]) => {
      if (!weekStart) return
      setLoading(true)
      try {
        const rec = await api.reconciliationGet(weekStart)
        setRecord(rec)
        if (rec?.data) {
          // Semana ya confirmada: mostramos lo guardado tal cual.
          setData(rec.data)
          setBankRows(rec.data.bank_rows ?? [])
          setFundCounted(rec.data.manual?.fund_counted ?? null)
          setBankBalance(rec.data.manual?.bank_balance ?? null)
          setExplanations(rec.data.explanations ?? {})
          return
        }
        const d = await api.reconciliationCompute(weekStart, { bank_rows: rows })
        setData(d)
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'No se pudo calcular la semana',
          description: err instanceof Error ? err.message : String(err),
        })
      } finally {
        setLoading(false)
      }
    },
    [weekStart, toast],
  )

  useEffect(() => {
    setBankRows([])
    setFundCounted(null)
    setBankBalance(null)
    setExplanations({})
    compute([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart])

  const locked = !!record
  const fundDiff = data && fundCounted != null ? fundCounted - data.cash.fund_end_calc : null

  const differences = useMemo(() => {
    if (!data) return []
    const out: { key: string; label: string; detail: string }[] = []
    if (fundDiff != null && fundDiff !== 0)
      out.push({ key: 'cash_fund', label: 'Efectivo del fondo', detail: formatCLP(fundDiff) })
    if (data.cash.sessions_difference !== 0)
      out.push({ key: 'cash_sessions', label: 'Cierres de caja', detail: formatCLP(data.cash.sessions_difference) })
    if (data.cards.rows.some((r) => r.flagged))
      out.push({ key: 'cards', label: 'Tarjetas vs cartola', detail: `${data.cards.rows.filter((r) => r.flagged).length} días fuera del 3 %` })
    if ((data.transfers.unmatched_count ?? 0) > 0)
      out.push({ key: 'transfers', label: 'Transferencias', detail: `${data.transfers.unmatched_count} sin abono` })
    if (data.inventory.difference !== 0)
      out.push({ key: 'inventory', label: 'Inventario', detail: formatCLP(data.inventory.difference) })
    return out
  }, [data, fundDiff])

  const setExpl = (key: string, patch: Partial<ReconciliationExplanation>) =>
    setExplanations((cur) => ({
      ...cur,
      [key]: { note: cur[key]?.note ?? '', pending: cur[key]?.pending ?? false, ...patch },
    }))

  const onCsv = async (file: File) => {
    const text = await file.text()
    try {
      const rows = await api.reconciliationParseBci(text)
      if (rows.length === 0) {
        toast({ variant: 'warning', title: 'No se encontraron movimientos en el archivo' })
        return
      }
      setBankRows(rows)
      await compute(rows)
      toast({ variant: 'success', title: `Cartola cargada: ${rows.length} movimientos` })
    } catch (err) {
      toast({ variant: 'destructive', title: 'No se pudo leer la cartola', description: String(err) })
    }
  }

  const confirm = async () => {
    if (!data) return
    setConfirming(true)
    try {
      await api.reconciliationConfirm({
        week_start: data.week_start,
        data: {
          ...data,
          bank_rows: bankRows,
          manual: { fund_counted: fundCounted, bank_balance: bankBalance },
          explanations,
        },
        user_id: currentUser?.id ?? null,
      })
      toast({ variant: 'success', title: 'Semana confirmada', description: weekLabel(data) })
      await loadMeta()
      await compute(bankRows)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'No se pudo confirmar',
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Cuadre semanal"
        description="Ventas, compras, efectivo, tarjetas, transferencias e inventario de la semana, con cada diferencia explicada."
        actions={
          <>
            <Select value={weekStart} onValueChange={setWeekStart}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Semana" />
              </SelectTrigger>
              <SelectContent>
                {weeks.map((w) => (
                  <SelectItem key={w.week_start} value={w.week_start}>
                    {weekLabel(w)} {w.confirmed ? '✓' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => compute(bankRows)} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Recalcular
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-4 p-6">
        {status?.required && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <Lock className="mt-0.5 h-4 w-4" />
            <div>
              <div className="font-medium">La venta está bloqueada</div>
              <p className="mt-0.5 text-[11px] opacity-90">
                La semana {weekLabel(status)} no tiene cuadre confirmado. Un administrador debe
                completarlo para volver a vender.
              </p>
            </div>
          </div>
        )}
        {record && (
          <div className="flex items-start gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">
            <CheckCircle2 className="mt-0.5 h-4 w-4" />
            <div>
              <div className="font-medium">Semana confirmada</div>
              <p className="mt-0.5 text-[11px] opacity-90">
                {formatDateTimeCL(record.confirmed_at)}
                {record.user_name ? ` por ${record.user_name}` : ''}. Se muestran los valores
                guardados.
              </p>
            </div>
          </div>
        )}

        {!data ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {loading ? 'Calculando…' : 'Elige una semana.'}
          </p>
        ) : (
          <>
            {data.carried_pending.length > 0 && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" /> Pendientes arrastrados de la semana anterior
                </div>
                <ul className="mt-1 list-disc pl-6 text-[12px]">
                  {data.carried_pending.map((c) => (
                    <li key={c.key}>
                      {EXPL_KEYS.find((k) => k.key === c.key)?.label ?? c.key}
                      {c.note ? `: ${c.note}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Entradas manuales */}
            <Card className="card-elev">
              <CardContent className="grid gap-4 p-4 md:grid-cols-3">
                <div className="space-y-1">
                  <Label>Efectivo contado en el fondo</Label>
                  <MoneyInput
                    value={fundCounted ?? 0}
                    onValueChange={(n) => setFundCounted(n)}
                    disabled={locked}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Calculado al domingo: <span className="num">{formatCLP(data.cash.fund_end_calc)}</span>
                  </p>
                </div>
                <div className="space-y-1">
                  <Label>Saldo del banco al domingo (opcional)</Label>
                  <MoneyInput
                    value={bankBalance ?? 0}
                    onValueChange={(n) => setBankBalance(n)}
                    disabled={locked}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Cartola BCI (CSV)</Label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) onCsv(f)
                      e.target.value = ''
                    }}
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => fileRef.current?.click()}
                    disabled={locked}
                  >
                    <FileUp className="h-4 w-4" />{' '}
                    {bankRows.length ? `${bankRows.length} movimientos cargados` : 'Cargar cartola'}
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Columnas: fecha, descripción, cargo, abono, saldo.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* 1. Ventas */}
              <Section n={1} title="Ventas" total={data.sales.total} hint={`${data.sales.count} boletas`}>
                <Rows
                  rows={data.sales.by_method.map((m) => ({
                    label: PAY_LABEL[m.method] ?? m.method,
                    sub: `${m.count} boletas`,
                    value: m.total,
                  }))}
                />
                <table className="mt-2 w-full text-[11px]">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-1 text-left">Día</th>
                      <th className="text-right">Efectivo</th>
                      <th className="text-right">Tarjetas</th>
                      <th className="text-right">Transf.</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sales.by_day.map((d) => (
                      <tr key={d.date} className="border-t border-border/40">
                        <td className="py-1">{formatDateCL(d.date)}</td>
                        <td className="num text-right">{formatCLP(d.efectivo)}</td>
                        <td className="num text-right">{formatCLP(d.debito + d.credito)}</td>
                        <td className="num text-right">{formatCLP(d.transferencia)}</td>
                        <td className="num text-right font-semibold">{formatCLP(d.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>

              {/* 2. Compras */}
              <Section n={2} title="Compras" total={data.purchases.total} hint={`${data.purchases.count} compras`}>
                <Rows
                  rows={data.purchases.by_method.map((m) => ({
                    label: PURCHASE_PAY_LABEL[m.method as PurchasePaymentMethod] ?? m.method,
                    sub: `${m.count}`,
                    value: m.total,
                  }))}
                />
                <div className="mt-2 text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
                  Por proveedor
                </div>
                <Rows
                  rows={data.purchases.by_supplier.slice(0, 10).map((s) => ({
                    label: s.supplier,
                    sub: `${s.count}`,
                    value: s.total,
                  }))}
                />
              </Section>

              {/* 3. Efectivo */}
              <Section
                n={3}
                title="Efectivo"
                total={data.cash.fund_end_calc}
                hint="fondo calculado al domingo"
                flagged={(fundDiff != null && fundDiff !== 0) || data.cash.sessions_difference !== 0}
              >
                <Rows
                  rows={[
                    { label: 'Ventas en efectivo', value: data.cash.cash_sales },
                    { label: 'Retiros del cajón durante el día', value: -data.cash.withdrawals_total },
                    { label: 'Diferencias de cierre (contado − esperado)', value: data.cash.sessions_difference },
                    { label: 'Fondo al inicio de la semana', value: data.cash.fund_start },
                    { label: '+ Retiros al fondo (cierres)', value: data.cash.fund_in_from_register },
                    ...data.cash.fund_out_by_kind.map((k) => ({
                      label: `− ${FUND_KIND_LABEL[k.kind as CashFundMovementKind] ?? k.kind}`,
                      sub: `${k.count}`,
                      value: k.total,
                    })),
                    ...(data.cash.fund_adjustments !== 0
                      ? [{ label: 'Ajustes por conteo', value: data.cash.fund_adjustments }]
                      : []),
                    { label: '= Fondo esperado', value: data.cash.fund_end_calc, strong: true },
                    ...(fundCounted != null
                      ? [
                          { label: 'Contado', value: fundCounted },
                          { label: 'Diferencia', value: fundDiff ?? 0, strong: true, danger: (fundDiff ?? 0) !== 0 },
                        ]
                      : []),
                  ]}
                />
                {data.cash.withdrawals.length > 0 && (
                  <Details title={`Retiros del cajón (${data.cash.withdrawals.length})`}>
                    {data.cash.withdrawals.map((w, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span className="truncate">
                          {formatDateCL(w.created_at)} · {w.reason}
                          {w.counterparty ? ` · ${w.counterparty}` : ''}
                        </span>
                        <span className="num">{formatCLP(w.amount)}</span>
                      </li>
                    ))}
                  </Details>
                )}
                {data.cash.fund_out.length > 0 && (
                  <Details title={`Salidas del fondo (${data.cash.fund_out.length})`}>
                    {data.cash.fund_out.map((m, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span className="truncate">
                          {formatDateCL(m.created_at)} · {FUND_KIND_LABEL[m.kind as CashFundMovementKind] ?? m.kind}
                          {m.counterparty ? ` · ${m.counterparty}` : ''} · {m.reason}
                        </span>
                        <span className="num">{formatCLP(m.amount)}</span>
                      </li>
                    ))}
                  </Details>
                )}
                {data.cash.sessions.some((s) => (s.difference ?? 0) !== 0) && (
                  <Details title="Cierres con diferencia">
                    {data.cash.sessions
                      .filter((s) => (s.difference ?? 0) !== 0)
                      .map((s) => (
                        <li key={s.id} className="flex justify-between gap-2">
                          <span className="truncate">
                            {formatDateCL(s.opened_at)} · {s.difference_note ?? 'sin explicación'}
                          </span>
                          <span className="num">{formatCLP(s.difference ?? 0)}</span>
                        </li>
                      ))}
                  </Details>
                )}
              </Section>

              {/* 4. Tarjetas */}
              <Section
                n={4}
                title="Tarjetas vs cartola"
                total={data.cards.expected_total}
                hint={data.cards.received_total != null ? `recibido ${formatCLP(data.cards.received_total)}` : 'carga la cartola para comparar'}
                flagged={data.cards.rows.some((r) => r.flagged)}
              >
                <table className="w-full text-[11px]">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-1 text-left">Abono</th>
                      <th className="text-left">Ventas de</th>
                      <th className="text-right">Esperado</th>
                      <th className="text-right">Recibido</th>
                      <th className="text-right">Dif.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cards.rows.map((r) => (
                      <tr
                        key={r.settle_date}
                        className={cn('border-t border-border/40', r.flagged && 'bg-destructive/10 text-destructive')}
                      >
                        <td className="py-1">{formatDateCL(r.settle_date)}</td>
                        <td className="text-muted-foreground">
                          {r.sales_days.map((d) => formatDateCL(d).slice(0, 5)).join(', ')}
                        </td>
                        <td className="num text-right">{formatCLP(r.expected)}</td>
                        <td className="num text-right">{r.received == null ? '—' : formatCLP(r.received)}</td>
                        <td className="num text-right font-semibold">
                          {r.difference == null ? '—' : formatCLP(r.difference)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  El abono del día D corresponde a las ventas de D−1 hábil; el lunes agrupa
                  viernes a domingo. Se marca en rojo lo que difiere más de 3 %.
                </p>
              </Section>

              {/* 5. Transferencias */}
              <Section
                n={5}
                title="Transferencias"
                total={data.transfers.expected_total}
                hint={
                  data.transfers.received_total != null
                    ? `recibido ${formatCLP(data.transfers.received_total)} · ${data.transfers.unmatched_count} sin abono`
                    : 'carga la cartola para comparar'
                }
                flagged={(data.transfers.unmatched_count ?? 0) > 0}
              >
                {data.transfers.rows.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">Sin ventas por transferencia.</p>
                ) : (
                  <ul className="space-y-0.5 text-[11px]">
                    {data.transfers.rows.map((t) => (
                      <li
                        key={t.sale_number}
                        className={cn('flex justify-between gap-2', t.matched === false && 'text-destructive font-medium')}
                      >
                        <span>
                          Boleta #{t.sale_number} · {formatDateCL(t.date)}
                          {t.matched === true && t.bank_date ? ` · abono ${formatDateCL(t.bank_date)}` : ''}
                          {t.matched === false ? ' · NO RECIBIDA' : ''}
                        </span>
                        <span className="num">{formatCLP(t.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {/* 6. Inventario */}
              <Section
                n={6}
                title="Inventario a costo"
                total={data.inventory.value_end_real}
                hint="valor real al domingo"
                flagged={data.inventory.difference !== 0}
              >
                <Rows
                  rows={[
                    { label: 'Valor inicial', value: data.inventory.value_start },
                    { label: '+ Entradas', value: data.inventory.entries },
                    { label: '+ Devoluciones', value: data.inventory.returns },
                    { label: '− Vendido a costo', value: -data.inventory.sold_cost },
                    { label: '− Mermas', value: -data.inventory.writeoffs },
                    { label: '± Ajustes manuales', value: data.inventory.manual },
                    { label: '= Final calculado', value: data.inventory.value_end_calc, strong: true },
                    { label: 'Final real (catálogo)', value: data.inventory.value_end_real },
                    {
                      label: 'Diferencia',
                      value: data.inventory.difference,
                      strong: true,
                      danger: data.inventory.difference !== 0,
                    },
                    ...(data.inventory.sold_without_stock > 0
                      ? [{ label: 'de lo cual: vendido sin stock', value: data.inventory.sold_without_stock, danger: true }]
                      : []),
                  ]}
                />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {data.inventory.movements_count} movimientos de stock en la semana. Lo vendido sin
                  stock y los cambios de costo explican la mayoría de las diferencias.
                </p>
              </Section>
            </div>

            {/* 7. Diferencias */}
            <Card className={cn('card-elev', differences.length > 0 && 'border-warning/40')}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
                  <Scale className="h-3.5 w-3.5" /> 7 · Diferencias
                </div>
                {differences.length === 0 ? (
                  <p className="mt-2 text-sm text-success">Sin diferencias: la semana cuadra.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {differences.map((d) => {
                      const e = explanations[d.key] ?? { note: '', pending: false }
                      return (
                        <div key={d.key} className="grid gap-2 rounded-lg border border-border/60 p-3 md:grid-cols-[200px_1fr_auto]">
                          <div>
                            <div className="text-sm font-medium">{d.label}</div>
                            <div className="num text-[12px] text-warning">{d.detail}</div>
                          </div>
                          <Input
                            placeholder="Explicación"
                            value={e.note}
                            onChange={(ev) => setExpl(d.key, { note: ev.target.value })}
                            disabled={locked}
                          />
                          <label className="flex items-center gap-2 text-[12px]">
                            <Switch
                              checked={e.pending}
                              onCheckedChange={(v) => setExpl(d.key, { pending: v })}
                              disabled={locked}
                            />
                            Pendiente
                          </label>
                        </div>
                      )
                    })}
                  </div>
                )}
                {!locked && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">
                      {isAdmin
                        ? 'Al confirmar, el cuadre queda guardado y consultable en el historial.'
                        : 'Solo un administrador puede confirmar el cuadre.'}
                    </p>
                    <Button variant="success" onClick={confirm} disabled={confirming || !isAdmin}>
                      <CheckCircle2 className="h-4 w-4" /> {confirming ? 'Confirmando…' : 'Confirmar semana'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {historyItems.length > 0 && (
          <Card className="card-elev">
            <CardContent className="p-0">
              <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3 text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
                <History className="h-3.5 w-3.5" /> Historial de cuadres
              </div>
              <table className="w-full text-sm">
                <thead className="text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">Semana</th>
                    <th className="px-4 py-2 text-right">Ventas</th>
                    <th className="px-4 py-2 text-right">Compras</th>
                    <th className="px-4 py-2 text-right">Fondo</th>
                    <th className="px-4 py-2 text-right">Inventario</th>
                    <th className="px-4 py-2 text-left">Confirmado</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map((h) => (
                    <tr
                      key={h.id}
                      className="cursor-pointer border-t border-border/40 hover:bg-accent/30"
                      onClick={() => setWeekStart(h.week_start)}
                    >
                      <td className="px-4 py-2">{weekLabel(h)}</td>
                      <td className="num px-4 py-2 text-right">{formatCLP(h.data?.sales.total ?? 0)}</td>
                      <td className="num px-4 py-2 text-right">{formatCLP(h.data?.purchases.total ?? 0)}</td>
                      <td className="num px-4 py-2 text-right">
                        {h.data?.manual.fund_counted != null ? formatCLP(h.data.manual.fund_counted) : '—'}
                      </td>
                      <td className="num px-4 py-2 text-right">{formatCLP(h.data?.inventory.value_end_real ?? 0)}</td>
                      <td className="px-4 py-2 text-[12px] text-muted-foreground">
                        {formatDateTimeCL(h.confirmed_at)}
                        {h.user_name ? ` · ${h.user_name}` : ''}
                        {h.data && Object.values(h.data.explanations ?? {}).some((e) => e.pending) && (
                          <Badge variant="warning" className="ml-2">pendientes</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function Section({
  n,
  title,
  total,
  hint,
  flagged,
  children,
}: {
  n: number
  title: string
  total: number
  hint?: string
  flagged?: boolean
  children: React.ReactNode
}) {
  return (
    <Card className={cn('card-elev', flagged && 'border-warning/50')}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
              {n} · {title}
            </div>
            {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
          </div>
          <div className={cn('num text-xl font-semibold tracking-display-tight', flagged && 'text-warning')}>
            {formatCLP(total)}
          </div>
        </div>
        <div className="mt-3">{children}</div>
      </CardContent>
    </Card>
  )
}

function Rows({
  rows,
}: {
  rows: { label: string; sub?: string; value: number; strong?: boolean; danger?: boolean }[]
}) {
  if (rows.length === 0) return <p className="text-[11px] text-muted-foreground">Sin datos.</p>
  return (
    <ul className="space-y-0.5 text-[12px]">
      {rows.map((r, i) => (
        <li key={i} className={cn('flex items-center justify-between gap-2', r.strong && 'font-semibold')}>
          <span className="truncate">
            {r.label}
            {r.sub && <span className="text-muted-foreground"> · {r.sub}</span>}
          </span>
          <span className={cn('num', r.danger && 'text-destructive')}>{formatCLP(r.value)}</span>
        </li>
      ))}
    </ul>
  )
}

function Details({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2 rounded-md border border-border/40">
      <button
        type="button"
        className="flex w-full items-center justify-between px-2 py-1.5 text-[11px] font-medium"
        onClick={() => setOpen((v) => !v)}
      >
        {title}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <ul className="space-y-0.5 border-t border-border/40 px-2 py-1.5 text-[11px]">{children}</ul>}
    </div>
  )
}
