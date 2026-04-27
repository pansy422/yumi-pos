import { useEffect, useState } from 'react'
import { Box, Scale, TrendingUp } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { cn } from '@/lib/utils'
import type { Product, ProductInput } from '@shared/types'

type Form = {
  barcode: string
  name: string
  sku: string
  category: string
  cost: number
  price: number
  stock: number
  stock_min: number
  stock_max: number
  is_weight: boolean
  /** Stock en kg cuando is_weight=true (para edición; al guardar se convierte a gramos). */
  stock_kg: string
  stock_min_kg: string
  stock_max_kg: string
}

const empty: Form = {
  barcode: '',
  name: '',
  sku: '',
  category: '',
  cost: 0,
  price: 0,
  stock: 0,
  stock_min: 0,
  stock_max: 0,
  is_weight: false,
  stock_kg: '0',
  stock_min_kg: '0',
  stock_max_kg: '0',
}

function MarginPanel({
  cost,
  price,
  onPriceChange,
  onApplyDefaultMargin,
  categoryName,
}: {
  cost: number
  price: number
  onPriceChange: (newPrice: number) => void
  onApplyDefaultMargin: () => void
  categoryName: string
}) {
  const [marginText, setMarginText] = useState('')
  const computedMargin = cost > 0 ? Math.round(((price - cost) / cost) * 100) : 0
  useEffect(() => {
    setMarginText(String(computedMargin))
  }, [computedMargin])
  const profit = Math.max(0, price - cost)
  const applyMargin = (margin: number) => {
    const next = Math.round(cost * (1 + margin / 100))
    onPriceChange(Math.max(0, next))
  }
  return (
    <div className="sm:col-span-2 rounded-md border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-center gap-2 text-xs text-primary">
        <TrendingUp className="h-3.5 w-3.5" />
        <span className="font-medium uppercase tracking-wider">Margen de ganancia</span>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label className="text-[11px]">Ganancia $</Label>
          <div className="num text-lg font-bold text-success">
            +${profit.toLocaleString('es-CL')}
          </div>
        </div>
        <div>
          <Label className="text-[11px]">Margen actual %</Label>
          <div className="num text-lg font-bold">
            {cost > 0 ? `${computedMargin}%` : '—'}
          </div>
        </div>
        <div>
          <Label className="text-[11px]">Aplicar margen %</Label>
          <div className="flex gap-1">
            <Input
              type="number"
              value={marginText}
              onChange={(e) => setMarginText(e.target.value)}
              className="h-9 num"
              placeholder="ej. 35"
            />
            <Button
              size="sm"
              variant="secondary"
              type="button"
              className="h-9"
              onClick={() => {
                const m = Number(marginText)
                if (isFinite(m)) applyMargin(Math.max(0, Math.min(1000, m)))
              }}
            >
              OK
            </Button>
          </div>
        </div>
      </div>
      {categoryName && (
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="mt-2 text-[11px] text-primary hover:bg-primary/10"
          onClick={onApplyDefaultMargin}
        >
          Aplicar margen por defecto de "{categoryName}"
        </Button>
      )}
    </div>
  )
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  /**
   * Para productos nuevos mostramos primero un picker preguntando si es por
   * unidad o por peso. Para edición saltamos directo al formulario.
   */
  const [step, setStep] = useState<'pick_type' | 'form'>('form')

  useEffect(() => {
    if (!open) {
      setConfirmDelete(false)
      return
    }
    if (product) {
      setForm({
        barcode: product.barcode ?? '',
        name: product.name,
        sku: product.sku ?? '',
        category: product.category ?? '',
        cost: product.cost,
        price: product.price,
        stock: product.stock,
        stock_min: product.stock_min ?? 0,
        stock_max: product.stock_max ?? 0,
        is_weight: product.is_weight === 1,
        stock_kg:
          product.is_weight === 1 ? (product.stock / 1000).toFixed(3) : String(product.stock),
        stock_min_kg:
          product.is_weight === 1 ? ((product.stock_min ?? 0) / 1000).toFixed(3) : '0',
        stock_max_kg:
          product.is_weight === 1 ? ((product.stock_max ?? 0) / 1000).toFixed(3) : '0',
      })
      setArchived(product.archived === 1)
      setStep('form')
    } else {
      setForm({ ...empty, barcode: defaultBarcode ?? '' })
      setArchived(false)
      // Si vienes con un barcode (pistoleo), saltamos el picker — los códigos
      // pistoleados son por definición productos por unidad.
      setStep(defaultBarcode ? 'form' : 'pick_type')
    }
  }, [open, product, defaultBarcode])

  const handleDelete = async () => {
    if (!product) return
    setSaving(true)
    const archiveFallback = async (reasonForUser: string) => {
      try {
        await api.productsArchive(product.id, true)
        toast({
          variant: 'success',
          title: 'Producto archivado',
          description: `${product.name} se ocultó del POS. ${reasonForUser}`,
          duration: 7000,
        })
        onSaved(product)
      } catch (e2) {
        toast({
          variant: 'destructive',
          title: 'No se pudo archivar',
          description: e2 instanceof Error ? e2.message : String(e2),
        })
      }
    }
    try {
      await api.productsDelete(product.id)
      toast({
        variant: 'success',
        title: 'Producto eliminado',
        description: product.name,
      })
      onSaved(product)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // El único caso bloqueante hoy es una promoción configurada
      // contra el producto. Caemos a archivar para no dejar a la
      // cajera atascada (las ventas históricas ya no son problema:
      // el FK es ON DELETE SET NULL).
      if (msg.includes('promoción')) {
        await archiveFallback(
          'Tenía una promoción configurada. Si quieres borrar definitivamente, primero elimina la promoción.',
        )
      } else {
        toast({ variant: 'destructive', title: 'No se pudo eliminar', description: msg })
      }
    } finally {
      setSaving(false)
    }
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast({ variant: 'warning', title: 'Falta el nombre' })
      return
    }
    setSaving(true)
    try {
      const toGrams = (s: string) => Math.round(parseFloat(s.replace(',', '.')) * 1000) || 0
      const stockValue = form.is_weight ? toGrams(form.stock_kg) : Math.round(form.stock) || 0
      const stockMin = form.is_weight
        ? toGrams(form.stock_min_kg)
        : Math.round(form.stock_min) || 0
      const stockMax = form.is_weight
        ? toGrams(form.stock_max_kg)
        : Math.round(form.stock_max) || 0
      const input: ProductInput = {
        barcode: form.barcode.trim() || null,
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        category: form.category.trim() || null,
        cost: form.cost,
        price: form.price,
        stock: stockValue,
        stock_min: stockMin,
        stock_max: stockMax,
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
          <DialogTitle>
            {product ? 'Editar producto' : step === 'pick_type' ? '¿Cómo se vende?' : 'Nuevo producto'}
          </DialogTitle>
          {!product && step === 'pick_type' && (
            <DialogDescription>
              Elige antes de cargar los datos. Después no se puede cambiar el tipo de un producto sin recrearlo.
            </DialogDescription>
          )}
        </DialogHeader>

        {step === 'pick_type' && !product ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => {
                setForm((f) => ({ ...f, is_weight: false }))
                setStep('form')
              }}
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-border bg-card px-4 py-8 text-center transition-all',
                'hover:border-primary hover:bg-primary/5',
              )}
            >
              <Box className="h-10 w-10 text-primary" />
              <div className="font-semibold">Por unidad</div>
              <p className="text-[11px] text-muted-foreground">
                Cada uno tiene un precio fijo. Bebidas, abarrotes, snacks…
              </p>
            </button>
            <button
              onClick={() => {
                setForm((f) => ({ ...f, is_weight: true }))
                setStep('form')
              }}
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-border bg-card px-4 py-8 text-center transition-all',
                'hover:border-primary hover:bg-primary/5',
              )}
            >
              <Scale className="h-10 w-10 text-primary" />
              <div className="font-semibold">Por peso (kg)</div>
              <p className="text-[11px] text-muted-foreground">
                Verduras, frutas, fiambres, queso. Se cobra por kilo, al vender se
                ingresa el peso.
              </p>
            </button>
          </div>
        ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
            {form.is_weight ? <Scale className="h-3.5 w-3.5" /> : <Box className="h-3.5 w-3.5" />}
            Tipo: <span className="font-semibold">{form.is_weight ? 'Por peso (kg)' : 'Por unidad'}</span>
            {!product && (
              <button
                type="button"
                onClick={() => setStep('pick_type')}
                className="ml-auto rounded text-primary/80 hover:text-primary underline"
              >
                Cambiar
              </button>
            )}
          </div>
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
          <MarginPanel
            cost={form.cost}
            price={form.price}
            onPriceChange={(newPrice) => setForm({ ...form, price: newPrice })}
            onApplyDefaultMargin={async () => {
              if (!form.category) return
              const cats = await api.categoriesCrud()
              const cat = cats.find((c) => c.name === form.category)
              if (cat?.default_margin != null) {
                const newPrice = Math.round(form.cost * (1 + cat.default_margin / 100))
                setForm({ ...form, price: newPrice })
              }
            }}
            categoryName={form.category}
          />

          <div className="sm:col-span-2 -mb-1 mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Alertas de stock (opcional)
          </div>
          {form.is_weight ? (
            <>
              <div className="space-y-1">
                <Label>Stock mínimo (kg)</Label>
                <Input
                  inputMode="decimal"
                  value={form.stock_min_kg}
                  onChange={(e) => setForm({ ...form, stock_min_kg: e.target.value })}
                  placeholder="ej. 1.000"
                />
              </div>
              <div className="space-y-1">
                <Label>Stock máximo (kg)</Label>
                <Input
                  inputMode="decimal"
                  value={form.stock_max_kg}
                  onChange={(e) => setForm({ ...form, stock_max_kg: e.target.value })}
                  placeholder="ej. 20.000"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <Label>Stock mínimo</Label>
                <Input
                  type="number"
                  value={form.stock_min}
                  onChange={(e) =>
                    setForm({ ...form, stock_min: Number(e.target.value) || 0 })
                  }
                  placeholder="0 = sin alerta"
                />
              </div>
              <div className="space-y-1">
                <Label>Stock máximo</Label>
                <Input
                  type="number"
                  value={form.stock_max}
                  onChange={(e) =>
                    setForm({ ...form, stock_max: Number(e.target.value) || 0 })
                  }
                  placeholder="0 = sin tope"
                />
              </div>
            </>
          )}
          <p className="sm:col-span-2 -mt-2 text-[11px] text-muted-foreground">
            Cuando el stock baja del mínimo aparece en el reporte de reposición. Deja en 0 para no
            generar alerta.
          </p>

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
        )}

        {step === 'form' && product && confirmDelete && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
            <div className="text-sm font-semibold text-destructive">
              ¿Eliminar "{product.name}"?
            </div>
            <p className="mt-1 text-[12px] text-foreground">
              Esta acción no se puede deshacer. Las boletas históricas siguen viéndose
              perfectas (guardamos el nombre y precio en cada línea de venta).
            </p>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmDelete(false)}
                disabled={saving}
              >
                Volver
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={saving}
                onClick={async () => {
                  await handleDelete()
                  setConfirmDelete(false)
                }}
              >
                {saving ? 'Eliminando…' : 'Sí, eliminar'}
              </Button>
            </div>
          </div>
        )}

        {step === 'form' && (
          <DialogFooter className="sm:justify-between">
            {product ? (
              <Button
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={saving || confirmDelete}
                onClick={() => setConfirmDelete(true)}
              >
                Eliminar
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={saving || confirmDelete}>
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
