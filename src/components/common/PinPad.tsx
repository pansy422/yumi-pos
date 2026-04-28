import { Delete } from 'lucide-react'
import { cn } from '@/lib/utils'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'back'] as const
type Key = (typeof KEYS)[number]

/**
 * Pad numérico que opera sobre un string (a diferencia del Numpad
 * monetario, que opera sobre un número). Necesario para PINs porque
 * "0123" como número se convierte en 123 — perderíamos el 0 inicial.
 *
 * Estética tipo iOS: botones grandes con tipografía display, scale al
 * apretar, hover suave, transición de color al borde del foco.
 */
export function PinPad({
  value,
  onChange,
  onSubmit,
  className,
}: {
  value: string
  onChange: (s: string) => void
  onSubmit?: () => void
  className?: string
}) {
  const press = (k: Key) => {
    if (k === 'back') {
      onChange(value.slice(0, -1))
      return
    }
    onChange((value + k).slice(0, 12))
  }

  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => press(k)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSubmit) onSubmit()
          }}
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
