import * as React from 'react'
import { Plus, Tag, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import { MoneyInput } from '@/components/common/MoneyInput'
import { CategoryCombobox } from '@/components/common/CategoryCombobox'
import { useToast } from '@/hooks/useToast'
import { api } from '@/lib/api'
import type { Product, Promotion, PromotionInput, PromotionKind } from '@shared/types'

const KIND_LABEL: Record<PromotionKind, string> = {
  percent_off_category: '% sobre categoría',
  percent_off_product: '% sobre un producto',
  percent_off_total: '% sobre el total del ticket',
}

export function PromotionsTab() {
  const { toast } = useToast()
  const [items, setItems] = React.useState<Promotion[]>([])
  const [edit, setEdit] = React.useState<Promotion | null>(null)
  const [creating, setCreating] = React.useState(false)

  const load = async () => setItems(await api.promotionsList(true))
  React.useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-3">
      <Card className="card-elev">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Tag className="h-4 w-4 text-primary" />
            Las promociones activas se aplican automáticamente al carrito y aparecen como
            descuentos en la boleta.
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nueva promoción
          </Button>
        </CardContent>
      </Card>

      <Card className="card-elev">
        <CardContent className="p-0">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aún no tienes promociones. Crea una para empezar.
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
              {items.map((p) => (
                <li
                  key={p.id}
                  className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/30"
                  onClick={() => setEdit(p)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      {p.active ? (
                        <Badge variant="success">Activa</Badge>
                      ) : (
                        <Badge variant="secondary">Pausada</Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {KIND_LABEL[p.kind]}
                      {p.target ? ` · ${p.target}` : ''} · {p.params.percent ?? 0}%
                      {p.params.min_amount
                        ? ` · mínimo $${p.params.min_amount.toLocaleString('es-CL')}`
                        : ''}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`Eliminar promoción "${p.name}"?`)) {
                        api.promotionsDelete(p.id).then(load)
                      }
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

      <PromoEditor
        open={creating || !!edit}
        onOpenChange={(v) => {
          if (!v) {
            setCreating(false)
            setEdit(null)
          }
        }}
        promo={edit}
        onSaved={async () => {
          setCreating(false)
          setEdit(null)
          await load()
          toast({ variant: 'success', title: 'Promoción guardada' })
        }}
      />
    </div>
  )
}

function PromoEditor({
  open,
  onOpenChange,
  promo,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  promo: Promotion | null
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = React.useState('')
  const [kind, setKind] = React.useState<PromotionKind>('percent_off_total')
  const [target, setTarget] = React.useState<string>('')
  const [percent, setPercent] = React.useState<number>(10)
  const [minAmount, setMinAmount] = React.useState<number>(0)
  const [active, setActive] = React.useState(true)
  const [products, setProducts] = React.useState<Product[]>([])
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    if (promo) {
      setName(promo.name)
      setKind(promo.kind)
      setTarget(promo.target ?? '')
      setPercent(Number(promo.params.percent ?? 10))
      setMinAmount(Number(promo.params.min_amount ?? 0))
      setActive(promo.active === 1)
    } else {
      setName('')
      setKind('percent_off_total')
      setTarget('')
      setPercent(10)
      setMinAmount(0)
      setActive(true)
    }
    api.productsList({}).then(setProducts)
  }, [open, promo])

  const submit = async () => {
    if (!name.trim()) {
      toast({ variant: 'warning', title: 'Falta el nombre' })
      return
    }
    if (kind !== 'percent_off_total' && !target.trim()) {
      toast({ variant: 'warning', title: 'Falta seleccionar a qué aplica' })
      return
    }
    setSaving(true)
    try {
      const input: PromotionInput = {
        id: promo?.id,
        name: name.trim(),
        kind,
        target: kind === 'percent_off_total' ? null : target.trim(),
        params: {
          percent: Math.max(0, Math.min(100, Math.round(percent))),
          min_amount: kind === 'percent_off_total' ? Math.max(0, Math.round(minAmount)) : undefined,
        },
        active,
      }
      await api.promotionsSave(input)
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{promo ? 'Editar promoción' : 'Nueva promoción'}</DialogTitle>
          <DialogDescription>
            Las promociones se aplican automáticamente cada vez que el carrito cumple la
            condición.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nombre *</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Descuento bebidas"
            />
          </div>
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select
              value={kind}
              onValueChange={(v) => {
                setKind(v as PromotionKind)
                // Reset target — si era percent_off_product el target era
                // un product_id, y al cambiar a percent_off_category el
                // CategoryCombobox lo mostraría como categoría inválida.
                setTarget('')
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_LABEL) as PromotionKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {kind === 'percent_off_category' && (
            <div className="space-y-1">
              <Label>Categoría afectada</Label>
              <CategoryCombobox value={target} onChange={setTarget} />
            </div>
          )}
          {kind === 'percent_off_product' && (
            <div className="space-y-1">
              <Label>Producto afectado</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona producto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Porcentaje (0-100)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={percent}
                onChange={(e) => setPercent(Number(e.target.value) || 0)}
              />
            </div>
            {kind === 'percent_off_total' && (
              <div className="space-y-1">
                <Label>Mínimo del ticket</Label>
                <MoneyInput value={minAmount} onValueChange={setMinAmount} />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-md border border-border/40 bg-muted/30 px-3 py-2">
            <Label className="text-sm text-foreground">Promoción activa</Label>
            <Switch checked={active} onCheckedChange={setActive} />
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
