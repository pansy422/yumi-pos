import { Delete } from 'lucide-react'
import { cn } from '@/lib/utils'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'back'] as const
type Key = (typeof KEYS)[number]

/**
 * Numpad monetario — opera sobre un número (a diferencia del PinPad
 * que opera sobre string). Estética tipo iOS: bordes sutiles, scale al
 * apretar, transición de color suave.
 */
export function Numpad({
  value,
  onChange,
  className,
}: {
  value: number
  onChange: (n: number) => void
  className?: string
}) {
  const press = (k: Key) => {
    if (k === 'back') {
      const next = Math.floor(value / 10)
      onChange(next)
      return
    }
    const digits = String(value === 0 ? '' : value) + k
    const next = Number(digits.slice(0, 12)) || 0
    onChange(next)
  }

  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => press(k)}
          className={cn(
            'h-14 rounded-lg border border-border/70 bg-card',
            'text-xl font-semibold tracking-tight num',
            'transition-[background-color,border-color,transform,box-shadow] duration-150 ease-out-quart',
            'hover:bg-accent hover:border-border',
            'active:scale-[0.95] active:bg-accent/80',
            'focus-visible:outline-none focus-visible:border-ring focus-visible:shadow-[0_0_0_3px_hsl(var(--ring)/0.2)]',
            k === 'back' && 'text-warning',
          )}
        >
          {k === 'back' ? <Delete className="mx-auto h-5 w-5" /> : k}
        </button>
      ))}
    </div>
  )
}
