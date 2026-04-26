import { cn } from '@/lib/utils'

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md border border-border/80 bg-muted/60 px-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-foreground shadow-[inset_0_-1px_0_0_hsl(0_0%_0%/0.4)]',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
