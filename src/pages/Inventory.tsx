import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Archive,
  ArrowDownAZ,
  Edit3,
  FileUp,
  Pencil,
  Percent,
  Plus,
  Printer,
  Search,
  ScanBarcode,
  Tag,
} from 'lucide-react'
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
import { useIsAdmin } from '@/hooks/useRole'
import { ProductDialog } from './ProductDialog'
import { CsvImport } from '@/components/common/CsvImport'
import { BulkPriceDialog } from '@/components/common/BulkPriceDialog'
import { api } from '@/lib/api'
import type { Category, Product } from '@shared/types'
import { formatCLP, formatWeight } from '@shared/money'
import { cn } from '@/lib/utils'

export function Inventory() {
  const { toast } = useToast()
  const isAdmin = useIsAdmin()
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<Product[]>([])
  const [editing, setEditing] = useState<Product | null>(null)
  const [creating, setCreating] = useState(false)
  const [archivedFilter, setArchivedFilter] = useState<'active' | 'archived' | 'all'>('active')
  const [loading, setLoading] = useState(true)
  const [firstLoad, setFirstLoad] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [category, setCategory] = useState<'__all__' | '__none__' | string>('__all__')
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameFrom, setRenameFrom] = useState('')
  const [renameTo, setRenameTo] = useState('')
  const [csvOpen, setCsvOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    const filterCategory =
      category === '__all__' ? undefined : category === '__none__' ? null : category
    const list = await api.productsList({
      search,
      includeArchived: archivedFilter === 'all',
      onlyArchived: archivedFilter === 'archived',
      category: filterCategory,
    })
    setItems(list)
    setLoading(false)
    setFirstLoad(false)
  }

  const loadCategories = async () => {
    setCategories(await api.categoriesCrud())
  }

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 120)
    return () => clearTimeout(t)
  }, [search, archivedFilter, category])

  const totalStockValue = items.reduce(
    (a, i) => a + (i.is_weight === 1 ? Math.round((i.cost * i.stock) / 1000) : i.cost * i.stock),
    0,
  )
  // Producto "crítico" cuando tiene stock_min definido y bajo, o stock <= 0.
  const lowStock = items.filter(
    (i) => !i.archived && i.stock > 0 && i.stock_min > 0 && i.stock < i.stock_min,
  ).length
  const outOfStock = items.filter((i) => i.stock <= 0 && !i.archived).length
  const showCriticalBanner =
    !firstLoad && lowStock + outOfStock > 0 && !search && category === '__all__'

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Inventario"
        description={`${items.length} ${items.length === 1 ? 'producto' : 'productos'}${lowStock ? ` · ${lowStock} con stock bajo` : ''}`}
        actions={
          <>
            <Button
              variant="outline"
              onClick={async () => {
                const r = await api.printLowStock()
                if (r.ok) toast({ variant: 'success', title: 'Reporte enviado a la impresora' })
                else
                  toast({
                    variant: 'destructive',
                    title: 'No se pudo imprimir',
                    description: r.error,
                  })
              }}
            >
              <Printer className="h-4 w-4" /> Imprimir reposición
            </Button>
            {isAdmin && (
              <>
                <Button variant="outline" onClick={() => setCsvOpen(true)}>
                  <FileUp className="h-4 w-4" /> Importar CSV
                </Button>
                <Button asChild variant="outline">
                  <Link to="/ajustes?tab=categories">
                    <Tag className="h-4 w-4" /> Categorías
                  </Link>
                </Button>
              </>
            )}
            <Button asChild variant="outline">
              <Link to="/inventario/pistolear">
                <ScanBarcode className="h-4 w-4" /> Pistolear
              </Link>
            </Button>
            {isAdmin && (
              <Button onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" /> Nuevo producto
              </Button>
            )}
          </>
        }
      />
      <div className="flex flex-col gap-4 p-6">
        {archivedFilter === 'archived' && (
          <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm animate-fade-in">
            <Archive className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium">Productos inactivos</div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Estos productos están ocultos del POS pero aparecen en las boletas históricas.
                Click en uno para abrirlo: usa el switch <strong>Activo / Inactivo</strong> para
                volver a venderlo, o el botón rojo <strong>Eliminar</strong> para borrarlo de
                forma definitiva.
              </p>
            </div>
          </div>
        )}
        {showCriticalBanner && (
          <div className="flex items-center justify-between rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning animate-fade-in">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <div>
                <div className="font-medium">Atención al stock</div>
                <p className="mt-0.5 text-[11px] opacity-90">
                  {outOfStock > 0 && (
                    <>
                      <span className="font-semibold">{outOfStock}</span> producto
                      {outOfStock === 1 ? '' : 's'} sin stock
                    </>
                  )}
                  {outOfStock > 0 && lowStock > 0 && ' · '}
                  {lowStock > 0 && (
                    <>
                      <span className="font-semibold">{lowStock}</span> bajo del mínimo
                    </>
                  )}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-warning"
              onClick={async () => {
                const r = await api.printLowStock()
                if (r.ok) toast({ variant: 'success', title: 'Reporte enviado a la impresora' })
                else
                  toast({
                    variant: 'destructive',
                    title: 'No se pudo imprimir',
                    description: r.error,
                  })
              }}
            >
              <Printer className="h-3.5 w-3.5" /> Imprimir reposición
            </Button>
          </div>
        )}
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
                  <SelectItem key={c.id} value={c.name}>
                    {c.name} ({c.product_count})
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
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                title={
                  category === '__all__'
                    ? 'Subir o bajar todos los precios por %'
                    : `Cambiar precios de ${category === '__none__' ? 'productos sin categoría' : category} en %`
                }
                onClick={() => setBulkOpen(true)}
              >
                <Percent className="h-3.5 w-3.5" />
                Precios
              </Button>
            )}
          </div>
          <div className="flex overflow-hidden rounded-md border border-border">
            {(
              [
                { id: 'active' as const, label: 'Activos', icon: ArrowDownAZ },
                { id: 'archived' as const, label: 'Inactivos', icon: Archive },
                { id: 'all' as const, label: 'Todos', icon: null },
              ]
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setArchivedFilter(opt.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors',
                  archivedFilter === opt.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:bg-accent',
                )}
              >
                {opt.icon ? <opt.icon className="h-3.5 w-3.5" /> : null}
                {opt.label}
              </button>
            ))}
          </div>
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
                  <thead className="sticky top-0 z-10 bg-card/90 text-[10px] font-semibold uppercase tracking-caps text-muted-foreground backdrop-blur-md backdrop-saturate-150">
                    <tr>
                      <th className="px-4 py-3 text-left">Producto</th>
                      <th className="px-4 py-3 text-left">Código</th>
                      <th className="px-4 py-3 text-right">Costo</th>
                      <th className="px-4 py-3 text-right">Precio</th>
                      <th className="px-4 py-3 text-right">Stock</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => (
                      <tr
                        key={p.id}
                        className={cn(
                          'group border-t border-border/40 cursor-pointer',
                          'transition-colors duration-150 hover:bg-accent/40',
                          p.archived && 'bg-muted/40',
                        )}
                        onClick={() => setEditing(p)}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className={cn('font-medium', p.archived && 'text-muted-foreground line-through')}>
                              {p.name}
                            </span>
                            {p.archived === 1 && (
                              <Badge variant="secondary" className="gap-1">
                                <Archive className="h-3 w-3" />
                                Inactivo
                              </Badge>
                            )}
                          </div>
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
                              p.stock <= 0
                                ? 'destructive'
                                : p.stock_min > 0 && p.stock < p.stock_min
                                  ? 'warning'
                                  : 'secondary'
                            }
                          >
                            {p.is_weight === 1 ? formatWeight(p.stock) : p.stock}
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
                            title="Editar producto"
                            className="text-muted-foreground hover:text-foreground"
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

      <CsvImport
        open={csvOpen}
        onOpenChange={setCsvOpen}
        onImported={async () => {
          await load()
          await loadCategories()
        }}
      />

      <BulkPriceDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        filter={
          category === '__all__'
            ? { kind: 'all', label: 'todos los productos' }
            : category === '__none__'
              ? { kind: 'category', category: null, label: 'productos sin categoría' }
              : { kind: 'category', category, label: category }
        }
        onApplied={async () => {
          await load()
          await loadCategories()
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
    <Card className={cn('card-elev lift', accent === 'primary' && 'iridescent-border')}>
      <CardContent className="p-4">
        <div className="text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
          {label}
        </div>
        <div
          className={cn(
            'num mt-1.5 text-2xl font-semibold leading-none tracking-display-tight',
            accent === 'primary' && 'iridescent-text',
            accent === 'warning' && 'text-warning',
          )}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  )
}
