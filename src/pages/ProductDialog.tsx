import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyInput } from '@/components/common/MoneyInput'
import { CategoryCombobox } from '@/components/common/CategoryCombobox'
import { useToast } from '@/hooks/useToast'
import { api } from '@/lib/api'
import type { Product, ProductInput } from '@shared/types'

type Form = {
  barcode: string
  name: string
  sku: string
  category: string
  cost: number
  price: number
  stock: number
}

const empty: Form = { barcode: '', name: '', sku: '', category: '', cost: 0, price: 0, stock: 0 }

export function ProductDialog({
  open,
  onOpenChange,
  product,
  onSaved,
  defaultBarcode,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  product: Product | null
  onSaved: (p: Product) => void
  defaultBarcode?: string
}) {
  const { toast } = useToast()
  const [form, setForm] = useState<Form>(empty)
  const [saving, setSaving] = useState(false)
  const [archived, setArchived] = useState(false)

  useEffect(() => {
    if (!open) return
    if (product) {
      setForm({
        barcode: product.barcode ?? '',
        name: product.name,
        sku: product.sku ?? '',
        category: product.category ?? '',
        cost: product.cost,
        price: product.price,
        stock: product.stock,
      })
      setArchived(product.archived === 1)
    } else {
      setForm({ ...empty, barcode: defaultBarcode ?? '' })
      setArchived(false)
    }
  }, [open, product, defaultBarcode])

  const save = async () => {
    if (!form.name.trim()) {
      toast({ variant: 'warning', title: 'Falta el nombre' })
      return
    }
    setSaving(true)
    try {
      const input: ProductInput = {
        barcode: form.barcode.trim() || null,
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        category: form.category.trim() || null,
        cost: form.cost,
        price: form.price,
        stock: form.stock,
      }
      const saved = product
        ? await api.productsUpdate(product.id, { ...input, archived: archived ? 1 : 0 })
        : await api.productsCreate(input)
      toast({ variant: 'success', title: product ? 'Producto actualizado' : 'Producto creado' })
      onSaved(saved)
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Nombre *</Label>
            <Input
              autoFocus={!defaultBarcode}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Código de barras</Label>
            <Input
              autoFocus={!!defaultBarcode}
              value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>SKU</Label>
            <Input
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Categoría</Label>
            <CategoryCombobox
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v })}
            />
          </div>
          <div className="space-y-1">
            <Label>Stock</Label>
            <Input
              type="number"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1">
            <Label>Costo</Label>
            <MoneyInput value={form.cost} onValueChange={(n) => setForm({ ...form, cost: n })} />
          </div>
          <div className="space-y-1">
            <Label>Precio venta *</Label>
            <MoneyInput value={form.price} onValueChange={(n) => setForm({ ...form, price: n })} />
          </div>
          {product && (
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id="archived"
                type="checkbox"
                checked={archived}
                onChange={(e) => setArchived(e.target.checked)}
              />
              <Label htmlFor="archived">Archivar (oculto del POS)</Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
