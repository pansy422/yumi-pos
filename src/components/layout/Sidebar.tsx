import { NavLink } from 'react-router-dom'
import { BarChart3, Box, DollarSign, Settings as Cog, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSession } from '@/stores/session'
import { Badge } from '@/components/ui/badge'

const ITEMS = [
  { to: '/pos', label: 'Vender', icon: ShoppingCart, hint: 'F1' },
  { to: '/inventario', label: 'Inventario', icon: Box, hint: 'F2' },
  { to: '/caja', label: 'Caja', icon: DollarSign, hint: 'F3' },
  { to: '/reportes', label: 'Reportes', icon: BarChart3, hint: 'F4' },
  { to: '/ajustes', label: 'Ajustes', icon: Cog, hint: 'F9' },
]

export function Sidebar() {
  const cash = useSession((s) => s.cash)
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-card/40">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
          Y
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Yumi POS</div>
          <div className="text-[10px] text-muted-foreground">offline</div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {ITEMS.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) =>
              cn(
                'flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )
            }
          >
            <span className="flex items-center gap-2">
              <it.icon className="h-4 w-4" />
              {it.label}
            </span>
            <span className="text-[10px] text-muted-foreground">{it.hint}</span>
          </NavLink>
        ))}
      </nav>
      <div className="border-t p-3">
        {cash ? (
          <Badge variant="success" className="w-full justify-center">
            Caja abierta
          </Badge>
        ) : (
          <Badge variant="warning" className="w-full justify-center">
            Caja cerrada
          </Badge>
        )}
      </div>
    </aside>
  )
}
