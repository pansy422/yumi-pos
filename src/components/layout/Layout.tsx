import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useShortcut } from '@/lib/keyboard'

export function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  // Atajos de navegación: deben funcionar incluso si el foco está en un input
  // (caso típico cuando el cajero está escribiendo cantidades).
  useShortcut({ key: 'F1' }, () => navigate('/pos'), { allowInInput: true })
  useShortcut({ key: 'F2' }, () => navigate('/inventario'), { allowInInput: true })
  useShortcut({ key: 'F3' }, () => navigate('/caja'), { allowInInput: true })
  useShortcut({ key: 'F4' }, () => navigate('/reportes'), { allowInInput: true })
  useShortcut({ key: 'F6' }, () => navigate('/ventas'), { allowInInput: true })
  useShortcut({ key: 'F9' }, () => navigate('/ajustes'), { allowInInput: true })

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-background">
        <div key={location.pathname} className="h-full animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
