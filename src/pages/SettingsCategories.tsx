import * as React from 'react'
import { Plus, Tag, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { useToast } from '@/hooks/useToast'
import { api } from '@/lib/api'
import { formatCLP } from '@shared/money'
import { cn } from '@/lib/utils'
import type { Category, CategoryInput } from '@shared/types'

const COLORS = [
  '#22d3ee', // cyan
  '#a78bfa', // violet
  '#f59e0b', // amber
  '#ef4444', // red
  '#10b981', // emerald
  '#ec4899', // pink
  '#3b82f6', // blue
  '#84cc16', // lime
  '#64748b', // slate
]

export function CategoriesTab() {
  const { toast } = useToast()
  const [items, setItems] = React.useState<Category[]>([])
  const [edit, setEdit] = React.useState<Category | null>(null)
  const [creating, setCreating] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<Category | null>(null)
  const [reassignTo, setReassignTo] = React.useState<string>('')
  const [deleting, setDeleting] = React.useState(false)

  const load = async () => setItems(await api.categoriesCrud())
  React.useEffect(() => {
    load()
  }, [])

  const otherCategories = items.filter((c) => c.id !== deleteTarget?.id)

  return (
    <div className="space-y-3">
      <Card className="card-elev">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Tag className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <div className="text-foreground">Categorías</div>
              <p className="text-[11px]">
                Agrupar productos por categoría te permite filtrar inventario, ver márgenes y
                aplicar promociones o subir precios masivamente. El margen por defecto se sugiere
                al crear productos en esa categoría.
              </p>
            </div>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nueva categoría
          </Button>
        </CardContent>
      </Card>

      <Card className="card-elev">
        <CardContent className="p-0">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay categorías. Crea una para empezar a organizar tu inventario.
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
              {items.map((c) => (
                <li
                  key={c.id}
                  className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/30"
                  onClick={() => setEdit(c)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ background: c.color || '#94a3b8' }}
                    />
                    <div className="min-w-0">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {c.product_count} producto{c.product_count === 1 ? '' : 's'}
                        {c.total_stock_value > 0 && (
                          <> · valor inventario {formatCLP(c.total_stock_value)}</>
                        )}
                        {c.default_margin != null && (
                          <> · margen sugerido {c.default_margin}%</>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteTarget(c)
                      setReassignTo('')
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <CategoryEditor
        open={creating || !!edit}
        onOpenChange={(v) => {
          if (!v) {
            setCreating(false)
            setEdit(null)
          }
        }}
        category={edit}
        onSaved={async () => {
          setCreating(false)
          setEdit(null)
          await load()
          toast({ variant: 'success', title: 'Categoría guardada' })
        }}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null)
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar categoría "{deleteTarget?.name}"</DialogTitle>
            <DialogDescription>
              {deleteTarget && deleteTarget.product_count > 0 ? (
                <>
                  {deleteTarget.product_count} producto
                  {deleteTarget.product_count === 1 ? '' : 's'} usa
                  {deleteTarget.product_count === 1 ? '' : 'n'} esta categoría. Elige a dónde
                  moverlos:
                </>
              ) : (
                'No hay productos en esta categoría. Se eliminará directamente.'
              )}
            </DialogDescription>
          </DialogHeader>

          {deleteTarget && deleteTarget.product_count > 0 && (
            <div className="space-y-2">
              <Label>Mover productos a</Label>
              <Select value={reassignTo} onValueChange={setReassignTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin categoría (recomendado)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin categoría</SelectItem>
                  {otherCategories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                if (!deleteTarget) return
                setDeleting(true)
                try {
                  await api.categoriesRemove(deleteTarget.id, {
                    reassignTo: reassignTo || null,
                  })
                  toast({ variant: 'success', title: 'Categoría eliminada' })
                  setDeleteTarget(null)
                  await load()
                } catch (err) {
                  toast({
                    variant: 'destructive',
                    title: 'No se pudo eliminar',
                    description: err instanceof Error ? err.message : String(err),
                  })
                } finally {
                  setDeleting(false)
                }
              }}
            >
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CategoryEditor({
  open,
  onOpenChange,
  category,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  category: Category | null
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = React.useState('')
  const [color, setColor] = React.useState<string>(COLORS[0])
  const [defaultMargin, setDefaultMargin] = React.useState<string>('')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    if (category) {
      setName(category.name)
      setColor(category.color ?? COLORS[0])
      setDefaultMargin(
        category.default_margin == null ? '' : String(category.default_margin),
      )
    } else {
      setName('')
      setColor(COLORS[0])
      setDefaultMargin('')
    }
  }, [open, category])

  const submit = async () => {
    if (!name.trim()) {
      toast({ variant: 'warning', title: 'Falta el nombre' })
      return
    }
    setSaving(true)
    try {
      const margin = defaultMargin.trim() ? Number(defaultMargin) : null
      const input: CategoryInput = {
        id: category?.id,
        name: name.trim(),
        color,
        default_margin:
          margin != null && isFinite(margin) ? Math.max(0, Math.min(1000, margin)) : null,
      }
      await api.categoriesSaveMeta(input)
      onSaved()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'No se pudo guardar',
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{category ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
          <DialogDescription>
            El margen por defecto se sugiere al crear productos en esta categoría (no aplica
            cambios automáticos a productos existentes).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nombre *</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Bebidas"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Color</Label>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-7 w-7 rounded-md border transition-all',
                    color === c
                      ? 'scale-110 border-foreground/40'
                      : 'border-transparent hover:scale-105',
                  )}
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Margen sugerido (%)</Label>
            <Input
              type="number"
              min={0}
              max={1000}
              value={defaultMargin}
              onChange={(e) => setDefaultMargin(e.target.value)}
              placeholder="ej. 35"
            />
            <p className="text-[11px] text-muted-foreground">
              Vacío = sin sugerencia. Cuando crees un producto en esta categoría, podrás aplicarlo
              con un click sobre el costo.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
