import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        // Base — bg ligeramente distinto al card para diferenciar campo
        // editable de superficie estática.
        'flex h-10 w-full rounded-md border border-input bg-background',
        'px-3 py-2 text-sm',
        'placeholder:text-muted-foreground/70',
        // Transición de borde y sombra al focus, no de color (evita
        // el "salto" típico de Tailwind cuando aplica varias propiedades).
        'transition-[border-color,box-shadow] duration-200 ease-out-quart',
        // Focus visible: borde de marca + anillo interno de 2px con
        // tinte de ring (replica el look macOS).
        'focus-visible:outline-none focus-visible:border-ring',
        'focus-visible:shadow-[0_0_0_3px_hsl(var(--ring)/0.2)]',
        // Hover sutil del borde.
        'hover:border-ring/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        // File input con look limpio.
        'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
