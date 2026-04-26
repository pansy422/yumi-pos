import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus, Search, ShoppingCart, Sparkles, Trash2, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/common/PageHeader'
import { MoneyInput } from '@/components/common/MoneyInput'
import { Numpad } from '@/components/common/Numpad'
import { AnimatedCheck } from '@/components/common/AnimatedCheck'
import { ReceiptPreview } from '@/components/common/ReceiptPreview'
import { EmptyState, CartEmptyArt } from '@/components/common/EmptyState'
import { Kbd } from '@/components/common/Kbd'
import { useCart } from '@/stores/cart'
import { useSession } from '@/stores/session'
import { useScanner } from '@/hooks/useScanner'
import { useShortcut } from '@/lib/keyboard'
import { useToast } from '@/hooks/useToast'
import { api } from '@/lib/api'
import { formatCLP } from '@shared/money'
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
  const { items, add, setQty, remove, clear, discount, setDiscount, subtotal, total, lastAddedId, lastAddedAt } =
    useCart()
  const cash = useSession((s) => s.cash)
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [payOpen, setPayOpen] = useState(false)

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
      add(p)
      toast({ variant: 'success', title: p.name, description: `+1 · ${formatCLP(p.price)}` })
    },
    [add, toast],
  )

  useScanner({ enabled: !payOpen && !searchOpen, onScan: handleScan })

  useShortcut({ key: 'b', ctrl: true }, () => {
    setSearchOpen(true)
    setTimeout(() => searchInputRef.current?.focus(), 30)
  })

  useShortcut({ key: 'F5' }, () => {
    if (items.length === 0) {
      toast({ variant: 'warning', title: 'Carrito vacío' })
      return
    }
    setPayOpen(true)
  })

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
      <PageHeader
        title="Vender"
        description="Pasa el código por el lector. El escáner está siempre activo."
        actions={
          <>
            <Button variant="outline" onClick={() => setSearchOpen(true)}>
              <Search className="h-4 w-4" /> Buscar
              <Kbd className="ml-1">Ctrl B</Kbd>
            </Button>
          </>
        }
      />

      <div className="grid flex-1 grid-cols-[1fr_360px] gap-4 overflow-hidden p-6">
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
              <div className="flex-1 overflow-auto scrollfade-y">
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
                    {items.map((it) => (
                      <tr
                        key={it.product_id}
                        className={cn(
                          'border-t border-border/40 transition-colors',
                          lastAddedId === it.product_id && 'flash-row',
                        )}
                        data-flash={lastAddedAt}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">{it.name}</div>
                          {it.barcode && (
                            <div className="mono text-[11px] text-muted-foreground">
                              {it.barcode}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right num">{formatCLP(it.price)}</td>
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
                          {formatCLP(it.price * it.qty)}
                        </td>
                        <td className="px-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => remove(it.product_id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
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
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Total a cobrar
                </div>
                <div className="num text-4xl font-bold tracking-tight brand-text">
                  {formatCLP(tot)}
                </div>
              </div>
              <Button
                variant="success"
                size="xl"
                className="w-full text-base shadow-glow"
                disabled={items.length === 0}
                onClick={() => setPayOpen(true)}
              >
                <Zap className="h-5 w-5" />
                Cobrar
                <Kbd className="ml-1 border-success-foreground/20 bg-success-foreground/10 text-success-foreground">
                  F5
                </Kbd>
              </Button>
            </CardContent>
          </Card>

          <Card className="card-elev">
            <CardContent className="space-y-2 p-4 text-xs">
              <Row label="Caja">
                {cash ? (
                  <Badge variant="success" className="px-2">
                    Abierta
                  </Badge>
                ) : (
                  <Badge variant="warning" className="px-2">
                    Cerrada
                  </Badge>
                )}
              </Row>
              <Row label="Productos en ticket">
                <span className="num">{items.length}</span>
              </Row>
              <Row label="Unidades">
                <span className="num">{totalUnits}</span>
              </Row>
            </CardContent>
          </Card>

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
          add(p)
          setSearchOpen(false)
          setSearch('')
        }}
        searchInputRef={searchInputRef}
      />

      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} />
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
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
        items: items.map((i) => ({ product_id: i.product_id, qty: i.qty, price: i.price })),
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
                <ReceiptPreview sale={lastSale} store={settings.store} width={settings.printer.width_chars} />
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
