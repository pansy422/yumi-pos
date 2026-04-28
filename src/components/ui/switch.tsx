import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

/**
 * Switch idéntico al de iOS — track redondo grande, thumb blanco con
 * sombra, transición de 220ms con curva spring. El track cambia de
 * color cuando está activo, no solo del fondo.
 */
export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    className={cn(
      'peer inline-flex h-[26px] w-[46px] shrink-0 cursor-pointer items-center',
      'rounded-full border-2 border-transparent',
      'transition-colors duration-200 ease-out-quart',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:bg-success data-[state=unchecked]:bg-muted-foreground/25',
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block h-[22px] w-[22px] rounded-full bg-white',
        'shadow-[0_1px_1px_0_rgba(0,0,0,0.06),0_2px_4px_-1px_rgba(0,0,0,0.18)]',
        'transition-transform duration-220 ease-spring',
        'data-[state=checked]:translate-x-[20px] data-[state=unchecked]:translate-x-0',
      )}
    />
  </SwitchPrimitive.Root>
))
Switch.displayName = 'Switch'
