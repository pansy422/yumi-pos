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
      'fixed bottom-4 right-4 z-[100] flex max-h-screen w-full max-w-sm flex-col gap-2 outline-none',
      className,
    )}
    {...props}
  />
))
ToastViewport.displayName = 'ToastViewport'

const toastVariants = cva(
  'pointer-events-auto relative flex w-full items-center justify-between gap-3 rounded-md border p-4 pr-8 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-bottom-full',
  {
    variants: {
      variant: {
        default: 'border bg-card text-card-foreground',
        success: 'border-success/40 bg-success/10 text-success',
        warning: 'border-warning/40 bg-warning/10 text-warning',
        destructive: 'border-destructive/40 bg-destructive/10 text-destructive',
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
    <ToastPrimitive.Root ref={ref} className={cn(toastVariants({ variant }), className)} {...props} />
  ),
)
Toast.displayName = 'Toast'

export const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title ref={ref} className={cn('text-sm font-semibold', className)} {...props} />
))
ToastTitle.displayName = 'ToastTitle'

export const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description ref={ref} className={cn('text-xs opacity-90', className)} {...props} />
))
ToastDescription.displayName = 'ToastDescription'

export const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    className={cn('absolute right-2 top-2 rounded-md p-1 opacity-60 hover:opacity-100', className)}
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitive.Close>
))
ToastClose.displayName = 'ToastClose'
