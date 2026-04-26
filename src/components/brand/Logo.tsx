import { cn } from '@/lib/utils'

export function Wordmark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'select-none font-display text-[18px] font-semibold leading-none tracking-tight',
        className,
      )}
    >
      Yumi <span className="brand-text">POS</span>
    </div>
  )
}
