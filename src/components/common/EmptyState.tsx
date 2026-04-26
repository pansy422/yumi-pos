import * as React from 'react'
import { cn } from '@/lib/utils'

export function EmptyState({
  illustration,
  title,
  description,
  action,
  className,
}: {
  illustration?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-8 py-16 text-center animate-fade-in',
        className,
      )}
    >
      {illustration && (
        <div className="relative mb-2 text-muted-foreground/60">
          <div className="absolute inset-0 -z-10 mx-auto h-24 w-24 rounded-full bg-brand-1/15 blur-2xl" />
          {illustration}
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function CartEmptyArt() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="animate-float">
      <defs>
        <linearGradient id="cea-g" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="hsl(168, 75%, 52%)" stopOpacity="0.9" />
          <stop offset="1" stopColor="hsl(260, 85%, 65%)" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <rect x="20" y="34" width="80" height="58" rx="10" fill="url(#cea-g)" opacity="0.18" />
      <rect
        x="20"
        y="34"
        width="80"
        height="58"
        rx="10"
        stroke="url(#cea-g)"
        strokeWidth="2"
        strokeDasharray="4 6"
      />
      <path
        d="M34 50 H86 M34 62 H72 M34 74 H80"
        stroke="hsl(168, 75%, 52%)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.6"
      />
      <circle cx="92" cy="32" r="14" fill="hsl(168, 75%, 52%)" opacity="0.18" />
      <circle cx="92" cy="32" r="10" fill="hsl(168, 75%, 52%)" opacity="0.4" />
      <circle cx="92" cy="32" r="5" fill="hsl(168, 75%, 52%)" />
    </svg>
  )
}

export function BoxEmptyArt() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="animate-float">
      <defs>
        <linearGradient id="bea-g" x1="0" y1="0" x2="0" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="hsl(168, 75%, 52%)" stopOpacity="0.5" />
          <stop offset="1" stopColor="hsl(260, 85%, 65%)" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <path d="M20 42 L60 24 L100 42 L60 60 Z" fill="url(#bea-g)" stroke="hsl(168, 75%, 52%)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M20 42 V92 L60 110 V60 Z" fill="hsl(224, 35%, 14%)" stroke="hsl(168, 75%, 52%)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M100 42 V92 L60 110 V60 Z" fill="hsl(224, 35%, 11%)" stroke="hsl(168, 75%, 52%)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M20 42 L60 60 L100 42" stroke="hsl(168, 75%, 52%)" strokeWidth="2" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

export function ChartEmptyArt() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="animate-float">
      <defs>
        <linearGradient id="che-g" x1="0" y1="0" x2="120" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="hsl(168, 75%, 52%)" />
          <stop offset="1" stopColor="hsl(260, 85%, 65%)" />
        </linearGradient>
      </defs>
      <rect x="14" y="80" width="14" height="20" rx="3" fill="url(#che-g)" opacity="0.4" />
      <rect x="38" y="60" width="14" height="40" rx="3" fill="url(#che-g)" opacity="0.6" />
      <rect x="62" y="40" width="14" height="60" rx="3" fill="url(#che-g)" opacity="0.8" />
      <rect x="86" y="20" width="14" height="80" rx="3" fill="url(#che-g)" />
      <path
        d="M14 78 Q40 60 62 50 T100 22"
        stroke="hsl(168, 75%, 52%)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
    </svg>
  )
}
