import * as React from 'react'

/**
 * Header de página premium — alineado al estilo macOS/iOS:
 *  - Tipografía display con tracking apretado
 *  - Glass background sutil (saturate + blur ligero)
 *  - Border bottom de 1px casi imperceptible
 *  - Spacing generoso (py-6 vs py-4 estándar)
 *  - Description con color foreground/60 para jerarquía clara
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="border-b border-border/60 bg-background/75 px-6 py-5 backdrop-blur-xl backdrop-saturate-150">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold tracking-display-tight leading-none">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
