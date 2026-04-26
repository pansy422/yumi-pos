import * as React from 'react'
import { Edit3, Plus, Search, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { useQuickKeys, QUICK_KEY_COLORS, type QuickKey } from '@/stores/quickKeys'
import { formatCLP } from '@shared/money'
import { cn } from '@/lib/utils'
import type { Product } from '@shared/types'

export function QuickKeysPanel({
  onPick,
}: {
  onPick: (product: Product) => void
}) {
  const keys = useQuickKeys((s) => s.keys)
  const slotCount = useQuickKeys((s) => s.count)
  const setKey = useQuickKeys((s) => s.set)
  const unsetKey = useQuickKeys((s) => s.unset)
  const [editing, setEditing] = React.useState(false)
  const [pickerSlot, setPickerSlot] = React.useState<number | null>(null)

  const slots = React.useMemo(() => {
    const map = new Map<number, QuickKey>()
    for (const k of keys) map.set(k.slot, k)
    return Array.from({ length: slotCount }, (_, i) => map.get(i) ?? null)
  }, [keys, slotCount])

  const handleClick = async (slot: number, current: QuickKey | null) => {
    if (editing) {
      setPickerSlot(slot)
      return
    }
    if (!current) {
      setPickerSlot(slot)
      return
    }
    const fresh = await api.productsGet(current.product_id)
    if (!fresh) {
      // product was deleted; clear slot
      unsetKey(slot)
      return
    }
    onPick(fresh)
  }

  return (
    <Card className="card-elev">
      <CardContent className="p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Zap className="h-3 w-3 text-primary" />
            Acceso rápido
          </div>
          <button
            onClick={() => setEditing((v) => !v)}
            className={cn(
              'flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] transition-colors',
              editing ? 'bg-warning/15 text-warning' : 'text-muted-foreground hover:bg-accent',
            )}
          >
            <Edit3 className="h-3 w-3" />
            {editing ? 'Listo' : 'Editar'}
          </button>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {slots.map((k, i) => (
            <SlotButton
              key={i}
              slot={i}
              data={k}
              editing={editing}
              onClick={() => handleClick(i, k)}
              onRemove={() => unsetKey(i)}
            />
          ))}
        </div>
      </CardContent>
      <ProductPicker
        open={pickerSlot != null}
        onOpenChange={(v) => !v && setPickerSlot(null)}
        slotIndex={pickerSlot ?? 0}
        existing={pickerSlot != null ? slots[pickerSlot] : null}
        onPicked={(p, color) => {
          if (pickerSlot != null) setKey(pickerSlot, p, color)
          setPickerSlot(null)
        }}
        onCleared={() => {
          if (pickerSlot != null) unsetKey(pickerSlot)
          setPickerSlot(null)
        }}
      />
    </Card>
  )
}

function SlotButton({
  data,
  editing,
  onClick,
  onRemove,
}: {
  slot: number
  data: QuickKey | null
  editing: boolean
  onClick: () => void
  onRemove: () => void
}) {
  if (!data) {
    return (
      <button
        onClick={onClick}
        className="group relative flex aspect-[4/3] items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/20 text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
      >
        <Plus className="h-5 w-5 opacity-50 group-hover:opacity-100" />
      </button>
    )
  }
  const color = data.color ?? QUICK_KEY_COLORS[0]
  return (
    <div className="relative">
      <button
        onClick={onClick}
        className="group relative flex aspect-[4/3] w-full flex-col items-center justify-center overflow-hidden rounded-md border border-border/40 px-2 py-1.5 text-center transition-all hover:scale-[1.02] active:scale-95"
        style={{
          background: `linear-gradient(140deg, ${color}26 0%, ${color}10 100%)`,
          borderColor: `${color}50`,
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-0.5"
          style={{ background: color }}
          aria-hidden
        />
        <div className="line-clamp-2 text-[12px] font-semibold leading-tight">{data.name}</div>
        <div className="num mt-1 text-[11px] text-muted-foreground">{formatCLP(data.price)}</div>
      </button>
      {editing && (
        <button
          onClick={onRemove}
          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-md hover:scale-110"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

function ProductPicker({
  open,
  onOpenChange,
  existing,
  onPicked,
  onCleared,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  slotIndex: number
  existing: QuickKey | null
  onPicked: (product: Product, color: string) => void
  onCleared: () => void
}) {
  const [search, setSearch] = React.useState('')
  const [results, setResults] = React.useState<Product[]>([])
  const [picked, setPicked] = React.useState<Product | null>(null)
  const [color, setColor] = React.useState<string>(QUICK_KEY_COLORS[0])

  React.useEffect(() => {
    if (open) {
      setSearch('')
      setPicked(null)
      setColor(existing?.color ?? QUICK_KEY_COLORS[0])
    }
  }, [open, existing])

  React.useEffect(() => {
    if (!open) return
    const t = setTimeout(async () => {
      const list = await api.productsList({ search })
      setResults(list)
    }, 120)
    return () => clearTimeout(t)
  }, [search, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Asignar producto al acceso rápido</DialogTitle>
          <DialogDescription>
            Útil para productos sin código de barras (pan, fruta suelta, cigarros sueltos…).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="pl-9"
              placeholder="Buscar producto…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-64 overflow-auto rounded-md border border-border/40">
            {results.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {search ? 'Sin resultados' : 'Empieza a buscar'}
              </p>
            ) : (
              <ul className="divide-y divide-border/40">
                {results.map((p) => (
                  <li
                    key={p.id}
                    onClick={() => setPicked(p)}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm transition-colors hover:bg-accent/50',
                      picked?.id === p.id && 'bg-primary/10',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.name}</div>
                      <div className="mono text-[11px] text-muted-foreground">
                        {p.barcode ?? 'sin código'}
                      </div>
                    </div>
                    <div className="num shrink-0 font-semibold">{formatCLP(p.price)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Color</Label>
            <div className="flex gap-1.5">
              {QUICK_KEY_COLORS.map((c) => (
                <button
                  key={c}
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
        </div>
        <div className="flex items-center justify-between border-t border-border/40 pt-3">
          {existing ? (
            <Button variant="ghost" onClick={onCleared} className="text-destructive">
              Quitar del acceso rápido
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!picked}
              onClick={() => {
                if (picked) onPicked(picked, color)
              }}
            >
              Asignar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
