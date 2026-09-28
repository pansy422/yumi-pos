import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Calculator,
  Clock,
  DoorOpen,
  History,
  Lock,
  PiggyBank,
  Plus,
  User as UserIcon,
  Wallet,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { FUND_KIND_LABEL } from '@/lib/labels'
import { formatCLP, formatDateTimeCL } from '@shared/money'
import type {
  CashCloseDestination,
  CashCloseDestinationKind,
  CashFundMovement,
  CashFundMovementKind,
  CashMovement,
  CashSessionSummary,
} from '@shared/types'

function fmtDate(s: string | null): string {
  return s ? formatDateTimeCL(s) || '—' : '—'
}

const KIND_LABEL: Record<CashMovement['kind'], string> = {
  sale: 'Venta',
  deposit: 'Depósito',
  withdraw: 'Retiro',
  adjustment: 'Ajuste',
}

const DEST_LABEL: Record<CashCloseDestinationKind, string> = {
  fondo: 'Fondo de efectivo',
  proveedor: 'Proveedor',
  dueño: 'Dueño',
  otro: 'Otro',
}

export function Cash() {
  const { toast } = useToast()
  const cash = useSession((s) => s.cash)
  const refresh = useSession((s) => s.refresh)
  const userCount = useSession((s) => s.userCount)
  const currentUser = useSession((s) => s.user)
  const isAdmin = useIsAdmin()
  // Si hay usuarios creados pero ninguno logueado, no se puede abrir
  // la caja — sin saber quién la abre, las ventas no quedarían
  // asignadas a nadie y se rompe la auditoría.
  const needsLogin = userCount > 0 && !currentUser

  const [openDlg, setOpenDlg] = useState(false)
  const [closeDlg, setCloseDlg] = useState(false)
  const [moveDlg, setMoveDlg] = useState(false)
  const [historyDlg, setHistoryDlg] = useState(false)
  const [fundOutDlg, setFundOutDlg] = useState(false)
  const [fundCountDlg, setFundCountDlg] = useState(false)
  const [fundSeedDlg, setFundSeedDlg] = useState(false)
  const [movements, setMovements] = useState<CashMovement[]>([])
  const [fundBalance, setFundBalance] = useState<number | null>(null)
  const [fundMovs, setFundMovs] = useState<CashFundMovement[]>([])
  const [summary, setSummary] = useState<{
    expected: number
    cashSales: number
    movsIn: number
    movsOut: number
    salesCount: number
  } | null>(null)

  const reloadFund = async () => {
    try {
      const [b, list] = await Promise.all([api.fundBalance(), api.fundList({ limit: 12 })])
      setFundBalance(b)
      setFundMovs(list)
    } catch (err) {
      console.error('[caja] fondo', err)
    }
  }

  const reload = async () => {
    await reloadFund()
    if (!cash) return
    const [ms, s] = await Promise.all([api.cashMovements(cash.id), api.cashSummary(cash.id)])
    setMovements(ms)
    setSummary({
      expected: s.expected,
      cashSales: s.cash_sales,
      movsIn: s.deposits,
      movsOut: s.withdraws,
      salesCount: s.sales_count,
    })
  }

  useEffect(() => {
    reloadFund()
    if (!cash) {
      setMovements([])
      setSummary(null)
      return
    }
    let cancelled = false
    Promise.all([api.cashMovements(cash.id), api.cashSummary(cash.id)]).then(([ms, s]) => {
      if (cancelled) return
      setMovements(ms)
      setSummary({
        expected: s.expected,
        cashSales: s.cash_sales,
        movsIn: s.deposits,
        movsOut: s.withdraws,
        salesCount: s.sales_count,
      })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cash])

  const fundEmpty = fundBalance === 0 && fundMovs.length === 0

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Caja"
        description={
          cash
            ? `Sesión abierta${cash.opened_by_name ? ` por ${cash.opened_by_name}` : ''}`
            : 'No hay caja abierta'
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setHistoryDlg(true)}>
              <History className="h-4 w-4" /> Historial
            </Button>
            {cash ? (
              <>
                <Button variant="outline" onClick={() => setMoveDlg(true)}>
                  <ArrowUpFromLine className="h-4 w-4" /> Retiro / Depósito
                </Button>
                <Button variant="warning" onClick={() => setCloseDlg(true)}>
                  <Lock className="h-4 w-4" /> Cerrar caja
                </Button>
              </>
            ) : (
              <Button
                variant="success"
                onClick={() => setOpenDlg(true)}
                disabled={needsLogin}
                title={needsLogin ? 'Iniciá sesión primero' : undefined}
              >
                <DoorOpen className="h-4 w-4" /> Abrir caja
              </Button>
            )}
          </>
        }
      />

      <div className="grid flex-1 grid-cols-3 gap-4 p-6">
        <Card className="card-elev">
          <CardContent className="space-y-3 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Estado</span>
              {cash ? <Badge variant="success">Abierta</Badge> : <Badge variant="warning">Cerrada</Badge>}
            </div>
            {cash && (
              <>
                {cash.opened_by_name && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Cajero a cargo</span>
                    <span className="flex items-center gap-1.5 font-medium tracking-tight">
                      <UserIcon className="h-3.5 w-3.5 text-primary" />
                      {cash.opened_by_name}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Apertura</span>
                  <span>{fmtDate(cash.opened_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Monto inicial</span>
                  <span className="num">{formatCLP(cash.opening_amount)}</span>
                </div>
                {cash.notes && (
                  <div className="text-xs text-muted-foreground">{cash.notes}</div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardContent className="p-4">
            {!cash ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Abre la caja para empezar a vender en efectivo.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Ventas en efectivo" value={summary?.cashSales ?? 0} />
                <Stat label="Depósitos" value={summary?.movsIn ?? 0} />
                <Stat label="Retiros" value={-(summary?.movsOut ?? 0)} />
                <Stat label="Esperado en caja" value={summary?.expected ?? 0} highlight />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fondo de efectivo: saldo vivo del efectivo fuera del cajón. */}
        <Card className="card-elev col-span-3">
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <PiggyBank className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
                    Fondo de efectivo (fuera del cajón)
                  </div>
                  <div
                    className={cn(
                      'num text-2xl font-semibold leading-none tracking-display-tight',
                      (fundBalance ?? 0) < 0 ? 'text-destructive' : 'brand-text',
                    )}
                  >
                    {fundBalance == null ? '—' : formatCLP(fundBalance)}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {fundEmpty && isAdmin && (
                  <Button variant="outline" onClick={() => setFundSeedDlg(true)}>
                    <Plus className="h-4 w-4" /> Registrar saldo inicial
                  </Button>
                )}
                <Button variant="outline" onClick={() => setFundOutDlg(true)}>
                  <ArrowUpFromLine className="h-4 w-4" /> Salida del fondo
                </Button>
                <Button variant="outline" onClick={() => setFundCountDlg(true)}>
                  <Calculator className="h-4 w-4" /> Contar fondo
                </Button>
              </div>
            </div>
            {fundMovs.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Sin movimientos del fondo todavía. Sube con los retiros al cerrar caja y baja con
                pagos en efectivo (compras, gastos, retiros del dueño).
              </p>
            ) : (
              <ul className="divide-y divide-border/40">
                {fundMovs.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-accent/30"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium tracking-tight">
                        {FUND_KIND_LABEL[m.kind]}
                        {m.counterparty && (
                          <span className="text-muted-foreground"> · {m.counterparty}</span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {m.reason} · {fmtDate(m.created_at)}
                        {m.user_name ? ` · ${m.user_name}` : ''}
                      </div>
                    </div>
                    <div
                      className={cn(
                        'num font-semibold tabular-nums',
                        m.amount >= 0 ? 'text-success' : 'text-destructive',
                      )}
                    >
                      {formatCLP(m.amount)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {cash && (
          <Card className="card-elev col-span-3">
            <CardContent className="p-0">
              <div className="border-b border-border/60 px-4 py-3 text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
                Movimientos de caja
              </div>
              {movements.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Sin movimientos en esta sesión.
                </p>
              ) : (
                <ul className="divide-y divide-border/40">
                  {movements.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium tracking-tight">
                          {KIND_LABEL[m.kind]}
                          {m.counterparty && (
                            <span className="text-muted-foreground"> · {m.counterparty}</span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 truncate text-[11px] text-muted-foreground">
                          {m.cashier_name && (
                            <span className="flex items-center gap-0.5 font-medium text-foreground/70">
                              <UserIcon className="h-3 w-3" />
                              {m.cashier_name}
                            </span>
                          )}
                          {m.cashier_name && <span>·</span>}
                          {(m.reason || m.note) && (
                            <>
                              <span className="truncate">{m.reason ?? m.note}</span>
                              <span>·</span>
                            </>
                          )}
                          <span>{fmtDate(m.created_at)}</span>
                        </div>
                      </div>
                      <div
                        className={cn(
                          'num font-semibold tabular-nums',
                          m.amount >= 0 ? 'text-success' : 'text-destructive',
                        )}
                      >
                        {formatCLP(m.kind === 'withdraw' ? -m.amount : m.amount)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <OpenDialog
        open={openDlg}
        onOpenChange={setOpenDlg}
        onDone={async () => {
          setOpenDlg(false)
          await refresh()
          toast({ variant: 'success', title: 'Caja abierta' })
        }}
      />
      <CloseDialog
        open={closeDlg}
        onOpenChange={setCloseDlg}
        expected={summary?.expected ?? 0}
        onDone={async (diff, sessionId, printZ) => {
          setCloseDlg(false)
          await refresh()
          await reloadFund()
          toast({
            variant: diff === 0 ? 'success' : 'warning',
            title: 'Caja cerrada',
            description: diff === 0 ? 'Cuadra perfecta' : `Diferencia: ${formatCLP(diff)}`,
          })
          if (printZ && sessionId) {
            const r = await api.printZReport(sessionId)
            if (!r.ok) {
              toast({
                variant: 'destructive',
                title: 'No se imprimió el Z',
                description: r.error,
              })
            }
          }
        }}
      />
      <MoveDialog
        open={moveDlg}
        onOpenChange={setMoveDlg}
        onDone={async () => {
          setMoveDlg(false)
          await reload()
          await refresh()
          toast({ variant: 'success', title: 'Movimiento registrado' })
        }}
      />
      <FundOutDialog
        open={fundOutDlg}
        onOpenChange={setFundOutDlg}
        onDone={async () => {
          setFundOutDlg(false)
          await reloadFund()
          toast({ variant: 'success', title: 'Salida del fondo registrada' })
        }}
      />
      <FundSeedDialog
        open={fundSeedDlg}
        onOpenChange={setFundSeedDlg}
        onDone={async () => {
          setFundSeedDlg(false)
          await reloadFund()
          toast({ variant: 'success', title: 'Saldo inicial del fondo registrado' })
        }}
      />
      <FundCountDialog
        open={fundCountDlg}
        onOpenChange={setFundCountDlg}
        onDone={async (diff) => {
          setFundCountDlg(false)
          await reloadFund()
          toast({
            variant: diff === 0 ? 'success' : 'warning',
            title: 'Fondo contado',
            description: diff === 0 ? 'Cuadra perfecto' : `Ajuste registrado: ${formatCLP(diff)}`,
          })
        }}
      />
      <HistoryDialog open={historyDlg} onOpenChange={setHistoryDlg} />
    </div>
  )
}

function HistoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [items, setItems] = useState<CashSessionSummary[] | null>(null)

  useEffect(() => {
    if (!open) return
    setItems(null)
    api.cashHistory({ limit: 100 }).then(setItems)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 tracking-display-tight">
            <History className="h-5 w-5 text-primary" />
            Historial de cajas
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto rounded-md border border-border/60">
          {items == null ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aún no hay sesiones cerradas para mostrar.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-card/90 text-[10px] font-semibold uppercase tracking-caps text-muted-foreground backdrop-blur-md">
                <tr>
                  <th className="px-3 py-3 text-left">Apertura</th>
                  <th className="px-3 py-3 text-left">Cierre</th>
                  <th className="px-3 py-3 text-left">Cajero</th>
                  <th className="px-3 py-3 text-right">Ventas</th>
                  <th className="px-3 py-3 text-right">Efectivo</th>
                  <th className="px-3 py-3 text-right">Esperado</th>
                  <th className="px-3 py-3 text-right">Contado</th>
                  <th className="px-3 py-3 text-right">Quedó</th>
                  <th className="px-3 py-3 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => {
                  const diff = s.difference ?? 0
                  return (
                    <tr key={s.id} className="border-t border-border/40 hover:bg-accent/30">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5 text-[12px]">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {fmtDate(s.opened_at)}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[12px]">{fmtDate(s.closed_at)}</td>
                      <td className="px-3 py-2.5 text-[12px]">
                        {s.opened_by_name && s.closed_by_name && s.opened_by_name !== s.closed_by_name
                          ? `${s.opened_by_name} → ${s.closed_by_name}`
                          : s.opened_by_name ?? s.closed_by_name ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right num">{s.sales_count}</td>
                      <td className="px-3 py-2.5 text-right num text-muted-foreground">
                        {formatCLP(s.cash_sales)}
                      </td>
                      <td className="px-3 py-2.5 text-right num">
                        {s.expected_close != null ? formatCLP(s.expected_close) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right num">
                        {s.counted_close != null ? formatCLP(s.counted_close) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right num text-muted-foreground">
                        {s.register_float != null ? formatCLP(s.register_float) : '—'}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2.5 text-right num font-semibold',
                          diff === 0
                            ? 'text-success'
                            : diff > 0
                              ? 'text-foreground'
                              : 'text-destructive',
                        )}
                        title={s.difference_note ?? undefined}
                      >
                        {s.difference != null ? formatCLP(diff) : '—'}
                        {s.difference_note && (
                          <div className="max-w-[160px] truncate text-[10px] font-normal text-muted-foreground">
                            {s.difference_note}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={`rounded-lg border p-4 transition-colors ${
        highlight
          ? 'border-primary/25 bg-gradient-to-br from-brand-1/8 via-card to-brand-2/4'
          : 'border-border/60 bg-muted/30'
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
        {label}
      </div>
      <div
        className={`num mt-1.5 font-semibold leading-none ${
          highlight
            ? 'text-[26px] tracking-display-tight brand-text'
            : 'text-[22px] tracking-display-tight'
        } ${value < 0 ? 'text-destructive' : ''}`}
      >
        {formatCLP(value)}
      </div>
    </div>
  )
}

function OpenDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onDone: () => void
}) {
  const { toast } = useToast()
  const currentUser = useSession((s) => s.user)
  const [amount, setAmount] = useState(0)
  const [proposed, setProposed] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setAmount(0)
      setProposed(null)
      setNotes('')
      // La apertura se llena sola con lo que quedó en el cajón al cerrar
      // (fondo fijo). La cajera puede corregirlo si contó otra cosa.
      api
        .cashLastRegisterFloat()
        .then((n) => {
          setProposed(n)
          setAmount(n)
        })
        .catch(() => undefined)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Abrir caja</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Monto inicial en efectivo</Label>
            <MoneyInput value={amount} onValueChange={setAmount} autoFocus />
            {proposed != null && (
              <p className="text-[11px] text-muted-foreground">
                Propuesto: {formatCLP(proposed)} (lo que quedó en el cajón al último cierre).
                Si contaste otra cosa, corrígelo.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Notas (opcional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={saving || !Number.isFinite(amount) || amount < 0}
            onClick={async () => {
              if (!Number.isFinite(amount) || amount < 0) {
                toast({
                  variant: 'warning',
                  title: 'Monto inválido',
                  description: 'El monto inicial no puede ser negativo.',
                })
                return
              }
              setSaving(true)
              try {
                await api.cashOpen(amount, notes || undefined, currentUser?.id ?? null)
                onDone()
              } catch (err) {
                toast({
                  variant: 'destructive',
                  title: 'No se pudo abrir',
                  description: err instanceof Error ? err.message : String(err),
                })
              } finally {
                setSaving(false)
              }
            }}
          >
            Abrir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type DestRow = CashCloseDestination & { id: number }

function CloseDialog({
  open,
  onOpenChange,
  expected,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  expected: number
  onDone: (diff: number, sessionId: string | null, printZ: boolean) => void
}) {
  const { toast } = useToast()
  const settings = useSession((s) => s.settings)
  const cash = useSession((s) => s.cash)
  const currentUser = useSession((s) => s.user)
  const [counted, setCounted] = useState(0)
  const [touched, setTouched] = useState(false)
  const [registerFloat, setRegisterFloat] = useState(0)
  const [dests, setDests] = useState<DestRow[]>([])
  const [differenceNote, setDifferenceNote] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [printZ, setPrintZ] = useState(true)

  // El campo counted arranca en 0 a propósito: si lo igualábamos a
  // `expected` por defecto, la cajera podía pegarle Confirmar sin contar
  // físicamente y la diferencia siempre saldría 0.
  useEffect(() => {
    if (open) {
      setCounted(0)
      setTouched(false)
      setRegisterFloat(settings?.cash.register_float ?? 0)
      setDests([{ id: 1, kind: 'fondo', amount: 0 }])
      setDifferenceNote('')
      setNotes('')
      setPrintZ(!!settings?.printer.enabled)
      api
        .cashLastRegisterFloat()
        .then((n) => setRegisterFloat(n))
        .catch(() => undefined)
    }
  }, [open, settings])

  const diff = counted - expected
  const toWithdraw = Math.max(0, counted - registerFloat)
  const destSum = dests.reduce((a, d) => a + (d.amount || 0), 0)
  const destRemaining = toWithdraw - destSum
  const floatTooHigh = registerFloat > counted

  // Un solo destino: se ajusta solo al monto a retirar para no obligar a
  // tipear el número dos veces.
  useEffect(() => {
    if (dests.length === 1) {
      setDests((cur) => (cur[0].amount === toWithdraw ? cur : [{ ...cur[0], amount: toWithdraw }]))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toWithdraw, dests.length])

  const destsValid =
    !floatTooHigh &&
    destRemaining === 0 &&
    dests.every(
      (d) =>
        (toWithdraw === 0 || d.amount > 0) &&
        (d.kind !== 'proveedor' || !!d.name?.trim()) &&
        (d.kind !== 'otro' || !!d.reason?.trim()),
    )
  const diffValid = diff === 0 || differenceNote.trim().length > 0
  const canClose =
    !saving && !!cash && touched && Number.isFinite(counted) && counted >= 0 && destsValid && diffValid

  const updateDest = (id: number, patch: Partial<DestRow>) =>
    setDests((cur) => cur.map((d) => (d.id === id ? { ...d, ...patch } : d)))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cerrar caja</DialogTitle>
          <DialogDescription>
            Cuatro pasos, en orden: contado, lo que queda en el cajón, adónde va el resto y la
            diferencia. Sin eso la caja no se cierra.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Stat label="Esperado" value={expected} highlight />

          <Step n={1} title="Contado" done={touched}>
            <Label>Efectivo físico en el cajón</Label>
            <MoneyInput
              value={counted}
              onValueChange={(n) => {
                setCounted(n)
                setTouched(true)
              }}
              autoFocus
            />
            {!touched && (
              <p className="text-[11px] text-muted-foreground">
                Contá físicamente el efectivo y tipea el total.
              </p>
            )}
          </Step>

          <Step n={2} title="Queda en cajón para mañana" done={touched && !floatTooHigh}>
            <MoneyInput value={registerFloat} onValueChange={setRegisterFloat} />
            {floatTooHigh ? (
              <p className="text-[11px] text-destructive">
                No puede quedar más de lo contado.
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Fondo fijo. La apertura de mañana se llena sola con este monto.
              </p>
            )}
          </Step>

          <Step n={3} title={`Se retira ${formatCLP(toWithdraw)}`} done={touched && destsValid}>
            {toWithdraw === 0 ? (
              <p className="text-[11px] text-muted-foreground">No hay nada que retirar.</p>
            ) : (
              <div className="space-y-2">
                {dests.map((d) => (
                  <div key={d.id} className="grid grid-cols-[1fr_auto_auto] items-start gap-2">
                    <div className="space-y-1">
                      <Select
                        value={d.kind}
                        onValueChange={(v) =>
                          updateDest(d.id, { kind: v as CashCloseDestinationKind })
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(DEST_LABEL) as CashCloseDestinationKind[]).map((k) => (
                            <SelectItem key={k} value={k}>
                              {DEST_LABEL[k]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {d.kind === 'proveedor' && (
                        <Input
                          className="h-9"
                          placeholder="Nombre del proveedor *"
                          value={d.name ?? ''}
                          onChange={(e) => updateDest(d.id, { name: e.target.value })}
                        />
                      )}
                      {d.kind === 'otro' && (
                        <Input
                          className="h-9"
                          placeholder="Motivo *"
                          value={d.reason ?? ''}
                          onChange={(e) => updateDest(d.id, { reason: e.target.value })}
                        />
                      )}
                    </div>
                    <MoneyInput
                      className="h-9 w-32"
                      value={d.amount}
                      onValueChange={(n) => updateDest(d.id, { amount: n })}
                      disabled={dests.length === 1}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 text-destructive"
                      disabled={dests.length === 1}
                      onClick={() => setDests((cur) => cur.filter((x) => x.id !== d.id))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDests((cur) => [
                        ...cur,
                        {
                          id: (cur.at(-1)?.id ?? 0) + 1,
                          kind: 'proveedor',
                          amount: Math.max(0, destRemaining),
                        },
                      ])
                    }
                  >
                    <Plus className="h-3.5 w-3.5" /> Otro destino
                  </Button>
                  <span
                    className={cn(
                      'num text-xs font-semibold',
                      destRemaining === 0 ? 'text-success' : 'text-destructive',
                    )}
                  >
                    {destRemaining === 0
                      ? 'Reparto completo'
                      : destRemaining > 0
                        ? `Faltan ${formatCLP(destRemaining)}`
                        : `Sobran ${formatCLP(-destRemaining)}`}
                  </span>
                </div>
              </div>
            )}
          </Step>

          <Step n={4} title="Diferencia" done={touched && diffValid}>
            <div
              className={`rounded-md border p-3 ${diff === 0 ? 'border-success/40 bg-success/10' : 'border-warning/40 bg-warning/10'}`}
            >
              <div className="text-xs uppercase text-muted-foreground">Contado − esperado</div>
              <div className="num text-xl font-bold">{formatCLP(diff)}</div>
            </div>
            {diff !== 0 && (
              <div className="space-y-1">
                <Label>Explicación *</Label>
                <Input
                  value={differenceNote}
                  onChange={(e) => setDifferenceNote(e.target.value)}
                  placeholder="ej. boleta marcada efectivo que fue débito"
                />
              </div>
            )}
          </Step>

          <div className="space-y-1">
            <Label>Notas (opcional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {settings?.printer.enabled && (
            <div className="flex items-center justify-between rounded-md border border-border/40 bg-muted/30 px-3 py-2">
              <div>
                <Label className="text-sm text-foreground">Imprimir cierre Z</Label>
                <p className="text-[11px] text-muted-foreground">
                  Boletín con resumen de ventas, métodos de pago y cuadre
                </p>
              </div>
              <Switch checked={printZ} onCheckedChange={setPrintZ} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="warning"
            disabled={!canClose}
            onClick={async () => {
              if (!cash) return
              setSaving(true)
              const sessionId = cash.id
              try {
                await api.cashClose({
                  counted,
                  register_float: registerFloat,
                  destinations:
                    toWithdraw === 0
                      ? []
                      : dests.map((d) => ({
                          kind: d.kind,
                          amount: d.amount,
                          name: d.name,
                          reason: d.reason,
                        })),
                  difference_note: differenceNote || undefined,
                  notes: notes || undefined,
                  cashier_id: currentUser?.id ?? null,
                })
                onDone(diff, sessionId, printZ)
              } catch (err) {
                toast({
                  variant: 'destructive',
                  title: 'No se pudo cerrar',
                  description: err instanceof Error ? err.message : String(err),
                })
              } finally {
                setSaving(false)
              }
            }}
          >
            Cerrar caja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Step({
  n,
  title,
  done,
  children,
}: {
  n: number
  title: string
  done: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5 rounded-lg border border-border/60 p-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-caps">
        <span
          className={cn(
            'grid h-5 w-5 place-items-center rounded-full text-[10px]',
            done ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground',
          )}
        >
          {n}
        </span>
        <span className={done ? 'text-foreground' : 'text-muted-foreground'}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function MoveDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onDone: () => void
}) {
  const { toast } = useToast()
  const currentUser = useSession((s) => s.user)
  const [kind, setKind] = useState<'withdraw' | 'deposit' | 'adjustment'>('withdraw')
  const [amount, setAmount] = useState(0)
  const [note, setNote] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setKind('withdraw')
      setAmount(0)
      setNote('')
      setCounterparty('')
    }
  }, [open])

  const needsCounterparty = kind === 'withdraw'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Movimiento de caja</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="withdraw">Retiro</SelectItem>
                <SelectItem value="deposit">Depósito</SelectItem>
                <SelectItem value="adjustment">Ajuste (+/-)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Monto</Label>
            <MoneyInput value={amount} onValueChange={setAmount} autoFocus />
          </div>
          <div className="space-y-1">
            <Label>Motivo *</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={kind === 'withdraw' ? 'ej. pan, gas, flete' : 'ej. sencillo'}
            />
          </div>
          {needsCounterparty && (
            <div className="space-y-1">
              <Label>A quién *</Label>
              <Input
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="ej. Panadería, dueño, fletero"
              />
            </div>
          )}
          <Separator />
          <p className="text-xs text-muted-foreground">
            Retiros restan al esperado y necesitan motivo y destinatario. Depósitos suman.
            Ajustes pueden ser positivos o negativos.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={
              saving ||
              !Number.isFinite(amount) ||
              amount === 0 ||
              !note.trim() ||
              (needsCounterparty && !counterparty.trim()) ||
              ((kind === 'withdraw' || kind === 'deposit') && amount < 0)
            }
            onClick={async () => {
              // Normalizamos el signo por kind: el back usa el monto crudo
              // en SUM(deposit) - SUM(withdraw) + SUM(adjustment). Sólo
              // `adjustment` admite negativos por diseño.
              const safe = kind === 'adjustment' ? amount : Math.abs(amount)
              if (!Number.isFinite(safe) || safe === 0) return
              setSaving(true)
              try {
                await api.cashMove(kind, safe, note.trim(), currentUser?.id ?? null, {
                  counterparty: needsCounterparty ? counterparty.trim() : undefined,
                })
                onDone()
              } catch (err) {
                toast({
                  variant: 'destructive',
                  title: 'No se pudo registrar',
                  description: err instanceof Error ? err.message : String(err),
                })
              } finally {
                setSaving(false)
              }
            }}
          >
            <ArrowDownToLine className="h-4 w-4" /> Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const FUND_OUT_KINDS: CashFundMovementKind[] = [
  'out_supplier',
  'out_expense',
  'out_owner',
  'out_transfer_swap',
]

function FundOutDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onDone: () => void
}) {
  const { toast } = useToast()
  const currentUser = useSession((s) => s.user)
  const [kind, setKind] = useState<CashFundMovementKind>('out_expense')
  const [amount, setAmount] = useState(0)
  const [reason, setReason] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setKind('out_expense')
      setAmount(0)
      setReason('')
      setCounterparty('')
    }
  }, [open])

  const needsCounterparty = kind === 'out_supplier' || kind === 'out_transfer_swap'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" /> Salida del fondo
          </DialogTitle>
          <DialogDescription>
            Efectivo que sale del fondo (no del cajón). Los pagos a proveedores conviene
            registrarlos desde Compras para que queden ligados.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as CashFundMovementKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FUND_OUT_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {FUND_KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Monto</Label>
            <MoneyInput value={amount} onValueChange={setAmount} autoFocus />
          </div>
          <div className="space-y-1">
            <Label>Motivo *</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>A quién {needsCounterparty ? '*' : '(opcional)'}</Label>
            <Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={
              saving ||
              amount <= 0 ||
              !reason.trim() ||
              (needsCounterparty && !counterparty.trim())
            }
            onClick={async () => {
              setSaving(true)
              try {
                await api.fundAdd({
                  kind,
                  amount,
                  reason: reason.trim(),
                  counterparty: counterparty.trim() || null,
                  user_id: currentUser?.id ?? null,
                })
                onDone()
              } catch (err) {
                toast({
                  variant: 'destructive',
                  title: 'No se pudo registrar',
                  description: err instanceof Error ? err.message : String(err),
                })
              } finally {
                setSaving(false)
              }
            }}
          >
            Registrar salida
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FundSeedDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onDone: () => void
}) {
  const { toast } = useToast()
  const currentUser = useSession((s) => s.user)
  const [amount, setAmount] = useState(0)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (open) setAmount(0)
  }, [open])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Saldo inicial del fondo</DialogTitle>
          <DialogDescription>
            Cuánto efectivo real hay hoy fuera del cajón. Se registra como ajuste inicial y
            desde ahí el fondo se mueve solo con cierres, compras y salidas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label>Efectivo contado</Label>
          <MoneyInput value={amount} onValueChange={setAmount} autoFocus />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={saving || amount <= 0}
            onClick={async () => {
              setSaving(true)
              try {
                await api.fundAdd({
                  kind: 'adjustment',
                  amount,
                  reason: 'Saldo inicial del fondo (puesta en marcha)',
                  user_id: currentUser?.id ?? null,
                })
                onDone()
              } catch (err) {
                toast({
                  variant: 'destructive',
                  title: 'No se pudo registrar',
                  description: err instanceof Error ? err.message : String(err),
                })
              } finally {
                setSaving(false)
              }
            }}
          >
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FundCountDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onDone: (difference: number) => void
}) {
  const { toast } = useToast()
  const currentUser = useSession((s) => s.user)
  const [balance, setBalance] = useState(0)
  const [since, setSince] = useState<{ last_count_at: string | null; movements: CashFundMovement[] }>({
    last_count_at: null,
    movements: [],
  })
  const [counted, setCounted] = useState(0)
  const [touched, setTouched] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setCounted(0)
    setTouched(false)
    setNote('')
    Promise.all([api.fundBalance(), api.fundSinceLastCount()])
      .then(([b, s]) => {
        setBalance(b)
        setSince(s)
      })
      .catch(() => undefined)
  }, [open])

  const diff = counted - balance
  const sinceTotals = useMemo(
    () => since.movements.reduce((a, m) => a + m.amount, 0),
    [since.movements],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" /> Contar fondo
          </DialogTitle>
          <DialogDescription>
            Ingresa lo que hay físicamente. Si no coincide con el saldo calculado, se registra
            un ajuste por la diferencia.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Saldo calculado" value={balance} highlight />
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
                Desde el último conteo
              </div>
              <div className="mt-1.5 text-[12px] text-muted-foreground">
                {since.last_count_at ? fmtDate(since.last_count_at) : 'Nunca se contó'}
              </div>
              <div className={cn('num text-lg font-semibold', sinceTotals < 0 ? 'text-destructive' : 'text-success')}>
                {formatCLP(sinceTotals)}
              </div>
            </div>
          </div>
          {since.movements.length > 0 && (
            <ul className="max-h-40 divide-y divide-border/40 overflow-auto rounded-md border border-border/60 text-[12px]">
              {since.movements.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                  <span className="min-w-0 flex-1 truncate">
                    {FUND_KIND_LABEL[m.kind]}
                    {m.counterparty ? ` · ${m.counterparty}` : ''} · {m.reason}
                  </span>
                  <span className={cn('num font-semibold', m.amount < 0 ? 'text-destructive' : 'text-success')}>
                    {formatCLP(m.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-1">
            <Label>Efectivo contado</Label>
            <MoneyInput
              value={counted}
              onValueChange={(n) => {
                setCounted(n)
                setTouched(true)
              }}
              autoFocus
            />
          </div>
          {touched && (
            <div
              className={`rounded-md border p-3 ${diff === 0 ? 'border-success/40 bg-success/10' : 'border-warning/40 bg-warning/10'}`}
            >
              <div className="text-xs uppercase text-muted-foreground">Diferencia</div>
              <div className="num text-xl font-bold">{formatCLP(diff)}</div>
            </div>
          )}
          {touched && diff !== 0 && (
            <div className="space-y-1">
              <Label>Nota (opcional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={saving || !touched || counted < 0}
            onClick={async () => {
              setSaving(true)
              try {
                const r = await api.fundCount(counted, currentUser?.id ?? null, note || undefined)
                onDone(r.difference)
              } catch (err) {
                toast({
                  variant: 'destructive',
                  title: 'No se pudo registrar el conteo',
                  description: err instanceof Error ? err.message : String(err),
                })
              } finally {
                setSaving(false)
              }
            }}
          >
            Confirmar conteo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
