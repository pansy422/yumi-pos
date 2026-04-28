import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  [
    'inline-flex items-center gap-1 rounded-md border px-2 py-0.5',
    'text-[11px] font-medium leading-tight tracking-tight',
    'transition-colors',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'border-primary/15 bg-primary/10 text-primary',
        secondary: 'border-border/60 bg-secondary text-secondary-foreground',
        success: 'border-success/20 bg-success/10 text-success',
        warning: 'border-warning/25 bg-warning/12 text-warning',
        destructive: 'border-destructive/20 bg-destructive/10 text-destructive',
        outline: 'text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
