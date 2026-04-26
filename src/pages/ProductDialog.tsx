import { useEffect, useState } from 'react'
import { Scale } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
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
  is_weight: boolean
  /** Stock en kg cuando is_weight=true (para edición; al guardar se convierte a gramos). */
  stock_kg: string
}

const empty: Form = {
  barcode: '',
  name: '',
  sku: '',
  category: '',
  cost: 0,
  price: 0,
  stock: 0,
  is_weight: false,
  stock_kg: '0',
}

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
        is_weight: product.is_weight === 1,
        stock_kg:
          product.is_weight === 1 ? (product.stock / 1000).toFixed(3) : String(product.stock),
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
      const stockGrams = form.is_weight
        ? Math.round(parseFloat(form.stock_kg.replace(',', '.')) * 1000) || 0
        : Math.round(form.stock) || 0
      const input: ProductInput = {
        barcode: form.barcode.trim() || null,
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        category: form.category.trim() || null,
        cost: form.cost,
        price: form.price,
        stock: stockGrams,
        is_weight: form.is_weight ? 1 : 0,
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

          <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 p-3">
            <div className="flex items-start gap-2">
              <Scale className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <Label className="text-sm text-foreground">Vendido por peso (kg)</Label>
                <p className="text-[11px] text-muted-foreground">
                  Para verduras, frutas, carnes. El precio se cobra por kilo y al
                  vender se ingresa el peso.
                </p>
              </div>
            </div>
            <Switch
              checked={form.is_weight}
              onCheckedChange={(v) => setForm({ ...form, is_weight: v })}
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
            <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Categoría</Label>
            <CategoryCombobox
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v })}
            />
          </div>
          {form.is_weight ? (
            <div className="space-y-1">
              <Label>Stock (kg)</Label>
              <Input
                inputMode="decimal"
                value={form.stock_kg}
                onChange={(e) => setForm({ ...form, stock_kg: e.target.value })}
                placeholder="ej. 12.500"
              />
              <p className="text-[11px] text-muted-foreground">
                Acepta decimales. Internamente se guarda en gramos.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <Label>Stock</Label>
              <Input
                type="number"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: Number(e.target.value) || 0 })}
              />
            </div>
          )}
          <div className="space-y-1">
            <Label>Costo {form.is_weight ? 'por kg' : ''}</Label>
            <MoneyInput value={form.cost} onValueChange={(n) => setForm({ ...form, cost: n })} />
          </div>
          <div className="space-y-1">
            <Label>Precio venta {form.is_weight ? 'por kg' : ''} *</Label>
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
