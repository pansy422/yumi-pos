import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Archive,
  ArrowDownAZ,
  Edit3,
  FileUp,
  Percent,
  Plus,
  Printer,
  Search,
  ScanBarcode,
  Tag,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SkeletonRow } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, BoxEmptyArt } from '@/components/common/EmptyState'
import { useToast } from '@/hooks/useToast'
import { useIsAdmin } from '@/hooks/useRole'
import { ProductDialog } from './ProductDialog'
import { CsvImport } from '@/components/common/CsvImport'
import { BulkPriceDialog } from '@/components/common/BulkPriceDialog'
import { api } from '@/lib/api'
import type { Product, ProductStats } from '@shared/types'
import { formatCLP, formatWeight } from '@shared/money'
import { cn } from '@/lib/utils'

/** Filas por bloque al desplazar. La lista NO tiene tope: se piden
 *  bloques hasta llegar al `total` que informa la base. */
const PAGE_SIZE = 100

type StatusFilter = 'active' | 'archived' | 'all'

export function Inventory() {
  const { toast } = useToast()
  const isAdmin = useIsAdmin()
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<ProductStats | null>(null)
  const [editing, setEditing] = useState<Product | null>(null)
  const [creating, setCreating] = useState(false)
  const [status, setStatus] = useState<StatusFilter>('active')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [firstLoad, setFirstLoad] = useState(true)
  const [csvOpen, setCsvOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  // Cada recarga desde cero incrementa este contador; las respuestas de
  // consultas viejas (búsqueda que cambió mientras esperábamos) se
  // descartan comparando contra él.
  const queryVersion = useRef(0)

  const loadStats = useCallback(async () => {
    try {
      setStats(await api.productsStats())
    } catch (err) {
      console.error('[inventario] stats', err)
    }
  }, [])

  const reload = useCallback(async () => {
    const version = ++queryVersion.current
    setLoading(true)
    try {
      const r = await api.productsPage({ search, status, offset: 0, limit: PAGE_SIZE })
      if (version !== queryVersion.current) return
      setItems(r.items)
      setTotal(r.total)
    } finally {
      if (version === queryVersion.current) {
        setLoading(false)
        setFirstLoad(false)
      }
    }
  }, [search, status])

  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return
    if (items.length >= total) return
    const version = queryVersion.current
    setLoadingMore(true)
    try {
      const r = await api.productsPage({
        search,
        status,
        offset: items.length,
        limit: PAGE_SIZE,
      })
      if (version !== queryVersion.current) return
      setItems((cur) => {
        const seen = new Set(cur.map((p) => p.id))
        return [...cur, ...r.items.filter((p) => !seen.has(p.id))]
      })
      setTotal(r.total)
    } finally {
      setLoadingMore(false)
    }
  }, [items.length, loading, loadingMore, search, status, total])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  useEffect(() => {
    const t = setTimeout(reload, 120)
    return () => clearTimeout(t)
  }, [reload])

  // Desplazamiento progresivo: cuando el centinela del final de la tabla
  // entra en pantalla pedimos el siguiente bloque.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore()
      },
      { rootMargin: '200px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadMore])

  const refreshAll = async () => {
    await Promise.all([reload(), loadStats()])
  }

  const printLowStock = async () => {
    const r = await api.printLowStock()
    if (r.ok) toast({ variant: 'success', title: 'Reporte enviado a la impresora' })
    else toast({ variant: 'destructive', title: 'No se pudo imprimir', description: r.error })
  }

  const showCriticalBanner =
    !!stats && stats.low_stock + stats.out_of_stock > 0 && !search && status === 'active'

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Inventario"
        description={
          stats
            ? `${stats.active} ${stats.active === 1 ? 'producto activo' : 'productos activos'}${stats.low_stock ? ` · ${stats.low_stock} con stock bajo` : ''}`
            : undefined
        }
        actions={
          <>
            <Button variant="outline" onClick={printLowStock}>
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
                <Button asChild variant="outline">
                  <Link to="/mermas">
                    <Trash2 className="h-4 w-4" /> Mermas
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
        {status === 'archived' && (
          <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm animate-fade-in">
            <Archive className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium">Productos inactivos</div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Estos productos están ocultos del POS pero aparecen en las boletas históricas.
                Click en uno para abrirlo: usa el switch <strong>Activo / Inactivo</strong> para
                volver a venderlo. Eliminar solo es posible cuando el stock es 0.
              </p>
            </div>
          </div>
        )}
        {showCriticalBanner && stats && (
          <div className="flex items-center justify-between rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning animate-fade-in">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <div>
                <div className="font-medium">Atención al stock</div>
                <p className="mt-0.5 text-[11px] opacity-90">
                  {stats.out_of_stock > 0 && (
                    <>
                      <span className="font-semibold">{stats.out_of_stock}</span> producto
                      {stats.out_of_stock === 1 ? '' : 's'} sin stock
                    </>
                  )}
                  {stats.out_of_stock > 0 && stats.low_stock > 0 && ' · '}
                  {stats.low_stock > 0 && (
                    <>
                      <span className="font-semibold">{stats.low_stock}</span> bajo del mínimo
                    </>
                  )}
                </p>
              </div>
            </div>
            <Button size="sm" variant="ghost" className="text-warning" onClick={printLowStock}>
              <Printer className="h-3.5 w-3.5" /> Imprimir reposición
            </Button>
          </div>
        )}
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            <SmallStat label="Productos activos" value={String(stats.active)} />
            <SmallStat
              label="Valor inventario (costo)"
              value={formatCLP(stats.stock_value)}
              accent="primary"
            />
            <SmallStat
              label="Sin stock"
              value={String(stats.out_of_stock)}
              accent={stats.out_of_stock > 0 ? 'warning' : undefined}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[280px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="h-11 pl-9"
              placeholder="Buscar por nombre, código de barras o SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              title="Subir o bajar todos los precios por %"
              onClick={() => setBulkOpen(true)}
            >
              <Percent className="h-3.5 w-3.5" />
              Precios
            </Button>
          )}
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
                onClick={() => setStatus(opt.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors',
                  status === opt.id
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
                    ? 'Prueba con otro término o limpia el buscador.'
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
                          {p.barcode ?? p.sku ?? '—'}
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
                <div ref={sentinelRef} className="h-px" />
                <div className="border-t border-border/40 px-4 py-2 text-center text-[11px] text-muted-foreground">
                  {loadingMore
                    ? 'Cargando más…'
                    : items.length < total
                      ? `${items.length} de ${total} · desplázate para ver más`
                      : `${total} ${total === 1 ? 'producto' : 'productos'}`}
                </div>
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
          refreshAll()
        }}
      />
      <ProductDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        product={editing}
        onSaved={() => {
          setEditing(null)
          refreshAll()
        }}
      />

      <CsvImport open={csvOpen} onOpenChange={setCsvOpen} onImported={refreshAll} />

      <BulkPriceDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        filter={{ kind: 'all', label: 'todos los productos' }}
        onApplied={refreshAll}
      />
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
    <Card className={cn('card-elev lift', accent === 'primary' && 'accent-border')}>
      <CardContent className="p-4">
        <div className="text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
          {label}
        </div>
        <div
          className={cn(
            'num mt-1.5 text-2xl font-semibold leading-none tracking-display-tight',
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
