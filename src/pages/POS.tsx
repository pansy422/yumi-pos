import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus, Search, ShoppingCart, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/common/PageHeader'
import { MoneyInput } from '@/components/common/MoneyInput'
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
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const PAY_LABEL: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  credito: 'Crédito',
  transferencia: 'Transferencia',
  otro: 'Otro',
}

export function POS() {
  const { items, add, setQty, remove, clear, discount, setDiscount, subtotal, total } = useCart()
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
      toast({ variant: 'success', title: p.name, description: `+1 (${formatCLP(p.price)})` })
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

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Vender"
        description="Pasa el código por el lector. Ctrl+B busca, F5 cobra, ESC vacía."
        actions={
          <>
            <Button variant="outline" onClick={() => setSearchOpen(true)}>
              <Search className="h-4 w-4" /> Buscar (Ctrl+B)
            </Button>
            <Button
              variant="success"
              size="lg"
              disabled={items.length === 0}
              onClick={() => setPayOpen(true)}
            >
              <ShoppingCart className="h-4 w-4" /> Cobrar (F5) — {formatCLP(tot)}
            </Button>
          </>
        }
      />

      <div className="grid flex-1 grid-cols-3 gap-4 overflow-hidden p-6">
        <div className="col-span-2 flex flex-col overflow-hidden">
          <Card className="flex-1 overflow-hidden">
            <CardContent className="flex h-full flex-col p-0">
              {items.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
                  <ShoppingCart className="h-10 w-10 opacity-30" />
                  <p>Pasa un producto por el lector para empezar</p>
                </div>
              ) : (
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 text-left">Producto</th>
                        <th className="px-4 py-2 text-right">Precio</th>
                        <th className="px-4 py-2 text-center">Cantidad</th>
                        <th className="px-4 py-2 text-right">Total</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => (
                        <tr key={it.product_id} className="border-t">
                          <td className="px-4 py-2">
                            <div className="font-medium">{it.name}</div>
                            {it.barcode && (
                              <div className="text-xs text-muted-foreground">{it.barcode}</div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right num">{formatCLP(it.price)}</td>
                          <td className="px-4 py-2">
                            <div className="mx-auto flex w-32 items-center justify-center gap-1">
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
                          <td className="px-4 py-2 text-right font-medium num">
                            {formatCLP(it.price * it.qty)}
                          </td>
                          <td className="px-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => remove(it.product_id)}
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
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="num">{formatCLP(sub)}</span>
              </div>
              <div className="space-y-2">
                <Label>Descuento</Label>
                <MoneyInput value={discount} onValueChange={setDiscount} />
              </div>
              <div className="flex items-center justify-between border-t pt-3 text-2xl font-bold">
                <span>Total</span>
                <span className="num">{formatCLP(tot)}</span>
              </div>
              <Button
                variant="success"
                size="xl"
                className="w-full"
                disabled={items.length === 0}
                onClick={() => setPayOpen(true)}
              >
                Cobrar (F5)
              </Button>
              <Button
                variant="ghost"
                className="w-full text-destructive"
                disabled={items.length === 0}
                onClick={() => clear()}
              >
                <X className="h-4 w-4" /> Vaciar (ESC)
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1 p-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Caja</span>
                {cash ? (
                  <Badge variant="success">Abierta</Badge>
                ) : (
                  <Badge variant="warning">Cerrada</Badge>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Productos</span>
                <span className="num">{items.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Unidades</span>
                <span className="num">{items.reduce((a, i) => a + i.qty, 0)}</span>
              </div>
            </CardContent>
          </Card>
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
        <Input
          ref={searchInputRef}
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Escribe para buscar…"
        />
        <div className="max-h-80 overflow-auto">
          {results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sin resultados</p>
          ) : (
            <ul className="divide-y">
              {results.map((p) => (
                <li
                  key={p.id}
                  className="flex cursor-pointer items-center justify-between gap-4 px-2 py-2 hover:bg-accent"
                  onClick={() => onPick(p)}
                >
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
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
  const tot = total()

  useEffect(() => {
    if (!open) {
      setMethod('efectivo')
      setReceived(0)
      setLastSale(null)
    } else {
      setReceived(tot)
    }
  }, [open, tot])

  const change = method === 'efectivo' ? Math.max(0, received - tot) : 0
  const insufficient = method === 'efectivo' && received < tot
  const needsCashOpen = method === 'efectivo' && !cash

  const quickAmounts = useMemo(() => {
    const round = (n: number) => Math.ceil(n / 1000) * 1000
    return [round(tot), round(tot) + 1000, round(tot) + 5000, round(tot) + 10000]
      .filter((n, i, arr) => arr.indexOf(n) === i)
      .filter((n) => n >= tot)
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
      toast({
        variant: 'success',
        title: `Venta #${sale.number} registrada`,
        description:
          method === 'efectivo'
            ? `Vuelto ${formatCLP(sale.change_given ?? 0)}`
            : 'Pago registrado',
      })
      if (settings?.printer.enabled && settings.printer.auto_print) {
        const r = await api.printReceipt(sale.id)
        if (!r.ok) toast({ variant: 'destructive', title: 'Impresión falló', description: r.error })
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
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v) }}>
      <DialogContent
        className="max-w-md"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !lastSale) {
            e.preventDefault()
            submit()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{lastSale ? 'Venta completada' : 'Cobrar'}</DialogTitle>
          <DialogDescription>
            {lastSale ? `Boleta #${lastSale.number}` : 'Confirma con Enter'}
          </DialogDescription>
        </DialogHeader>

        {!lastSale ? (
          <>
            <div className="rounded-md bg-muted/40 p-4 text-center">
              <div className="text-xs uppercase text-muted-foreground">Total</div>
              <div className="num text-4xl font-bold">{formatCLP(tot)}</div>
            </div>

            <div className="space-y-2">
              <Label>Método de pago</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PAY_LABEL) as PaymentMethod[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {PAY_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {method === 'efectivo' && (
              <>
                <div className="space-y-2">
                  <Label>Recibido</Label>
                  <MoneyInput value={received} onValueChange={setReceived} autoFocus />
                  <div className="flex flex-wrap gap-1">
                    {quickAmounts.map((n) => (
                      <Button
                        key={n}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setReceived(n)}
                      >
                        {formatCLP(n)}
                      </Button>
                    ))}
                  </div>
                </div>
                <div
                  className={cn(
                    'flex items-center justify-between rounded-md border p-3',
                    insufficient ? 'border-destructive/40 bg-destructive/10' : 'bg-muted/30',
                  )}
                >
                  <span className="text-sm text-muted-foreground">Vuelto</span>
                  <span className="num text-2xl font-bold">{formatCLP(change)}</span>
                </div>
              </>
            )}

            {needsCashOpen && (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
                Debes abrir la caja antes de cobrar en efectivo. Ve a Caja (F3).
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button
                variant="success"
                size="lg"
                onClick={submit}
                disabled={submitting || insufficient || needsCashOpen}
              >
                {submitting ? 'Cobrando…' : 'Confirmar (Enter)'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="rounded-md bg-success/10 p-4 text-center text-success">
              <div className="text-xs uppercase">Total cobrado</div>
              <div className="num text-4xl font-bold">{formatCLP(lastSale.total)}</div>
              {lastSale.payment_method === 'efectivo' && (
                <div className="mt-2 text-sm">Vuelto: {formatCLP(lastSale.change_given ?? 0)}</div>
              )}
            </div>
            <DialogFooter>
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
                }}
              >
                Reimprimir
              </Button>
              <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
