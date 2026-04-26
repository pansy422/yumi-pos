import { cn } from '@/lib/utils'

export function Logo({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-label="Yumi POS"
    >
      <defs>
        <linearGradient id="ylg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="hsl(168, 75%, 52%)" />
          <stop offset="1" stopColor="hsl(260, 85%, 65%)" />
        </linearGradient>
        <filter id="ygl" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="12" fill="url(#ylg)" />
      <rect
        x="2"
        y="2"
        width="44"
        height="44"
        rx="12"
        fill="url(#ylg)"
        opacity="0.5"
        filter="url(#ygl)"
      />
      <path
        d="M14 14 L24 26 L34 14 M24 26 L24 36"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <Logo size={32} />
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight">
          Yumi <span className="brand-text">POS</span>
        </div>
        <div className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
          offline
        </div>
      </div>
    </div>
  )
}
