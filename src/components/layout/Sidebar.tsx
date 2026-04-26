import { NavLink } from 'react-router-dom'
import {
  BarChart3,
  Box,
  DollarSign,
  HelpCircle,
  Receipt,
  Settings as Cog,
  ShoppingCart,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSession } from '@/stores/session'
import { Wordmark } from '@/components/brand/Logo'
import { Kbd } from '@/components/common/Kbd'

const ITEMS = [
  { to: '/pos', label: 'Vender', icon: ShoppingCart, hint: 'F1' },
  { to: '/inventario', label: 'Inventario', icon: Box, hint: 'F2' },
  { to: '/caja', label: 'Caja', icon: DollarSign, hint: 'F3' },
  { to: '/reportes', label: 'Reportes', icon: BarChart3, hint: 'F4' },
  { to: '/ventas', label: 'Ventas', icon: Receipt, hint: 'F6' },
  { to: '/ajustes', label: 'Ajustes', icon: Cog, hint: 'F9' },
]

export function Sidebar() {
  const cash = useSession((s) => s.cash)
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border/70 bg-card/40 backdrop-blur-sm">
      <div className="flex h-16 items-center px-4">
        <Wordmark />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
        {ITEMS.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-gradient-to-r from-primary/15 via-primary/8 to-transparent text-foreground'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className="flex items-center gap-3">
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full brand-gradient" />
                  )}
                  <it.icon
                    className={cn('h-4 w-4', isActive ? 'text-primary' : '')}
                  />
                  {it.label}
                </span>
                <Kbd className={cn(isActive ? 'border-primary/30 text-primary' : '')}>{it.hint}</Kbd>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-2">
        <div
          className={cn(
            'flex items-center justify-between rounded-lg border px-3 py-2 text-xs',
            cash
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-warning/30 bg-warning/10 text-warning',
          )}
        >
          <span className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span
                className={cn(
                  'absolute inline-flex h-full w-full animate-ping-soft rounded-full',
                  cash ? 'bg-success' : 'bg-warning',
                )}
              />
              <span
                className={cn(
                  'relative inline-flex h-2 w-2 rounded-full',
                  cash ? 'bg-success' : 'bg-warning',
                )}
              />
            </span>
            Caja {cash ? 'abierta' : 'cerrada'}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5" />
          Atajos
        </span>
        <Kbd>?</Kbd>
      </div>
    </aside>
  )
}
