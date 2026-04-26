import { Delete } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'back'] as const
type Key = (typeof KEYS)[number]

/**
 * Pad numérico que opera sobre un string (a diferencia del Numpad
 * monetario, que opera sobre un número). Necesario para PINs porque
 * "0123" como número se convierte en 123 — perderíamos el 0 inicial.
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
        <Button
          key={k}
          type="button"
          variant="outline"
          size="lg"
          onClick={() => press(k)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSubmit) onSubmit()
          }}
          className={cn(
            'h-14 text-xl font-semibold transition-transform active:scale-95',
            k === 'back' && 'text-warning',
          )}
        >
          {k === 'back' ? <Delete className="h-5 w-5" /> : k}
        </Button>
      ))}
    </div>
  )
}
