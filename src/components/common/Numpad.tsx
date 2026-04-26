import { Delete } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'back'] as const
type Key = (typeof KEYS)[number]

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
        <Button
          key={k}
          type="button"
          variant="outline"
          size="lg"
          onClick={() => press(k)}
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
