import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  Box,
  DollarSign,
  DoorOpen,
  Minus,
  PauseCircle,
  Play,
  Plus,
  PlusSquare,
  Receipt as ReceiptIcon,
  Search,
  Settings as Cog,
  ShoppingCart,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { Wordmark } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MoneyInput } from '@/components/common/MoneyInput'
import { Numpad } from '@/components/common/Numpad'
import { AnimatedCheck } from '@/components/common/AnimatedCheck'
import { ReceiptPreview } from '@/components/common/ReceiptPreview'
import { EmptyState, CartEmptyArt } from '@/components/common/EmptyState'
import { Kbd } from '@/components/common/Kbd'
import { useCart } from '@/stores/cart'
import { useHeldTickets, type HeldTicket } from '@/stores/heldTickets'
import { QuickKeysPanel } from '@/components/common/QuickKeysPanel'
import { useSession } from '@/stores/session'
import { useScanner } from '@/hooks/useScanner'
import { useShortcut } from '@/lib/keyboard'
import { useToast } from '@/hooks/useToast'
import { api } from '@/lib/api'
import { formatCLP, todayISO } from '@shared/money'
import type { PaymentMethod, Product, SaleWithItems } from '@shared/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const PAY_METHODS: { id: PaymentMethod; label: string; hint?: string }[] = [
  { id: 'efectivo', label: 'Efectivo', hint: 'cajón' },
  { id: 'debito', label: 'Débito' },
  { id: 'credito', label: 'Crédito' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'otro', label: 'Otro' },
]

