import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-muted/40',
        'after:absolute after:inset-0 after:bg-shimmer-gradient after:bg-[length:200%_100%] after:animate-shimmer',
        className,
      )}
    />
  )
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-4 px-4 py-3', className)}>
      <Skeleton className="h-9 w-9 rounded-full" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-20" />
    </div>
  )
}

export function SkeletonStat() {
  return (
    <div className="rounded-lg border bg-card p-4">
      <Skeleton className="mb-2 h-3 w-24" />
      <Skeleton className="h-8 w-32" />
    </div>
  )
}
