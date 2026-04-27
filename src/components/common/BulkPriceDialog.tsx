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
  const [submitting, setSubmitting] = React.useState(false)
  const [confirming, setConfirming] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setPercent(10)
      setField('price')
      setConfirming(false)
    }
  }, [open])

  const apply = async () => {
    if (Math.abs(percent) < 0.01) return
    setSubmitting(true)
    try {
      const r = await api.productsBulkPrice({
        category:
          filter.kind === 'category' ? filter.category : undefined,
        percent,
        field,
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
              Ejemplo: $1.000 →{' '}
              <span className="num font-semibold">{formatCLP(1000 * factor)}</span>
              {' · '}
              $2.500 →{' '}
              <span className="num font-semibold">{formatCLP(2500 * factor)}</span>
              {' · '}
              $5.000 →{' '}
              <span className="num font-semibold">{formatCLP(5000 * factor)}</span>
            </p>
          </div>
        </div>

        {confirming && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
            <div className="font-medium text-warning">¿Confirmas el cambio?</div>
            <p className="mt-1 text-[12px] text-foreground">
              Vas a aplicar <span className="num font-semibold">{percent > 0 ? '+' : ''}{percent}%</span>{' '}
              al {field === 'price' ? 'precio' : 'costo'} de{' '}
              <span className="font-semibold">{filter.label}</span>. Esta acción afecta a todos los
              productos a la vez y no se puede deshacer automáticamente.
            </p>
          </div>
        )}

        <DialogFooter>
          {confirming ? (
            <>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={submitting}>
                Volver
              </Button>
              <Button
                onClick={apply}
                disabled={submitting}
                variant={sign ? 'default' : 'warning'}
              >
                {submitting ? 'Aplicando…' : 'Sí, aplicar ahora'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button
                onClick={() => setConfirming(true)}
                disabled={submitting || Math.abs(percent) < 0.01}
                variant={sign ? 'default' : 'warning'}
              >
                {`Aplicar ${percent > 0 ? '+' : ''}${percent}% a ${filter.label}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
