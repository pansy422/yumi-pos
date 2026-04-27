import * as React from 'react'
import { ChevronDown, Tag } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Category } from '@shared/types'

export function CategoryCombobox({
  value,
  onChange,
  placeholder = 'ej. Bebidas, Lácteos…',
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [items, setItems] = React.useState<Category[]>([])
  const wrapRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    api.categoriesCrud().then(setItems)
  }, [])

  React.useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open])

  const filtered = React.useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return items
    return items.filter((c) => c.name.toLowerCase().includes(q))
  }, [items, value])

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <div className="relative">
        <Tag className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-9 pr-8"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent"
        >
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
          />
        </button>
      </div>
      {open && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {value.trim() ? 'Se creará la categoría al guardar' : 'Sin categorías todavía'}
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {filtered.map((c) => (
                <li
                  key={c.name}
                  onClick={() => {
                    onChange(c.name)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex cursor-pointer items-center justify-between px-3 py-1.5 text-sm transition-colors hover:bg-accent',
                    value === c.name && 'bg-primary/10 text-primary',
                  )}
                >
                  <span className="flex items-center gap-2">
                    {c.color && (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: c.color }}
                      />
                    )}
                    {c.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {c.product_count} producto{c.product_count === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
