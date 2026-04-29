import { useEffect, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, DoorOpen, Lock } from 'lucide-react'
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
import { useSession } from '@/stores/session'
import { api } from '@/lib/api'
import { formatCLP } from '@shared/money'
import type { CashMovement } from '@shared/types'

const KIND_LABEL: Record<CashMovement['kind'], string> = {
  sale: 'Venta',
  deposit: 'Depósito',
  withdraw: 'Retiro',
  adjustment: 'Ajuste',
}

export function Cash() {
  const { toast } = useToast()
  const cash = useSession((s) => s.cash)
  const refresh = useSession((s) => s.refresh)

  const [openDlg, setOpenDlg] = useState(false)
  const [closeDlg, setCloseDlg] = useState(false)
  const [moveDlg, setMoveDlg] = useState(false)
  const [movements, setMovements] = useState<CashMovement[]>([])
  const [summary, setSummary] = useState<{
    expected: number
    cashSales: number
    movsIn: number
    movsOut: number
    salesCount: number
  } | null>(null)

  const reload = async () => {
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
  }, [cash])

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Caja"
        description={cash ? 'Sesión abierta' : 'No hay caja abierta'}
        actions={
          cash ? (
            <>
              <Button variant="outline" onClick={() => setMoveDlg(true)}>
                <ArrowUpFromLine className="h-4 w-4" /> Retiro / Depósito
              </Button>
              <Button variant="warning" onClick={() => setCloseDlg(true)}>
                <Lock className="h-4 w-4" /> Cerrar caja
              </Button>
            </>
          ) : (
            <Button variant="success" onClick={() => setOpenDlg(true)}>
              <DoorOpen className="h-4 w-4" /> Abrir caja
            </Button>
          )
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
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Apertura</span>
                  <span>{new Date(cash.opened_at).toLocaleString('es-CL')}</span>
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
                        <div className="font-medium tracking-tight">{KIND_LABEL[m.kind]}</div>
                        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {m.note ? `${m.note} · ` : ''}
                          {new Date(m.created_at).toLocaleString('es-CL')}
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
    </div>
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
            ? 'text-[26px] tracking-display-tight iridescent-text'
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
  const [amount, setAmount] = useState(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setAmount(0)
      setNotes('')
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
            disabled={saving}
            onClick={async () => {
              setSaving(true)
              try {
                await api.cashOpen(amount, notes || undefined)
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
  const [counted, setCounted] = useState(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [printZ, setPrintZ] = useState(true)

  useEffect(() => {
    if (open) {
      setCounted(expected)
      setNotes('')
      setPrintZ(!!settings?.printer.enabled)
    }
  }, [open, expected, settings])

  const diff = counted - expected

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cerrar caja</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Stat label="Esperado" value={expected} highlight />
          <div className="space-y-1">
            <Label>Contado en caja</Label>
            <MoneyInput value={counted} onValueChange={setCounted} autoFocus />
          </div>
          <div
            className={`rounded-md border p-3 ${diff === 0 ? 'border-success/40 bg-success/10' : 'border-warning/40 bg-warning/10'}`}
          >
            <div className="text-xs uppercase text-muted-foreground">Diferencia</div>
            <div className="num text-xl font-bold">{formatCLP(diff)}</div>
          </div>
          <div className="space-y-1">
            <Label>Notas</Label>
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
            disabled={saving}
            onClick={async () => {
              setSaving(true)
              const sessionId = cash?.id ?? null
              try {
                await api.cashClose(counted, notes || undefined)
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
  const [kind, setKind] = useState<'withdraw' | 'deposit' | 'adjustment'>('withdraw')
  const [amount, setAmount] = useState(0)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setKind('withdraw')
      setAmount(0)
      setNote('')
    }
  }, [open])

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
            <Label>Motivo</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Separator />
          <p className="text-xs text-muted-foreground">
            Retiros restan al esperado. Depósitos suman. Ajustes pueden ser positivos o negativos.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={saving || amount === 0 || !note.trim()}
            onClick={async () => {
              setSaving(true)
              try {
                await api.cashMove(kind, amount, note.trim())
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
