import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownAZ, Edit3, Pencil, Plus, Search, ScanBarcode, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SkeletonRow } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, BoxEmptyArt } from '@/components/common/EmptyState'
import { useToast } from '@/hooks/useToast'
import { ProductDialog } from './ProductDialog'
import { api } from '@/lib/api'
import type { CategoryStat, Product } from '@shared/types'
import { formatCLP } from '@shared/money'
import { cn } from '@/lib/utils'

export function Inventory() {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<Product[]>([])
  const [editing, setEditing] = useState<Product | null>(null)
  const [creating, setCreating] = useState(false)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [firstLoad, setFirstLoad] = useState(true)
  const [categories, setCategories] = useState<CategoryStat[]>([])
  const [category, setCategory] = useState<'__all__' | '__none__' | string>('__all__')
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameFrom, setRenameFrom] = useState('')
  const [renameTo, setRenameTo] = useState('')

  const load = async () => {
    setLoading(true)
    const filterCategory =
      category === '__all__' ? undefined : category === '__none__' ? null : category
    const list = await api.productsList({ search, includeArchived, category: filterCategory })
    setItems(list)
    setLoading(false)
    setFirstLoad(false)
  }

  const loadCategories = async () => {
    setCategories(await api.categoriesList())
  }

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 120)
    return () => clearTimeout(t)
  }, [search, includeArchived, category])

  const totalStockValue = items.reduce((a, i) => a + i.stock * i.cost, 0)
  const lowStock = items.filter((i) => i.stock > 0 && i.stock < 5).length
  const outOfStock = items.filter((i) => i.stock <= 0 && !i.archived).length

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Inventario"
        description={`${items.length} ${items.length === 1 ? 'producto' : 'productos'}${lowStock ? ` · ${lowStock} con stock bajo` : ''}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/inventario/pistolear">
                <ScanBarcode className="h-4 w-4" /> Pistolear
              </Link>
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Nuevo producto
            </Button>
          </>
        }
      />
      <div className="flex flex-col gap-4 p-6">
        {!firstLoad && items.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <SmallStat label="Productos activos" value={String(items.filter((i) => !i.archived).length)} />
            <SmallStat
              label="Valor inventario (costo)"
              value={formatCLP(totalStockValue)}
              accent="primary"
            />
            <SmallStat
              label="Sin stock"
              value={String(outOfStock)}
              accent={outOfStock > 0 ? 'warning' : undefined}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[280px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="h-11 pl-9"
              placeholder="Buscar por nombre, código o SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1">
            <Select value={category} onValueChange={(v) => setCategory(v)}>
              <SelectTrigger className="w-56">
                <Tag className="h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas las categorías</SelectItem>
                <SelectItem value="__none__">Sin categoría</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.name} value={c.name}>
                    {c.name} ({c.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {category !== '__all__' && category !== '__none__' && (
              <Button
                size="icon"
                variant="ghost"
                title="Renombrar categoría"
                onClick={() => {
                  setRenameFrom(category)
                  setRenameTo(category)
                  setRenameOpen(true)
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button
            variant={includeArchived ? 'secondary' : 'outline'}
            onClick={() => setIncludeArchived((v) => !v)}
          >
            <ArrowDownAZ className="h-4 w-4" />
            {includeArchived ? 'Mostrando archivados' : 'Solo activos'}
          </Button>
        </div>

        <Card className="card-elev overflow-hidden">
          <CardContent className="p-0">
            {loading && firstLoad ? (
              <div className="divide-y divide-border/40">
                {[0, 1, 2, 3, 4].map((i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                illustration={<BoxEmptyArt />}
                title={search ? 'Sin resultados' : 'Inventario vacío'}
                description={
                  search
                    ? 'Prueba con otro término o limpia el filtro.'
                    : 'Crea un producto manualmente o usa el modo pistoleo de stock.'
                }
                action={
                  !search && (
                    <div className="flex gap-2">
                      <Button asChild variant="outline">
                        <Link to="/inventario/pistolear">
                          <ScanBarcode className="h-4 w-4" /> Pistolear stock
                        </Link>
                      </Button>
                      <Button onClick={() => setCreating(true)}>
                        <Plus className="h-4 w-4" /> Nuevo producto
                      </Button>
                    </div>
                  )
                }
              />
            ) : (
              <div className="overflow-auto scrollfade-y max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Producto</th>
                      <th className="px-4 py-2 text-left font-medium">Código</th>
                      <th className="px-4 py-2 text-right font-medium">Costo</th>
                      <th className="px-4 py-2 text-right font-medium">Precio</th>
                      <th className="px-4 py-2 text-right font-medium">Stock</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => (
                      <tr
                        key={p.id}
                        className={cn(
                          'group border-t border-border/40 transition-colors hover:bg-accent/30 cursor-pointer',
                          p.archived && 'opacity-50',
                        )}
                        onClick={() => setEditing(p)}
                      >
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{p.name}</div>
                          {p.category && (
                            <div className="text-xs text-muted-foreground">{p.category}</div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 mono text-xs text-muted-foreground">
                          {p.barcode ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right num text-muted-foreground">
                          {formatCLP(p.cost)}
                        </td>
                        <td className="px-4 py-2.5 text-right num font-semibold">
                          {formatCLP(p.price)}
                        </td>
                        <td className="px-4 py-2.5 text-right num">
                          <Badge
                            variant={
                              p.stock <= 0 ? 'destructive' : p.stock < 5 ? 'warning' : 'secondary'
                            }
                          >
                            {p.stock}
                          </Badge>
                        </td>
                        <td className="px-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditing(p)
                            }}
                            className="opacity-0 group-hover:opacity-100"
                          >
                            <Edit3 className="h-4 w-4" />
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

      <ProductDialog
        open={creating}
        onOpenChange={setCreating}
        product={null}
        onSaved={() => {
          setCreating(false)
          load()
        }}
      />
      <ProductDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        product={editing}
        onSaved={() => {
          setEditing(null)
          load()
          loadCategories()
        }}
      />

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Renombrar categoría</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>De</Label>
              <Input value={renameFrom} disabled />
            </div>
            <div className="space-y-1">
              <Label>A</Label>
              <Input
                autoFocus
                value={renameTo}
                onChange={(e) => setRenameTo(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Si dejas vacío, los productos quedarán "sin categoría".
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                const r = await api.categoriesRename(renameFrom, renameTo)
                toast({
                  variant: 'success',
                  title: `${r.updated} producto${r.updated === 1 ? '' : 's'} actualizado${r.updated === 1 ? '' : 's'}`,
                })
                setRenameOpen(false)
                if (category === renameFrom)
                  setCategory(renameTo.trim() ? renameTo.trim() : '__none__')
                await loadCategories()
                await load()
              }}
            >
              Renombrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SmallStat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'primary' | 'warning'
}) {
  return (
    <Card className="card-elev lift">
      <CardContent className="p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div
          className={cn(
            'num mt-1 text-xl font-bold',
            accent === 'primary' && 'brand-text',
            accent === 'warning' && 'text-warning',
          )}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  )
}
