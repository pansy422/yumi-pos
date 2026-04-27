import { useEffect, useState } from 'react'
import { ArchiveRestore, Link2, PackagePlus, Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyInput } from '@/components/common/MoneyInput'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/useToast'
import { api } from '@/lib/api'
import { formatCLP } from '@shared/money'
import type { Product, ProductInput } from '@shared/types'
import { cn } from '@/lib/utils'

type Form = {
  name: string
  category: string
  cost: number
  price: number
  stock: number
}

const empty: Form = { name: '', category: '', cost: 0, price: 0, stock: 1 }

export function UnknownBarcodeDialog({
  open,
  onOpenChange,
  barcode,
  archivedMatch,
  onResolved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  barcode: string | null
  archivedMatch?: Product | null
  onResolved: (p: Product, kind: 'created' | 'linked' | 'reactivated') => void
}) {
  const { toast } = useToast()
  const [tab, setTab] = useState<'new' | 'link'>('new')
  const [form, setForm] = useState<Form>(empty)
  const [saving, setSaving] = useState(false)

  // link tab state
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [picked, setPicked] = useState<Product | null>(null)

  useEffect(() => {
    if (open) {
      setTab('new')
      setForm(empty)
      setSearch('')
      setResults([])
      setPicked(null)
    }
  }, [open])

  const reactivate = async () => {
    if (!archivedMatch) return
    setSaving(true)
    try {
      const updated = await api.productsReactivate(archivedMatch.id, true)
      onResolved(updated, 'reactivated')
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'No se pudo reactivar',
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (tab !== 'link' || !open) return
    const t = setTimeout(async () => {
      const list = await api.productsList({ search })
      setResults(list)
    }, 120)
    return () => clearTimeout(t)
  }, [search, tab, open])

  if (!barcode) return null

  const submitNew = async () => {
    if (!form.name.trim()) {
      toast({ variant: 'warning', title: 'Falta el nombre' })
      return
    }
    setSaving(true)
    try {
      const input: ProductInput = {
        barcode,
        name: form.name.trim(),
        category: form.category.trim() || null,
        cost: form.cost,
        price: form.price,
        stock: Math.max(1, form.stock),
      }
      const p = await api.productsCreate(input)
      onResolved(p, 'created')
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'No se pudo crear',
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSaving(false)
    }
  }

  const submitLink = async () => {
    if (!picked) return
    setSaving(true)
    try {
      const updated = await api.productsUpdate(picked.id, {
        barcode,
        stock: picked.stock + 1,
      })
      onResolved(updated, 'linked')
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'No se pudo vincular',
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Código no reconocido</DialogTitle>
          <DialogDescription>
            <span className="mono rounded-md bg-muted px-2 py-0.5 text-foreground">{barcode}</span>{' '}
            no está activo en el inventario.
            {archivedMatch
              ? ' Pero hay un producto archivado con este mismo código.'
              : ' Crea un producto nuevo o vincúlalo a uno existente.'}
          </DialogDescription>
        </DialogHeader>

        {archivedMatch && (
          <div className="space-y-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
            <div className="flex items-start gap-2">
              <ArchiveRestore className="mt-0.5 h-5 w-5 text-warning shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-xs uppercase tracking-wider text-warning">
                  Producto archivado
                </div>
                <div className="font-semibold truncate">{archivedMatch.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  Stock al momento de archivarlo:{' '}
                  <span className="num">{archivedMatch.stock}</span> · precio{' '}
                  <span className="num">${archivedMatch.price.toLocaleString('es-CL')}</span>
                </div>
              </div>
            </div>
            <Button
              onClick={reactivate}
              disabled={saving}
              variant="warning"
              className="w-full"
            >
              <ArchiveRestore className="h-4 w-4" />
              {saving ? 'Reactivando…' : 'Reactivar y sumar 1 al stock'}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              O si prefieres tratar este código como un producto distinto, usa las pestañas
              de abajo. Tendrás que cambiar primero el código del producto archivado para
              liberarlo (los códigos de barras son únicos).
            </p>
          </div>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'new' | 'link')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">
              <PackagePlus className="h-4 w-4" /> Crear nuevo
            </TabsTrigger>
            <TabsTrigger value="link">
              <Link2 className="h-4 w-4" /> Vincular a existente
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>Nombre *</Label>
                <Input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Categoría</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Stock inicial</Label>
                <Input
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1">
                <Label>Costo</Label>
                <MoneyInput
                  value={form.cost}
                  onValueChange={(n) => setForm({ ...form, cost: n })}
                />
              </div>
              <div className="space-y-1">
                <Label>Precio venta *</Label>
                <MoneyInput
                  value={form.price}
                  onValueChange={(n) => setForm({ ...form, price: n })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border/50 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={submitNew} disabled={saving}>
                {saving ? 'Creando…' : 'Crear producto'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="link" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Busca el producto al que pertenece este código. Al vincular, también se le suma 1 al stock.
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                className="h-11 pl-9"
                placeholder="Buscar por nombre, código o SKU…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="max-h-72 overflow-auto rounded-md border border-border/60">
              {results.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {search ? 'Sin resultados' : 'Empieza a escribir para buscar'}
                </p>
              ) : (
                <ul className="divide-y divide-border/50">
                  {results.map((p) => {
                    const active = picked?.id === p.id
                    const hasBarcode = !!p.barcode
                    return (
                      <li
                        key={p.id}
                        onClick={() => setPicked(p)}
                        className={cn(
                          'flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-accent/50',
                          active && 'bg-primary/10',
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">{p.name}</span>
                            {hasBarcode && (
                              <Badge variant="warning" className="shrink-0">
                                Ya tiene código
                              </Badge>
                            )}
                          </div>
                          <div className="mono text-[11px] text-muted-foreground">
                            {p.barcode ?? 'sin código'} · stock {p.stock}
                          </div>
                        </div>
                        <div className="num shrink-0 font-semibold">{formatCLP(p.price)}</div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            {picked?.barcode && (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
                Este producto ya tiene código <span className="mono">{picked.barcode}</span>. Al
                vincular, se reemplazará por <span className="mono">{barcode}</span>.
              </div>
            )}
            <div className="flex justify-end gap-2 border-t border-border/50 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={submitLink} disabled={saving || !picked}>
                {saving
                  ? 'Vinculando…'
                  : picked
                    ? `Vincular a "${picked.name}"`
                    : 'Selecciona un producto'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
