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
import { formatCLP } from '@shared/money'
import type { Product } from '@shared/types'

/**
 * Pide el peso (kg, decimal) cuando la cajera intenta agregar un producto
 * vendido al peso. Convierte a gramos al confirmar.
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
  /** Recibe la cantidad en gramos. */
  onConfirm: (grams: number) => void
}) {
  const [text, setText] = React.useState('')

  React.useEffect(() => {
    if (open) setText('')
  }, [open])

  if (!product) return null

  const kg = parseFloat(text.replace(',', '.'))
  const grams = isFinite(kg) && kg > 0 ? Math.round(kg * 1000) : 0
  const total = Math.round((product.price * grams) / 1000)
  const stockKg = (product.stock / 1000).toFixed(3)
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
            <span className="num">{stockKg} kg</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Peso (kg)</Label>
            <Input
              autoFocus
              inputMode="decimal"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="ej. 0.345"
              className="h-12 text-2xl text-center num"
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[0.1, 0.25, 0.5, 1, 1.5, 2].map((kg) => (
                <Button
                  key={kg}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setText(kg.toFixed(3))}
                  className="num text-xs"
                >
                  {kg} kg
                </Button>
              ))}
            </div>
          </div>

          <div
            className={`flex items-center justify-between rounded-md border p-3 ${
              overstock
                ? 'border-warning/40 bg-warning/10'
                : grams > 0
                  ? 'border-success/30 bg-success/5'
                  : 'border-border/40 bg-muted/30'
            }`}
          >
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Total línea
            </div>
            <div className="num text-2xl font-bold">{formatCLP(total)}</div>
          </div>
          {overstock && (
            <p className="text-[11px] text-warning">
              Excede el stock disponible ({stockKg} kg). Puedes vender igual pero el sistema avisa
              al cobrar.
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
