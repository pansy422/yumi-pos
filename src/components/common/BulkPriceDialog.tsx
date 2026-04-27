import * as React from 'react'
import { Percent, TrendingDown, TrendingUp } from 'lucide-react'
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

type Filter =
  | { kind: 'category'; category: string | null; label: string }
  | { kind: 'all'; label: string }

export function BulkPriceDialog({
  open,
  onOpenChange,
  filter,
  onApplied,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  filter: Filter
  onApplied: () => void
}) {
  const { toast } = useToast()
  const [percent, setPercent] = React.useState<number>(10)
  const [field, setField] = React.useState<'price' | 'cost'>('price')
  const [rounding, setRounding] = React.useState<'none' | 'nearest_10' | 'nearest_100'>(
    'nearest_10',
  )
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setPercent(10)
      setField('price')
      setRounding('nearest_10')
    }
  }, [open])

  const apply = async () => {
    if (Math.abs(percent) < 0.01) return
    const sure = confirm(
      `¿Aplicar ${percent > 0 ? '+' : ''}${percent}% al ${field === 'price' ? 'precio' : 'costo'} de ${filter.label}? Esta acción afecta a todos los productos seleccionados a la vez.`,
    )
    if (!sure) return
    setSubmitting(true)
    try {
      const r = await api.productsBulkPrice({
        category:
          filter.kind === 'category' ? filter.category : undefined,
        percent,
        field,
        rounding,
      })
      const delta = r.newTotal - r.oldTotal
      toast({
        variant: 'success',
        title: `${r.updated} producto${r.updated === 1 ? '' : 's'} actualizado${r.updated === 1 ? '' : 's'}`,
        description: `${field === 'price' ? 'Precios' : 'Costos'} ${delta >= 0 ? 'subieron' : 'bajaron'} ${formatCLP(Math.abs(delta))} en total.`,
        duration: 6000,
      })
      onApplied()
      onOpenChange(false)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'No se pudo aplicar',
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSubmitting(false)
    }
  }

  const sign = percent >= 0
  const factor = 1 + percent / 100

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-primary" />
            Cambiar precios masivamente
          </DialogTitle>
          <DialogDescription>
            Aplica un porcentaje a todos los productos de{' '}
            <span className="font-semibold text-foreground">{filter.label}</span>. Los productos
            archivados no se afectan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Aplicar a</Label>
              <Select value={field} onValueChange={(v) => setField(v as 'price' | 'cost')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price">Precio venta</SelectItem>
                  <SelectItem value="cost">Costo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Redondeo</Label>
              <Select
                value={rounding}
                onValueChange={(v) => setRounding(v as typeof rounding)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Exacto (al peso)</SelectItem>
                  <SelectItem value="nearest_10">A los $10</SelectItem>
                  <SelectItem value="nearest_100">A los $100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div
            className={cn(
              'rounded-md border p-3',
              sign
                ? 'border-success/30 bg-success/10'
                : 'border-warning/30 bg-warning/10',
            )}
          >
            <Label className="flex items-center gap-2 text-xs">
              {sign ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              Porcentaje
            </Label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                type="number"
                value={percent}
                onChange={(e) => setPercent(Number(e.target.value) || 0)}
                className="h-12 num text-2xl font-bold"
              />
              <span className="text-2xl font-bold">%</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {[-20, -10, -5, 5, 10, 20, 30, 50].map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={percent === p ? 'secondary' : 'outline'}
                  type="button"
                  onClick={() => setPercent(p)}
                  className="num text-xs"
                >
                  {p > 0 ? '+' : ''}
                  {p}%
                </Button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Ejemplo: un producto de $1.000 quedará en{' '}
              <span className="num font-semibold">
                {formatCLP(
                  rounding === 'nearest_100'
                    ? Math.round((1000 * factor) / 100) * 100
                    : rounding === 'nearest_10'
                      ? Math.round((1000 * factor) / 10) * 10
                      : Math.round(1000 * factor),
                )}
              </span>
              .
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={apply}
            disabled={submitting || Math.abs(percent) < 0.01}
            variant={sign ? 'default' : 'warning'}
          >
            {submitting
              ? 'Aplicando…'
              : `Aplicar ${percent > 0 ? '+' : ''}${percent}% a ${filter.label}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
