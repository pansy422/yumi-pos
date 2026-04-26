import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownAZ, Edit3, Plus, Search, ScanBarcode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/common/PageHeader'
import { ProductDialog } from './ProductDialog'
import { api } from '@/lib/api'
import type { Product } from '@shared/types'
import { formatCLP } from '@shared/money'
import { cn } from '@/lib/utils'

export function Inventory() {
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<Product[]>([])
  const [editing, setEditing] = useState<Product | null>(null)
  const [creating, setCreating] = useState(false)
  const [includeArchived, setIncludeArchived] = useState(false)

  const load = async () => {
    const list = await api.productsList({ search, includeArchived })
    setItems(list)
  }

  useEffect(() => {
    const t = setTimeout(load, 120)
    return () => clearTimeout(t)
  }, [search, includeArchived])

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Inventario"
        description={`${items.length} productos`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/inventario/pistolear">
                <ScanBarcode className="h-4 w-4" /> Pistolear stock
              </Link>
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Nuevo producto
            </Button>
          </>
        }
      />
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="pl-9"
              placeholder="Buscar por nombre, código o SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant={includeArchived ? 'secondary' : 'outline'}
            onClick={() => setIncludeArchived((v) => !v)}
          >
            <ArrowDownAZ className="h-4 w-4" />
            {includeArchived ? 'Mostrando archivados' : 'Solo activos'}
          </Button>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {items.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No hay productos. Crea uno o pistolea stock.
              </p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Producto</th>
                      <th className="px-4 py-2 text-left">Código</th>
                      <th className="px-4 py-2 text-right">Costo</th>
                      <th className="px-4 py-2 text-right">Precio</th>
                      <th className="px-4 py-2 text-right">Stock</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => (
                      <tr
                        key={p.id}
                        className={cn('border-t hover:bg-accent/40', p.archived && 'opacity-50')}
                      >
                        <td className="px-4 py-2">
                          <div className="font-medium">{p.name}</div>
                          {p.category && (
                            <div className="text-xs text-muted-foreground">{p.category}</div>
                          )}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">{p.barcode ?? '—'}</td>
                        <td className="px-4 py-2 text-right num">{formatCLP(p.cost)}</td>
                        <td className="px-4 py-2 text-right num font-semibold">
                          {formatCLP(p.price)}
                        </td>
                        <td className="px-4 py-2 text-right num">
                          <Badge
                            variant={
                              p.stock <= 0 ? 'destructive' : p.stock < 5 ? 'warning' : 'secondary'
                            }
                          >
                            {p.stock}
                          </Badge>
                        </td>
                        <td className="px-2">
                          <Button size="icon" variant="ghost" onClick={() => setEditing(p)}>
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
        }}
      />
    </div>
  )
}
