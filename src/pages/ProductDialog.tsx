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
import { useIsAdmin } from '@/hooks/useRole'
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
  // No clampear a 0: si precio < costo el negocio pierde plata por unidad.
  // Antes mostrábamos "+$0" y la cajera no notaba el problema. Mejor que
  // se vea con signo y color destructivo.
  const profit = price - cost
  const negative = profit < 0
  const applyMargin = (margin: number) => {
    const next = Math.round(cost * (1 + margin / 100))
    onPriceChange(Math.max(0, next))
  }
  return (
    <div className="sm:col-span-2 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/8 via-card to-primary/4 p-4">
      <div className="flex items-center gap-2 text-primary">
        <TrendingUp className="h-3.5 w-3.5" />
        <span className="text-[10px] font-semibold uppercase tracking-caps">
          Margen de ganancia
        </span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label className="text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
            Ganancia
          </Label>
          <div
            className={cn(
              'num mt-1 text-xl font-semibold leading-none tracking-display-tight',
              negative ? 'text-destructive' : 'text-success',
            )}
          >
            {negative ? '−' : '+'}$
            {Math.abs(profit).toLocaleString('es-CL')}
          </div>
          {negative && (
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-caps text-destructive">
              Margen negativo
            </p>
          )}
        </div>
        <div>
          <Label className="text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
            Margen actual
          </Label>
          <div className="num mt-1 text-xl font-semibold leading-none tracking-display-tight">
            {cost > 0 ? `${computedMargin}%` : '—'}
          </div>
        </div>
        <div>
          <Label className="text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
            Aplicar margen %
          </Label>
          <div className="mt-1 flex gap-1">
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
              className="h-9 px-3"
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
          className="mt-3 h-7 text-[11px] text-primary hover:bg-primary/10"
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
  const isAdmin = useIsAdmin()
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
      // Eliminar es definitivo. Las boletas históricas siguen viéndose
      // perfectas (FK ON DELETE SET NULL + snapshots). El único caso
      // bloqueante es una promoción activa apuntando al producto: la
      // cajera tiene que limpiar la promo antes.
      toast({ variant: 'destructive', title: 'No se pudo eliminar', description: msg })
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
      // Parse de kg tolerante a formato CL/internacional:
      //  - "1,5"    → 1.5 kg  → 1500 g
      //  - "12.500" → 12.5 kg → 12500 g  (mantiene convención previa, placeholder)
      //  - "1.234,5" → 1234.5 kg → 1234500 g  (punto como miles, coma como decimal)
      //  - "12.500,5" → 12500.5 kg → 12500500 g
      // Antes parseFloat("1.234,5".replace(',', '.')) = parseFloat("1.234.5") = 1.234
      // y 1.234 kg se guardaba como 1234 g cuando debería haber sido 1234500 g.
      const toGrams = (s: string) => {
        const t = (s || '').trim()
        if (!t) return 0
        let normalized = t
        if (t.includes(',')) {
          // Latin: '.' = miles, ',' = decimal.
          normalized = t.replace(/\./g, '').replace(',', '.')
        }
        const n = parseFloat(normalized)
        if (!Number.isFinite(n) || n < 0) return 0
        return Math.round(n * 1000)
      }
      const stockValue = form.is_weight ? toGrams(form.stock_kg) : Math.round(form.stock) || 0
      const stockMin = form.is_weight
        ? toGrams(form.stock_min_kg)
        : Math.round(form.stock_min) || 0
      const stockMax = form.is_weight
        ? toGrams(form.stock_max_kg)
        : Math.round(form.stock_max) || 0
      // Si ambos están seteados y max < min, el reporte de reposición pinta
      // raro y la cajera puede pensar que es bug. Avisamos antes de guardar.
      if (stockMin > 0 && stockMax > 0 && stockMax < stockMin) {
        toast({
          variant: 'warning',
          title: 'Stock máximo menor al mínimo',
          description: 'Revisá los umbrales: el máximo no puede ser menor que el mínimo.',
        })
        setSaving(false)
        return
      }
      // Barcode: además de trim, sacamos espacios internos. Si la cajera
      // pega "12 34" (típico copy/paste), futuros escaneos con "1234" no
      // matchearían y crearía duplicado.
      const barcodeClean = form.barcode.replace(/\s+/g, '')
      const input: ProductInput = {
        barcode: barcodeClean || null,
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
                'group flex flex-col items-center justify-center gap-3 rounded-xl px-4 py-8 text-center',
                'border border-border/70 bg-card',
                'transition-[border-color,background-color,transform,box-shadow] duration-200 ease-out-quart',
                'hover:border-primary/40 hover:bg-primary/5 hover:-translate-y-0.5',
                'hover:shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.3)]',
                'active:scale-[0.98]',
              )}
            >
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                <Box className="h-7 w-7" />
              </div>
              <div className="font-semibold tracking-tight">Por unidad</div>
              <p className="max-w-[180px] text-[11px] leading-relaxed text-muted-foreground">
                Cada uno tiene un precio fijo. Bebidas, abarrotes, snacks…
              </p>
            </button>
            <button
              onClick={() => {
                setForm((f) => ({ ...f, is_weight: true }))
                setStep('form')
              }}
              className={cn(
                'group flex flex-col items-center justify-center gap-3 rounded-xl px-4 py-8 text-center',
                'border border-border/70 bg-card',
                'transition-[border-color,background-color,transform,box-shadow] duration-200 ease-out-quart',
                'hover:border-primary/40 hover:bg-primary/5 hover:-translate-y-0.5',
                'hover:shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.3)]',
                'active:scale-[0.98]',
              )}
            >
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                <Scale className="h-7 w-7" />
              </div>
              <div className="font-semibold tracking-tight">Por peso (kg)</div>
              <p className="max-w-[180px] text-[11px] leading-relaxed text-muted-foreground">
                Verduras, frutas, fiambres, queso. Se cobra por kilo, al vender se
                ingresa el peso.
              </p>
            </button>
          </div>
        ) : (
        <div className={cn('grid gap-4 sm:grid-cols-2', !isAdmin && 'pointer-events-none opacity-90')}>
          {!isAdmin && (
            <div className="sm:col-span-2 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[12px] text-warning">
              <span className="font-semibold">Solo lectura</span>
              <span>—</span>
              <span>Pedile al administrador que edite este producto.</span>
            </div>
          )}
          <div className="sm:col-span-2 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/8 px-3 py-2 text-xs text-primary">
            {form.is_weight ? <Scale className="h-3.5 w-3.5" /> : <Box className="h-3.5 w-3.5" />}
            <span className="font-medium">
              Tipo: <span className="font-semibold tracking-tight">
                {form.is_weight ? 'Por peso (kg)' : 'Por unidad'}
              </span>
            </span>
            {!product && (
              <button
                type="button"
                onClick={() => setStep('pick_type')}
                className="ml-auto rounded text-primary/80 underline-offset-2 hover:text-primary hover:underline"
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

          <div className="sm:col-span-2 -mb-1 mt-2 text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
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
            <div className="sm:col-span-2 flex items-center justify-between rounded-md border border-border/60 bg-muted/30 p-3">
              <div>
                <div className="text-sm font-medium">
                  {archived ? 'Producto inactivo' : 'Producto activo'}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {archived
                    ? 'Está oculto del POS. Activalo para que vuelva a aparecer al cobrar.'
                    : 'Disponible en el POS para cobrar normalmente.'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!archived}
                onClick={() => setArchived(!archived)}
                className={cn(
                  'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                  archived ? 'bg-muted-foreground/30' : 'bg-success',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                    archived ? 'translate-x-0' : 'translate-x-5',
                  )}
                />
              </button>
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
            {product && isAdmin ? (
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
                {isAdmin ? 'Cancelar' : 'Cerrar'}
              </Button>
              {isAdmin && (
                <Button onClick={save} disabled={saving || confirmDelete}>
                  {saving ? 'Guardando…' : 'Guardar'}
                </Button>
              )}
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
