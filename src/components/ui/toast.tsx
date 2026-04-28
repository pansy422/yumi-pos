import * as React from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { X } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const ToastProvider = ToastPrimitive.Provider

export const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      'fixed bottom-6 right-6 z-[100] flex max-h-screen w-full max-w-sm flex-col gap-3 outline-none',
      className,
    )}
    {...props}
  />
))
ToastViewport.displayName = 'ToastViewport'

/**
 * Toasts tipo iOS — fondo glass, sombras suaves, borde apenas visible.
 * Cada variante usa un acento de color sutil en el borde, NO en el
 * fondo (más legibles para texto largo).
 */
const toastVariants = cva(
  [
    'pointer-events-auto relative flex w-full items-start justify-between gap-3 p-4 pr-10',
    'rounded-xl border bg-card/95 backdrop-blur-md',
    'shadow-[0_8px_24px_-8px_hsl(var(--shadow-color)/0.2),0_2px_8px_-2px_hsl(var(--shadow-color)/0.1)]',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:fade-out-80',
    'data-[state=open]:slide-in-from-bottom-full data-[state=open]:duration-300',
    'data-[swipe=move]:transition-none',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'border-border/70 text-card-foreground',
        success:
          'border-success/35 text-card-foreground [&>div_svg]:text-success [&>div>[data-toast-title]]:text-success',
        warning:
          'border-warning/40 text-card-foreground [&>div_svg]:text-warning [&>div>[data-toast-title]]:text-warning',
        destructive:
          'border-destructive/40 text-card-foreground [&>div_svg]:text-destructive [&>div>[data-toast-title]]:text-destructive',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface ToastProps
  extends React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root>,
    VariantProps<typeof toastVariants> {}

export const Toast = React.forwardRef<React.ElementRef<typeof ToastPrimitive.Root>, ToastProps>(
  ({ className, variant, ...props }, ref) => (
    <ToastPrimitive.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  ),
)
Toast.displayName = 'Toast'

export const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title
    ref={ref}
    data-toast-title
    className={cn('text-sm font-semibold tracking-tight', className)}
    {...props}
  />
))
ToastTitle.displayName = 'ToastTitle'

export const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={cn('mt-0.5 text-xs leading-relaxed text-muted-foreground', className)}
    {...props}
  />
))
ToastDescription.displayName = 'ToastDescription'

export const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    className={cn(
      'absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md text-muted-foreground/70',
      'transition-[background-color,color,transform] duration-150 ease-out-quart',
      'hover:bg-muted hover:text-foreground active:scale-[0.92]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
      className,
    )}
    {...props}
  >
    <X className="h-3.5 w-3.5" />
  </ToastPrimitive.Close>
))
ToastClose.displayName = 'ToastClose'
