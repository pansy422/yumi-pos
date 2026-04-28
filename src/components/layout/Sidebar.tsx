import { NavLink } from 'react-router-dom'
import {
  BarChart3,
  Box,
  DollarSign,
  HelpCircle,
  LogOut,
  Receipt,
  Settings as Cog,
  ShoppingCart,
  User as UserIcon,
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
  const user = useSession((s) => s.user)
  const logout = useSession((s) => s.logout)
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border/60 bg-background/70 backdrop-blur-xl backdrop-saturate-150">
      <div className="flex h-[60px] items-center border-b border-border/40 px-5">
        <Wordmark />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-3">
        {ITEMS.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium tracking-tight',
                'transition-[background-color,color,transform,box-shadow] duration-150 ease-out-quart',
                'active:scale-[0.98]',
                isActive
                  ? 'bg-card text-foreground shadow-[0_1px_2px_0_hsl(var(--shadow-color)/0.06),0_2px_8px_-2px_hsl(var(--shadow-color)/0.08)]'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className="flex items-center gap-3">
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full brand-gradient" />
                  )}
                  <it.icon
                    className={cn(
                      'h-4 w-4 transition-transform group-hover:scale-110',
                      isActive ? 'text-primary' : '',
                    )}
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

      {user && (
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <UserIcon className="h-3.5 w-3.5 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="truncate font-medium">{user.name}</div>
              <div className="text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
                {user.role === 'admin' ? 'Admin' : 'Cajero'}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Cerrar sesión"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
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
