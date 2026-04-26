import * as React from 'react'
import { Input } from '@/components/ui/input'
import { formatCLP, parseCLP } from '@shared/money'
import { cn } from '@/lib/utils'

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number
  onValueChange: (n: number) => void
}

export const MoneyInput = React.forwardRef<HTMLInputElement, Props>(
  ({ value, onValueChange, className, ...rest }, ref) => {
    const [text, setText] = React.useState(value ? formatCLP(value) : '')
    React.useEffect(() => {
      setText(value ? formatCLP(value) : '')
    }, [value])
    return (
      <Input
        ref={ref}
        inputMode="numeric"
        className={cn('num text-right', className)}
        value={text}
        onChange={(e) => {
          const n = parseCLP(e.target.value)
          setText(n ? formatCLP(n) : e.target.value.replace(/[^\d]/g, ''))
          onValueChange(n)
        }}
        onFocus={(e) => e.target.select()}
        {...rest}
      />
    )
  },
)
MoneyInput.displayName = 'MoneyInput'
