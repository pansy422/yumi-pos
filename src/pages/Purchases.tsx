import { useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
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
import { MoneyInput } from '@/components/common/MoneyInput'
import { EmptyState, ChartEmptyArt } from '@/components/common/EmptyState'
import { useToast } from '@/hooks/useToast'
import { useIsAdmin } from '@/hooks/useRole'
import { useSession } from '@/stores/session'
import { api } from '@/lib/api'
import { PURCHASE_PAY_LABEL } from '@/lib/labels'
import { formatCLP, formatDateCL, todayISO } from '@shared/money'
import { cn } from '@/lib/utils'
import type { PurchaseMonth, PurchasePaymentMethod } from '@shared/types'

const METHODS: PurchasePaymentMethod[] = ['efectivo', 'transferencia', 'debito', 'credito']

function monthOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(m: string): string {
  const [y, mm] = m.split('-').map(Number)
  const d = new Date(y, mm - 1, 1)
  const s = d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function shiftMonth(m: string, delta: number): string {
  const [y, mm] = m.split('-').map(Number)
  return monthOf(new Date(y, mm - 1 + delta, 1))
}

export function Purchases() {
  const { toast } = useToast()
  const isAdmin = useIsAdmin()
  const currentUser = useSession((s) => s.user)
  const userCount = useSession((s) => s.userCount)
  const needsLogin = userCount > 0 && !currentUser

  const [month, setMonth] = useState(monthOf(new Date()))
  const [supplierFilter, setSupplierFilter] = useState('')
  const [methodFilter, setMethodFilter] = useState<'all' | PurchasePaymentMethod>('all')
  const [data, setData] = useState<PurchaseMonth | null>(null)
  const [suppliers, setSuppliers] = useState<string[]>([])

  // Formulario rápido
  const [date, setDate] = useState(todayISO())
  const [supplier, setSupplier] = useState('')
  const [amount, setAmount] = useState(0)
  const [method, setMethod] = useState<PurchasePaymentMethod | ''>('')
  const [note, setNote] = useState('')
  const [receipt, setReceipt] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const [m, s] = await Promise.all([
        api.purchasesMonth({
          month,
          supplier: supplierFilter || undefined,
          payment_method: methodFilter === 'all' ? undefined : methodFilter,
        }),
        api.purchasesSuppliers(),
      ])
      setData(m)
      setSuppliers(s)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'No se pudieron cargar las compras',
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, supplierFilter, methodFilter])

  const canSave =
    !saving && !needsLogin && supplier.trim().length > 0 && amount > 0 && method !== '' && !!date

  const submit = async () => {
    // `canSave` ya garantiza method !== '' (TS lo propaga por alias).
    if (!canSave) return
    setSaving(true)
    try {
      await api.purchasesCreate({
        purchased_at: date,
        supplier: supplier.trim(),
        amount,
        payment_method: method,
        note: note.trim() || null,
        receipt_path: receipt,
        user_id: currentUser?.id ?? null,
      })
      toast({
        variant: 'success',
        title: 'Compra registrada',
        description:
          method === 'efectivo'
            ? `${formatCLP(amount)} salieron del fondo de efectivo.`
            : `${formatCLP(amount)} a ${supplier.trim()}.`,
      })
      setAmount(0)
      setNote('')
      setReceipt(null)
      setMethod('')
      if (monthOf(new Date(date + 'T12:00:00')) !== month) setMonth(date.slice(0, 7))
      else await load()
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

  const items = data?.items ?? []
  const topSuppliers = useMemo(() => (data?.by_supplier ?? []).slice(0, 8), [data])

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Compras"
        description="Lo que se paga a proveedores. No mueve stock: el ingreso de mercadería sigue siendo el pistoleo."
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

      <div className="grid gap-4 p-6 lg:grid-cols-[380px_1fr]">
        <Card className="card-elev h-fit">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
              <Plus className="h-3.5 w-3.5" /> Registrar compra
            </div>
            {needsLogin && (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-2 text-[11px] text-warning">
                Iniciá sesión con tu PIN para registrar compras.
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Fecha</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Medio de pago *</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as PurchasePaymentMethod)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elegir…" />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {PURCHASE_PAY_LABEL[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Proveedor *</Label>
              <Input
                list="yumi-suppliers"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="ej. Coca-Cola, Soprole, feria"
              />
              <datalist id="yumi-suppliers">
                {suppliers.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1">
              <Label>Monto pagado *</Label>
              <MoneyInput value={amount} onValueChange={setAmount} className="text-lg" />
            </div>
            <div className="space-y-1">
              <Label>Nota (opcional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ej. 10 cajas bebida" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const r = await api.purchasesPickReceipt()
                  if (r) setReceipt(r.path)
                }}
              >
                <Camera className="h-3.5 w-3.5" /> {receipt ? 'Cambiar foto' : 'Foto de boleta'}
              </Button>
              {receipt && (
                <span className="truncate text-[11px] text-muted-foreground" title={receipt}>
                  {receipt.split(/[\\/]/).pop()}
                </span>
              )}
            </div>
            {method === 'efectivo' && (
              <p className="rounded-md border border-primary/25 bg-primary/8 p-2 text-[11px] text-primary">
                Se registra automáticamente como salida del fondo de efectivo.
              </p>
            )}
            <Button className="w-full" disabled={!canSave} onClick={submit}>
              <ShoppingBag className="h-4 w-4" /> {saving ? 'Guardando…' : 'Registrar compra'}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <SmallStat label={`Total ${monthLabel(month)}`} value={formatCLP(data?.total ?? 0)} accent />
            <SmallStat label="Compras" value={String(items.length)} />
            <SmallStat
              label="En efectivo"
              value={formatCLP(data?.by_method.find((m) => m.method === 'efectivo')?.total ?? 0)}
            />
          </div>

          {topSuppliers.length > 0 && (
            <Card className="card-elev">
              <CardContent className="p-0">
                <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3 text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
                  <Truck className="h-3.5 w-3.5" /> Total por proveedor
                </div>
                <ul className="divide-y divide-border/40">
                  {topSuppliers.map((s) => (
                    <li
                      key={s.supplier}
                      className={cn(
                        'flex cursor-pointer items-center justify-between px-4 py-2 text-sm hover:bg-accent/30',
                        supplierFilter.toLowerCase() === s.supplier.toLowerCase() && 'bg-primary/5',
                      )}
                      onClick={() =>
                        setSupplierFilter((cur) =>
                          cur.toLowerCase() === s.supplier.toLowerCase() ? '' : s.supplier,
                        )
                      }
                    >
                      <span>
                        {s.supplier}{' '}
                        <span className="text-[11px] text-muted-foreground">
                          · {s.count} {s.count === 1 ? 'compra' : 'compras'}
                        </span>
                      </span>
                      <span className="num font-semibold">{formatCLP(s.total)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="h-9 max-w-xs"
              placeholder="Filtrar por proveedor"
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
            />
            <Select
              value={methodFilter}
              onValueChange={(v) => setMethodFilter(v as typeof methodFilter)}
            >
              <SelectTrigger className="h-9 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los medios</SelectItem>
                {METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {PURCHASE_PAY_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="card-elev overflow-hidden">
            <CardContent className="p-0">
              {items.length === 0 ? (
                <EmptyState
                  illustration={<ChartEmptyArt />}
                  title="Sin compras este mes"
                  description="Registra cada pago a proveedores apenas se hace. Así el cuadre de los lunes sale solo."
                />
              ) : (
                <div className="max-h-[50vh] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-card/90 text-[10px] font-semibold uppercase tracking-caps text-muted-foreground backdrop-blur-md">
                      <tr>
                        <th className="px-4 py-3 text-left">Fecha</th>
                        <th className="px-4 py-3 text-left">Proveedor</th>
                        <th className="px-4 py-3 text-left">Medio</th>
                        <th className="px-4 py-3 text-left">Nota</th>
                        <th className="px-4 py-3 text-right">Monto</th>
                        <th className="w-24" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p) => (
                        <tr key={p.id} className="border-t border-border/40 hover:bg-accent/30">
                          <td className="px-4 py-2.5 text-[12px]">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {formatDateCL(p.purchased_at)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-medium">{p.supplier}</td>
                          <td className="px-4 py-2.5">
                            <Badge variant={p.payment_method === 'efectivo' ? 'warning' : 'secondary'}>
                              {PURCHASE_PAY_LABEL[p.payment_method]}
                            </Badge>
                          </td>
                          <td className="max-w-[220px] truncate px-4 py-2.5 text-[12px] text-muted-foreground">
                            {p.note ?? ''}
                            {p.user_name && (
                              <span className="ml-1 text-[10px]">· {p.user_name}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right num font-semibold">{formatCLP(p.amount)}</td>
                          <td className="px-2 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              {p.receipt_path && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  title="Ver foto de la boleta"
                                  onClick={async () => {
                                    const r = await api.purchasesOpenReceipt(p.receipt_path!)
                                    if (!r.ok)
                                      toast({ variant: 'destructive', title: 'No se pudo abrir', description: r.error })
                                  }}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                              {isAdmin && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  title="Eliminar compra"
                                  onClick={async () => {
                                    if (
                                      !confirm(
                                        `¿Eliminar la compra a ${p.supplier} por ${formatCLP(p.amount)}?${
                                          p.payment_method === 'efectivo'
                                            ? '\n\nTambién se revierte la salida del fondo de efectivo.'
                                            : ''
                                        }`,
                                      )
                                    )
                                      return
                                    try {
                                      await api.purchasesRemove(p.id)
                                      toast({ variant: 'success', title: 'Compra eliminada' })
                                      await load()
                                    } catch (err) {
                                      toast({
                                        variant: 'destructive',
                                        title: 'No se pudo eliminar',
                                        description: err instanceof Error ? err.message : String(err),
                                      })
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
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
        <div className={cn('num mt-1.5 text-2xl font-semibold leading-none tracking-display-tight', accent && 'brand-text')}>
          {value}
        </div>
      </CardContent>
    </Card>
  )
}
