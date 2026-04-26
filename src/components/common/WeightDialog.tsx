import * as React from 'react'
import { Scale } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCLP, formatWeight } from '@shared/money'
import { cn } from '@/lib/utils'
import type { Product } from '@shared/types'

type Unit = 'kg' | 'g'

/**
 * Pide el peso al agregar al carrito un producto vendido por peso. Acepta
 * input en kilos o gramos (toggle), pero internamente siempre devuelve
 * gramos enteros — esa es la unidad canónica de la app.
 */
export function WeightDialog({
  open,
  onOpenChange,
  product,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  product: Product | null
  onConfirm: (grams: number) => void
}) {
  const [unit, setUnit] = React.useState<Unit>('kg')
  const [text, setText] = React.useState('')

  React.useEffect(() => {
    if (open) {
      setText('')
      setUnit('kg')
    }
  }, [open])

  if (!product) return null

  const parsed = parseFloat(text.replace(',', '.'))
  const grams =
    isFinite(parsed) && parsed > 0 ? Math.round(unit === 'kg' ? parsed * 1000 : parsed) : 0
  const total = Math.round((product.price * grams) / 1000)
  const overstock = grams > product.stock

  const submit = () => {
    if (grams <= 0) return
    onConfirm(grams)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" /> {product.name}
          </DialogTitle>
          <DialogDescription>
            <span className="num">{formatCLP(product.price)}</span> por kg · stock disponible{' '}
            <span className="num">{formatWeight(product.stock)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Peso</Label>
              <div className="flex overflow-hidden rounded-md border border-border">
                {(['kg', 'g'] as Unit[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={cn(
                      'px-3 py-1 text-xs font-medium transition-colors',
                      unit === u
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <Input
              autoFocus
              inputMode="decimal"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={unit === 'kg' ? 'ej. 0.345' : 'ej. 345'}
              className="h-12 text-2xl text-center num"
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(unit === 'kg'
                ? [0.1, 0.25, 0.5, 1, 1.5, 2]
                : [50, 100, 250, 500, 750]
              ).map((v) => (
                <Button
                  key={v}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setText(unit === 'kg' ? v.toFixed(3) : String(v))}
                  className="num text-xs"
                >
                  {v} {unit}
                </Button>
              ))}
            </div>
          </div>

          <div
            className={cn(
              'flex items-center justify-between rounded-md border p-3',
              overstock
                ? 'border-warning/40 bg-warning/10'
                : grams > 0
                  ? 'border-success/30 bg-success/5'
                  : 'border-border/40 bg-muted/30',
            )}
          >
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Total línea
              </div>
              {grams > 0 && (
                <div className="text-[11px] text-muted-foreground">
                  {formatWeight(grams)} × {formatCLP(product.price)}/kg
                </div>
              )}
            </div>
            <div className="num text-2xl font-bold">{formatCLP(total)}</div>
          </div>
          {overstock && (
            <p className="text-[11px] text-warning">
              Excede el stock disponible ({formatWeight(product.stock)}). Puedes vender igual; el
              stock quedará en negativo.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border/40 pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={grams <= 0}>
            Agregar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
