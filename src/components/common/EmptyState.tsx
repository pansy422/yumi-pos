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
        'flex flex-col items-center justify-center gap-4 px-8 py-20 text-center animate-fade-in',
        className,
      )}
    >
      {illustration && (
        <div className="relative mb-3 text-muted-foreground/60">
          <div className="absolute inset-0 -z-10 mx-auto h-32 w-32 rounded-full bg-brand-1/10 blur-3xl" />
          {illustration}
        </div>
      )}
      <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      {description && (
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function CartEmptyArt() {
  return (
    <svg width="128" height="128" viewBox="0 0 128 128" fill="none" className="animate-float">
      <defs>
        <linearGradient id="cea-g" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="hsl(168, 75%, 52%)" stopOpacity="0.95" />
          <stop offset="1" stopColor="hsl(260, 85%, 65%)" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="cea-fill" x1="0" y1="0" x2="0" y2="100%" gradientUnits="objectBoundingBox">
          <stop offset="0" stopColor="hsl(168, 75%, 52%)" stopOpacity="0.12" />
          <stop offset="1" stopColor="hsl(260, 85%, 65%)" stopOpacity="0.06" />
        </linearGradient>
      </defs>
      {/* Recibo "papel" con corte irregular abajo */}
      <path
        d="M28 26 H100 V96 L92 90 L84 96 L76 90 L68 96 L60 90 L52 96 L44 90 L36 96 L28 90 Z"
        fill="url(#cea-fill)"
        stroke="url(#cea-g)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Líneas de "items" con distintas longitudes */}
      <path
        d="M40 42 H88"
        stroke="hsl(168, 75%, 52%)"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M40 54 H78 M40 66 H82"
        stroke="hsl(168, 75%, 52%)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.45"
      />
      {/* Línea total */}
      <path
        d="M40 78 H88"
        stroke="hsl(260, 85%, 65%)"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.8"
      />
      {/* Sello / badge */}
      <circle cx="98" cy="30" r="14" fill="hsl(168, 75%, 52%)" opacity="0.12" />
      <circle cx="98" cy="30" r="9" fill="hsl(168, 75%, 52%)" opacity="0.3" />
      <circle cx="98" cy="30" r="4" fill="hsl(168, 75%, 52%)" />
    </svg>
  )
}

export function BoxEmptyArt() {
  return (
    <svg width="128" height="128" viewBox="0 0 128 128" fill="none" className="animate-float">
      <defs>
        <linearGradient id="bea-top" x1="0" y1="0" x2="0" y2="100%" gradientUnits="objectBoundingBox">
          <stop offset="0" stopColor="hsl(168, 75%, 60%)" stopOpacity="0.8" />
          <stop offset="1" stopColor="hsl(260, 85%, 70%)" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="bea-left" x1="0" y1="0" x2="100%" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0" stopColor="hsl(168, 75%, 36%)" stopOpacity="0.18" />
          <stop offset="1" stopColor="hsl(168, 75%, 36%)" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id="bea-right" x1="0" y1="0" x2="100%" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0" stopColor="hsl(168, 75%, 36%)" stopOpacity="0.05" />
          <stop offset="1" stopColor="hsl(168, 75%, 36%)" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      {/* Caja isométrica con tres caras visibles */}
      <path d="M22 44 L64 24 L106 44 L64 64 Z" fill="url(#bea-top)" stroke="hsl(168, 75%, 42%)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M22 44 V94 L64 114 V64 Z" fill="url(#bea-left)" stroke="hsl(168, 75%, 42%)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M106 44 V94 L64 114 V64 Z" fill="url(#bea-right)" stroke="hsl(168, 75%, 42%)" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Detalles de cinta de embalaje en el tope */}
      <path d="M64 24 V64" stroke="hsl(260, 85%, 60%)" strokeWidth="1.5" opacity="0.5" />
      {/* Sombra debajo */}
      <ellipse cx="64" cy="118" rx="32" ry="3" fill="hsl(168, 75%, 42%)" opacity="0.1" />
    </svg>
  )
}

export function ChartEmptyArt() {
  return (
    <svg width="128" height="128" viewBox="0 0 128 128" fill="none" className="animate-float">
      <defs>
        <linearGradient id="che-g" x1="0" y1="0" x2="128" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="hsl(168, 75%, 52%)" />
          <stop offset="1" stopColor="hsl(260, 85%, 65%)" />
        </linearGradient>
      </defs>
      {/* Eje base con marca */}
      <path d="M16 108 L112 108" stroke="hsl(168, 75%, 42%)" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <rect x="16" y="84" width="14" height="22" rx="4" fill="url(#che-g)" opacity="0.35" />
      <rect x="40" y="64" width="14" height="42" rx="4" fill="url(#che-g)" opacity="0.55" />
      <rect x="64" y="44" width="14" height="62" rx="4" fill="url(#che-g)" opacity="0.78" />
      <rect x="88" y="22" width="14" height="84" rx="4" fill="url(#che-g)" />
      {/* Línea de tendencia con puntos */}
      <path
        d="M23 82 Q47 62 71 52 T95 24"
        stroke="hsl(260, 85%, 65%)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <circle cx="23" cy="82" r="3" fill="hsl(260, 85%, 65%)" />
      <circle cx="47" cy="62" r="3" fill="hsl(260, 85%, 65%)" />
      <circle cx="71" cy="52" r="3" fill="hsl(260, 85%, 65%)" />
      <circle cx="95" cy="24" r="3" fill="hsl(260, 85%, 65%)" />
    </svg>
  )
}
