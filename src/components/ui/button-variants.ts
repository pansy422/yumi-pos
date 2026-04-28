import { cva } from 'class-variance-authority'

/**
 * Button variants — inspirados en HIG de Apple. Lo clave:
 *  - Transición de TODAS las propiedades (no solo color) para que el hover
 *    se sienta orgánico
 *  - Scale 0.97 al apretar (active:scale-[0.97]) — feedback táctil sutil
 *  - Focus ring de 2px con offset, color de marca, fade suave
 *  - Sombra interna solo en variants con fondo (default/destructive/etc.)
 *    para sentir profundidad
 */
export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap select-none',
    'rounded-md text-sm font-medium tracking-tight',
    'transition-[transform,box-shadow,background-color,color,border-color] duration-200 ease-out-quart',
    'active:scale-[0.97] active:transition-transform active:duration-75',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100',
    '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-transform',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-btn-primary hover:bg-primary/92 hover:shadow-[0_2px_4px_0_hsl(168_75%_25%/0.35),0_8px_20px_-6px_hsl(168_75%_25%/0.35)]',
        destructive:
          'bg-destructive text-destructive-foreground shadow-[0_1px_2px_0_hsl(0_60%_30%/0.3),0_4px_12px_-4px_hsl(0_60%_30%/0.25)] hover:bg-destructive/92',
        outline:
          'border border-input bg-card hover:bg-accent hover:text-accent-foreground hover:border-border',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost:
          'hover:bg-accent hover:text-accent-foreground',
        success:
          'bg-success text-success-foreground shadow-[0_1px_2px_0_hsl(152_60%_20%/0.3),0_4px_12px_-4px_hsl(152_60%_20%/0.25)] hover:bg-success/92',
        warning:
          'bg-warning text-warning-foreground shadow-[0_1px_2px_0_hsl(32_92%_25%/0.3),0_4px_12px_-4px_hsl(32_92%_25%/0.25)] hover:bg-warning/92',
        link:
          'text-primary underline-offset-4 hover:underline active:scale-100',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6 text-base',
        xl: 'h-14 px-8 text-lg',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)
