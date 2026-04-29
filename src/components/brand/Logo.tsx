import { cn } from '@/lib/utils'

export function Wordmark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'select-none font-display text-[18px] font-bold uppercase leading-none tracking-[0.18em]',
        className,
      )}
    >
      YUMI <span className="iridescent-text">POS</span>
    </div>
  )
}
