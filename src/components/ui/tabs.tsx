import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

export const Tabs = TabsPrimitive.Root

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      // Background segmentado tipo iOS — borde sutil + fondo levemente
      // hundido. El item activo usa shadow para "elevarse" sobre el bg.
      'inline-flex h-10 items-center justify-center gap-1 rounded-lg',
      'border border-border/60 bg-muted/60 p-1 text-muted-foreground',
      className,
    )}
    {...props}
  />
))
TabsList.displayName = 'TabsList'

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center gap-1.5 whitespace-nowrap',
      'rounded-md px-3 py-1.5 text-sm font-medium tracking-tight',
      'transition-[background-color,color,box-shadow] duration-200 ease-out-quart',
      'hover:text-foreground/80',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
      'disabled:pointer-events-none disabled:opacity-50',
      // Active: card con sombra sutil — sensación de "pestaña encima".
      'data-[state=active]:bg-card data-[state=active]:text-foreground',
      'data-[state=active]:shadow-[0_1px_2px_0_hsl(var(--shadow-color)/0.06),0_2px_8px_-2px_hsl(var(--shadow-color)/0.08)]',
      className,
    )}
    {...props}
  />
))
TabsTrigger.displayName = 'TabsTrigger'

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-4 animate-fade-in-soft focus-visible:outline-none',
      className,
    )}
    {...props}
  />
))
TabsContent.displayName = 'TabsContent'