export function POS() {
  const {
    items,
    add,
    setQty,
    setSurcharge,
    remove,
    clear,
    discount,
    setDiscount,
    subtotal,
    total,
    lastAddedId,
    lastAddedAt,
    loadItems,
  } = useCart()
  const heldTickets = useHeldTickets((s) => s.tickets)
  const holdTicket = useHeldTickets((s) => s.hold)
  const removeHeld = useHeldTickets((s) => s.remove)
  const cash = useSession((s) => s.cash)
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const cartScrollRef = useRef<HTMLDivElement>(null)
  const lastRowRef = useRef<HTMLTableRowElement>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [multiplier, setMultiplier] = useState(1)
  const [heldOpen, setHeldOpen] = useState(false)
  const [holdNameOpen, setHoldNameOpen] = useState(false)
  const [holdName, setHoldName] = useState('')

  // Auto-scroll: cuando se agrega un producto, llevar la fila a la vista
  // para que la cajera siempre vea la última lectura aunque el ticket sea
  // largo.
  useEffect(() => {
    if (!lastAddedAt) return
    lastRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [lastAddedAt])

  const addWithMultiplier = useCallback(
    (p: Product) => {
      add(p, multiplier)
      if (multiplier !== 1) setMultiplier(1)
    },
    [add, multiplier],
  )

  const handleScan = useCallback(
    async (code: string) => {
      const p = await api.productsByBarcode(code)
      if (!p) {
        toast({
          variant: 'warning',
          title: 'Código no encontrado',
          description: `${code} no está en el inventario.`,
        })
        return
      }
      addWithMultiplier(p)
      const willAdd = multiplier
      const inCart = items.find((i) => i.product_id === p.id)?.qty ?? 0
      const after = inCart + willAdd
      if (p.stock <= 0) {
        toast({
          variant: 'warning',
          title: p.name,
          description: `Sin stock — vendiendo a deuda (stock quedará en ${p.stock - willAdd})`,
        })
      } else if (after > p.stock) {
        toast({
          variant: 'warning',
          title: p.name,
          description: `Vendiendo más que el stock (${after}/${p.stock})`,
        })
      } else {
        toast({
          variant: 'success',
          title: p.name,
          description: `+${willAdd} · ${formatCLP(p.price)}`,
        })
      }
    },
    [addWithMultiplier, multiplier, items, toast],
  )

  useScanner({ enabled: !payOpen && !searchOpen, onScan: handleScan })

  useShortcut({ key: 'b', ctrl: true }, () => {
    setSearchOpen(true)
    setTimeout(() => searchInputRef.current?.focus(), 30)
  })

  useShortcut(
    { key: 'F5' },
    () => {
      if (items.length === 0) {
        toast({ variant: 'warning', title: 'Carrito vacío' })
        return
      }
      setPayOpen(true)
    },
    { allowInInput: true },
  )

  useShortcut({ key: 'Escape' }, () => {
    if (payOpen || searchOpen) return
    if (items.length > 0) clear()
  })

  useEffect(() => {
    if (!searchOpen) return
    const t = setTimeout(async () => {
      const list = await api.productsList({ search })
      setResults(list)
    }, 120)
    return () => clearTimeout(t)
  }, [search, searchOpen])

  const sub = subtotal()
  const tot = total()
  const totalUnits = items.reduce((a, i) => a + i.qty, 0)

  return (
    <div className="flex h-full flex-col">
      {/* Barra superior tipo "caja registradora": branding + estado de caja
          + navegación admin. Reemplaza al sidebar oculto en /pos. */}
      <div className="flex items-center gap-4 border-b border-border/60 bg-card/40 px-6 py-2.5 backdrop-blur-sm">
        <Wordmark />
        <span className="h-6 w-px bg-border" />
        <div
          className={cn(
            'flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
            cash
              ? 'border-success/40 bg-success/10 text-success'
              : 'border-warning/40 bg-warning/10 text-warning',
          )}
        >
          <span className="relative flex h-2 w-2">
            <span
              className={cn(
                'absolute inline-flex h-full w-full animate-ping-soft rounded-full',
                cash ? 'bg-success' : 'bg-warning',
              )}
            />
            <span
              className={cn(
                'relative inline-flex h-2 w-2 rounded-full',
                cash ? 'bg-success' : 'bg-warning',
              )}
            />
          </span>
          Caja {cash ? 'abierta' : 'cerrada'}
        </div>
        <nav className="ml-auto flex items-center gap-1 text-xs">
          <NavBtn to="/inventario" icon={Box} label="Inventario" hint="F2" />
          <NavBtn to="/caja" icon={DollarSign} label="Caja" hint="F3" />
          <NavBtn to="/ventas" icon={ReceiptIcon} label="Ventas" hint="F6" />
          <NavBtn to="/reportes" icon={BarChart3} label="Reportes" hint="F4" />
          <NavBtn to="/ajustes" icon={Cog} label="Ajustes" hint="F9" />
        </nav>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 bg-card/20 px-6 py-3">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Vender</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pasa el código por el lector. El escáner está siempre activo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setSearchOpen(true)}>
            <Search className="h-4 w-4" /> Buscar
            <Kbd className="ml-1">Ctrl B</Kbd>
          </Button>
          <Button
            variant="outline"
            onClick={() => setHeldOpen(true)}
            className="relative"
          >
            <Play className="h-4 w-4" />
            En espera
            {heldTickets.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-warning text-[10px] font-bold text-warning-foreground">
                {heldTickets.length}
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            disabled={items.length === 0}
            onClick={() => {
              setHoldName(
                `Ticket ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`,
              )
              setHoldNameOpen(true)
            }}
          >
            <PauseCircle className="h-4 w-4" /> Reservar
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const r = await api.printerOpenDrawer()
              if (r.ok) toast({ variant: 'success', title: 'Cajón abierto' })
              else
                toast({
                  variant: 'destructive',
                  title: 'No se pudo abrir',
                  description: r.error,
                })
            }}
          >
            <DoorOpen className="h-4 w-4" /> Cajón
          </Button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-[1fr_360px] gap-4 overflow-hidden p-6">
        <div className="flex min-h-0 flex-col gap-4">
        <Card className="card-elev flex-1 overflow-hidden">
          <CardContent className="flex h-full flex-col p-0">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShoppingCart className="h-4 w-4 text-primary" />
                Ticket actual
                {items.length > 0 && (
                  <Badge variant="secondary" className="num">
                    {totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'}
                  </Badge>
                )}
                <MultiplierControl value={multiplier} onChange={setMultiplier} />
              </div>
              {items.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => clear()}
                >
                  <X className="h-3.5 w-3.5" /> Vaciar <Kbd className="ml-1">Esc</Kbd>
                </Button>
              )}
            </div>
            {items.length === 0 ? (
              <EmptyState
                illustration={<CartEmptyArt />}
                title="Pasa un producto por el lector"
                description="Cada lectura agrega al ticket automáticamente. También puedes buscar manualmente con Ctrl+B."
              />
            ) : (
              <div ref={cartScrollRef} className="flex-1 overflow-auto scrollfade-y">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Producto</th>
                      <th className="px-4 py-2 text-right font-medium">Precio</th>
                      <th className="px-4 py-2 text-center font-medium">Cantidad</th>
                      <th className="px-4 py-2 text-right font-medium">Total</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => {
                      const isLast = lastAddedId === it.product_id
                      const overstock = it.qty > it.stock
                      return (
                      <tr
                        key={it.product_id}
                        ref={isLast ? lastRowRef : undefined}
                        className={cn(
                          'border-t border-border/40 transition-colors',
                          isLast && 'flash-row outline outline-2 outline-success/60',
                        )}
                        data-flash={lastAddedAt}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{it.name}</span>
                            {isLast && (
                              <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-success">
                                + Recién
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                            {it.barcode && <span className="mono">{it.barcode}</span>}
                            <span
                              className={cn(
                                'mono',
                                overstock && 'text-warning font-semibold',
                                it.stock <= 0 && 'text-destructive font-semibold',
                              )}
                            >
                              stock: {it.stock}
                              {overstock ? ` · pediste ${it.qty}` : ''}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="num">{formatCLP(it.price + it.surcharge)}</div>
                          {it.surcharge !== 0 && (
                            <div
                              className={cn(
                                'mono text-[10px]',
                                it.surcharge > 0 ? 'text-warning' : 'text-success',
                              )}
                            >
                              {it.surcharge > 0 ? '+' : ''}
                              {formatCLP(it.surcharge)} recargo
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="mx-auto flex w-32 items-center justify-center gap-1.5">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => setQty(it.product_id, it.qty - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              value={it.qty}
                              onChange={(e) =>
                                setQty(it.product_id, Number(e.target.value) || 0)
                              }
                              className="h-8 w-12 text-center num"
                            />
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => setQty(it.product_id, it.qty + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right num font-semibold">
                          {formatCLP((it.price + it.surcharge) * it.qty)}
                        </td>
                        <td className="px-2">
                          <div className="flex items-center gap-0.5">
                            <SurchargeButton
                              value={it.surcharge}
                              onChange={(n) => setSurcharge(it.product_id, n)}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => remove(it.product_id)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        <QuickKeysPanel onPick={addWithMultiplier} />
        </div>

        <div className="flex flex-col gap-4">
          <Card className="card-elev relative overflow-hidden">
            <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-brand-1/15 blur-3xl" />
            <div className="pointer-events-none absolute -left-12 -bottom-16 h-44 w-44 rounded-full bg-brand-2/15 blur-3xl" />
            <CardContent className="relative space-y-4 p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="num">{formatCLP(sub)}</span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Descuento</Label>
                <MoneyInput value={discount} onValueChange={setDiscount} />
              </div>
              <div className="border-t border-border/60 pt-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Total a cobrar
                </div>
                <div className="num text-[64px] font-bold leading-none tracking-tight brand-text">
                  {formatCLP(tot)}
                </div>
              </div>
              <Button
                variant="success"
                className="h-20 w-full text-xl font-bold shadow-glow"
                disabled={items.length === 0}
                onClick={() => setPayOpen(true)}
              >
                <Zap className="h-6 w-6" />
                Cobrar
                <Kbd className="ml-1 border-success-foreground/20 bg-success-foreground/10 text-success-foreground">
                  F5
                </Kbd>
              </Button>
            </CardContent>
          </Card>

          <TodayCard />
          {!cash && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
              <div className="font-medium">Caja cerrada</div>
              <p className="mt-0.5 text-[11px] opacity-90">
                Abre la caja en F3 para poder cobrar en efectivo.
              </p>
            </div>
          )}

          <div className="rounded-lg border border-border/60 bg-card/30 p-3 text-[11px] text-muted-foreground">
            <div className="mb-1.5 flex items-center gap-1.5 text-foreground/80">
              <Sparkles className="h-3 w-3 text-primary" />
              Atajos
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span>Cobrar</span>
                <Kbd>F5</Kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Buscar</span>
                <span className="flex gap-1">
                  <Kbd>Ctrl</Kbd>
                  <Kbd>B</Kbd>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Vaciar</span>
                <Kbd>Esc</Kbd>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        search={search}
        setSearch={setSearch}
        results={results}
        onPick={(p) => {
          addWithMultiplier(p)
          setSearchOpen(false)
          setSearch('')
        }}
        searchInputRef={searchInputRef}
      />

      <HoldNameDialog
        open={holdNameOpen}
        onOpenChange={setHoldNameOpen}
        defaultName={holdName}
        onConfirm={(name) => {
          holdTicket(name, items, discount)
          clear()
          setHoldNameOpen(false)
          toast({ variant: 'success', title: 'Ticket en espera', description: name })
        }}
      />

      <HeldTicketsDialog
        open={heldOpen}
        onOpenChange={setHeldOpen}
        tickets={heldTickets}
        onRecall={(t) => {
          if (items.length > 0) {
            const ok = window.confirm(
              'Tienes productos en el ticket actual. ¿Reemplazarlos por el ticket en espera?',
            )
            if (!ok) return
          }
          loadItems(t.items, t.discount)
          removeHeld(t.id)
          setHeldOpen(false)
          toast({ variant: 'success', title: 'Ticket recuperado', description: t.name })
        }}
        onDiscard={(t) => {
          if (window.confirm(`¿Descartar el ticket "${t.name}"?`)) removeHeld(t.id)
        }}
      />

      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} />
    </div>
  )
}

function NavBtn({
  to,
  icon: Icon,
  label,
  hint,
}: {
  to: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  hint: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
      <Kbd>{hint}</Kbd>
    </Link>
  )
}

function TodayCard() {
  const [data, setData] = useState<{ count: number; revenue: number; profit: number } | null>(null)
  const cashId = useSession((s) => s.cash?.id)

  useEffect(() => {
    let cancelled = false
    api.reportDaily(todayISO()).then((r) => {
      if (cancelled) return
      setData({ count: r.sales_count, revenue: r.revenue, profit: r.profit })
    })
    return () => {
      cancelled = true
    }
  }, [cashId])

  return (
    <Card className="card-elev card-glow">
      <CardContent className="p-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Hoy</div>
        <div className="num mt-1 text-2xl font-bold tracking-tight brand-text">
          {data ? formatCLP(data.revenue) : '—'}
        </div>
        <div className="mt-0.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            <span className="num">{data?.count ?? 0}</span>{' '}
            {(data?.count ?? 0) === 1 ? 'venta' : 'ventas'}
          </span>
          <span>
            Ganancia <span className="num text-success">{data ? formatCLP(data.profit) : '—'}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function SurchargeButton({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(value !== 0 ? String(value) : '')
  useEffect(() => {
    setText(value !== 0 ? String(value) : '')
  }, [value])
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        onClick={() => setOpen(true)}
        title="Recargo o descuento por unidad"
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
          value !== 0 && (value > 0 ? 'text-warning' : 'text-success'),
        )}
      >
        <PlusSquare className="h-4 w-4" />
      </button>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Recargo / descuento por unidad</DialogTitle>
          <DialogDescription>
            Cantidad fija sumada al precio de cada unidad. Usa negativo para descontar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label>Monto por unidad</Label>
          <Input
            autoFocus
            type="number"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="ej. 500 para sumar $500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onChange(Number(text) || 0)
                setOpen(false)
              }
            }}
          />
          <p className="text-[11px] text-muted-foreground">
            Lo verás reflejado en la línea del producto y en el total.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() => {
              onChange(0)
              setOpen(false)
            }}
          >
            Quitar recargo
          </Button>
          <Button
            onClick={() => {
              onChange(Number(text) || 0)
              setOpen(false)
            }}
          >
            Aplicar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MultiplierControl({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(String(value))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setText(String(value))
  }, [value])

  if (!editing) {
    return (
      <button
        onClick={() => {
          setEditing(true)
          setTimeout(() => inputRef.current?.select(), 30)
        }}
        className={cn(
          'flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
          value === 1
            ? 'border-border/60 text-muted-foreground hover:bg-accent'
            : 'border-warning/40 bg-warning/15 text-warning',
        )}
        title="Multiplicador para próxima lectura"
      >
        × <span className="num">{value}</span>
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">×</span>
      <Input
        ref={inputRef}
        value={text}
        type="number"
        min={1}
        max={99}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = Math.max(1, Math.min(99, Number(text) || 1))
          onChange(n)
          setEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Escape') {
            const n = Math.max(1, Math.min(99, Number(text) || 1))
            onChange(n)
            setEditing(false)
          }
        }}
        className="h-7 w-14 text-center num"
      />
    </div>
  )
}

function HoldNameDialog({
  open,
  onOpenChange,
  defaultName,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  defaultName: string
  onConfirm: (name: string) => void
}) {
  const [name, setName] = useState(defaultName)
  useEffect(() => {
    if (open) setName(defaultName)
  }, [open, defaultName])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reservar ticket</DialogTitle>
          <DialogDescription>
            Guarda el carrito actual para retomarlo después. El ticket queda en este equipo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label>Nombre o referencia</Label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ej. señor del pan"
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirm(name)
            }}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(name)}>
            <PauseCircle className="h-4 w-4" /> Reservar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function HeldTicketsDialog({
  open,
  onOpenChange,
  tickets,
  onRecall,
  onDiscard,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  tickets: HeldTicket[]
  onRecall: (t: HeldTicket) => void
  onDiscard: (t: HeldTicket) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tickets en espera</DialogTitle>
          <DialogDescription>
            {tickets.length === 0
              ? 'No tienes tickets reservados.'
              : `${tickets.length} ticket${tickets.length === 1 ? '' : 's'} guardado${tickets.length === 1 ? '' : 's'}`}
          </DialogDescription>
        </DialogHeader>
        {tickets.length > 0 && (
          <ul className="max-h-80 divide-y divide-border/40 overflow-auto rounded-md border border-border/40">
            {tickets.map((t) => {
              const itemsTotal = t.items.reduce((a, i) => a + i.price * i.qty, 0)
              const total = Math.max(0, itemsTotal - t.discount)
              const units = t.items.reduce((a, i) => a + i.qty, 0)
              return (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{t.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {units} unidad{units === 1 ? '' : 'es'} ·{' '}
                      <span className="num">{formatCLP(total)}</span>
                      {' · '}
                      {new Date(t.created_at).toLocaleTimeString('es-CL', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => onDiscard(t)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                  <Button size="sm" onClick={() => onRecall(t)}>
                    <Play className="h-4 w-4" /> Recuperar
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SearchDialog({
  open,
  onOpenChange,
  search,
  setSearch,
  results,
  onPick,
  searchInputRef,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  search: string
  setSearch: (s: string) => void
  results: Product[]
  onPick: (p: Product) => void
  searchInputRef: React.RefObject<HTMLInputElement>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Buscar producto</DialogTitle>
          <DialogDescription>Por nombre, código o SKU</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Escribe para buscar…"
            className="pl-9 h-11"
          />
        </div>
        <div className="max-h-80 overflow-auto">
          {results.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {search ? 'Sin resultados' : 'Empieza a escribir'}
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {results.map((p) => (
                <li
                  key={p.id}
                  className="flex cursor-pointer items-center justify-between gap-4 rounded-md px-2 py-2.5 transition-colors hover:bg-accent/60"
                  onClick={() => onPick(p)}
                >
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="mono text-xs text-muted-foreground">
                      {p.barcode ?? 'sin código'} · stock {p.stock}
                    </div>
                  </div>
                  <div className="num font-semibold">{formatCLP(p.price)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PaymentDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { items, discount, total, clear } = useCart()
  const cash = useSession((s) => s.cash)
  const settings = useSession((s) => s.settings)
  const { toast } = useToast()

  const [method, setMethod] = useState<PaymentMethod>('efectivo')
  const [received, setReceived] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [lastSale, setLastSale] = useState<SaleWithItems | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const tot = total()

  useEffect(() => {
    if (!open) {
      setMethod('efectivo')
      setReceived(0)
      setLastSale(null)
      setShowPreview(false)
    } else {
      setReceived(tot)
    }
  }, [open, tot])

  const change = method === 'efectivo' ? Math.max(0, received - tot) : 0
  const insufficient = method === 'efectivo' && received < tot
  const needsCashOpen = method === 'efectivo' && !cash

  const quickAmounts = useMemo(() => {
    const round = (n: number) => Math.ceil(n / 1000) * 1000
    return Array.from(
      new Set([round(tot), round(tot) + 1000, round(tot) + 5000, round(tot) + 10000, round(tot) + 20000]),
    )
      .filter((n) => n >= tot)
      .slice(0, 5)
  }, [tot])

  const submit = async () => {
    if (submitting || insufficient || needsCashOpen) return
    setSubmitting(true)
    try {
      const sale = await api.salesCreate({
        items: items.map((i) => ({
          product_id: i.product_id,
          qty: i.qty,
          price: i.price,
          surcharge: i.surcharge,
        })),
        discount,
        payment_method: method,
        cash_received: method === 'efectivo' ? received : undefined,
      })
      setLastSale(sale)
      clear()
      if (settings?.printer.enabled && settings.printer.auto_print) {
        const r = await api.printReceipt(sale.id)
        if (!r.ok)
          toast({ variant: 'destructive', title: 'Impresión falló', description: r.error })
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'No se pudo cobrar',
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) onOpenChange(v)
      }}
    >
      <DialogContent
        className={cn('overflow-hidden p-0', lastSale ? 'max-w-md' : 'max-w-3xl')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !lastSale) {
            e.preventDefault()
            submit()
          }
        }}
      >
        {!lastSale ? (
          <>
            <div className="relative border-b border-border/60 bg-gradient-to-br from-brand-1/15 via-card to-brand-2/10 px-6 py-5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Total a cobrar
              </div>
              <div className="num text-5xl font-bold leading-none tracking-tight brand-text">
                {formatCLP(tot)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {items.length} producto{items.length === 1 ? '' : 's'} ·{' '}
                {items.reduce((a, i) => a + i.qty, 0)} unidad
                {items.reduce((a, i) => a + i.qty, 0) === 1 ? '' : 'es'}
                {discount > 0 && ` · ${formatCLP(discount)} de descuento`}
              </div>
            </div>

            <div className="grid gap-6 px-6 py-5 sm:grid-cols-[1fr_220px]">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Método de pago</Label>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {PAY_METHODS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setMethod(m.id)}
                        className={cn(
                          'flex flex-col items-center justify-center rounded-lg border px-2 py-2.5 text-xs font-medium transition-all',
                          method === m.id
                            ? 'border-primary bg-primary/10 text-primary shadow-glow'
                            : 'border-border bg-card text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                        )}
                      >
                        {m.label}
                        {m.hint && (
                          <span className="text-[9px] uppercase tracking-wider opacity-70">
                            {m.hint}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {method === 'efectivo' && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Recibido</Label>
                      <MoneyInput value={received} onValueChange={setReceived} autoFocus className="h-12 text-2xl" />
                      <div className="flex flex-wrap gap-1.5">
                        {quickAmounts.map((n) => (
                          <Button
                            key={n}
                            type="button"
                            size="sm"
                            variant={received === n ? 'secondary' : 'outline'}
                            onClick={() => setReceived(n)}
                            className="num text-xs"
                          >
                            {formatCLP(n)}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div
                      className={cn(
                        'rounded-lg border p-4 transition-colors',
                        insufficient
                          ? 'border-destructive/40 bg-destructive/10'
                          : 'border-success/30 bg-success/5',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">
                          Vuelto
                        </span>
                        <span
                          className={cn(
                            'num text-3xl font-bold',
                            insufficient ? 'text-destructive' : 'text-success',
                          )}
                        >
                          {insufficient ? '—' : formatCLP(change)}
                        </span>
                      </div>
                      {insufficient && (
                        <div className="mt-1 text-xs text-destructive">
                          Faltan {formatCLP(tot - received)}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {needsCashOpen && (
                  <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
                    Debes abrir la caja antes de cobrar en efectivo. Ve a Caja{' '}
                    <Kbd className="border-warning/40 text-warning">F3</Kbd>.
                  </div>
                )}
              </div>

              {method === 'efectivo' && (
                <div>
                  <Label className="mb-1.5 block text-xs">Numpad</Label>
                  <Numpad value={received} onChange={setReceived} />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border/60 bg-card/40 px-6 py-4">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button
                variant="success"
                size="lg"
                onClick={submit}
                disabled={submitting || insufficient || needsCashOpen}
                className="shadow-glow"
              >
                {submitting ? (
                  'Cobrando…'
                ) : (
                  <>
                    Confirmar <Kbd className="ml-1 border-success-foreground/20 bg-success-foreground/10 text-success-foreground">Enter</Kbd>
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center gap-3 px-8 py-8">
              <AnimatedCheck size={88} />
              <div className="text-center">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Boleta #{lastSale.number}
                </div>
                <div className="num text-3xl font-bold tracking-tight">{formatCLP(lastSale.total)}</div>
                {lastSale.payment_method === 'efectivo' && (
                  <div className="mt-1 text-sm text-muted-foreground">
                    Vuelto · <span className="num text-success font-semibold">{formatCLP(lastSale.change_given ?? 0)}</span>
                  </div>
                )}
              </div>
              <div className="flex w-full flex-wrap justify-center gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowPreview((v) => !v)}
                >
                  {showPreview ? 'Ocultar boleta' : 'Ver boleta'}
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    const r = await api.printReceipt(lastSale.id)
                    if (!r.ok)
                      toast({
                        variant: 'destructive',
                        title: 'Impresión falló',
                        description: r.error,
                      })
                    else toast({ variant: 'success', title: 'Reimprimiendo' })
                  }}
                >
                  Reimprimir
                </Button>
                <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
              </div>
            </div>
            {showPreview && settings && (
              <div className="border-t border-border/60 bg-muted/30 p-4">
                <ReceiptPreview
                  sale={lastSale}
                  store={settings.store}
                  template={settings.receipt_template}
                  width={settings.printer.width_chars}
                />
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
