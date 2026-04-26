import { Outlet, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useShortcut } from '@/lib/keyboard'

export function Layout() {
  const navigate = useNavigate()
  useShortcut({ key: 'F1' }, () => navigate('/pos'))
  useShortcut({ key: 'F2' }, () => navigate('/inventario'))
  useShortcut({ key: 'F3' }, () => navigate('/caja'))
  useShortcut({ key: 'F4' }, () => navigate('/reportes'))
  useShortcut({ key: 'F9' }, () => navigate('/ajustes'))

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-background">
        <Outlet />
      </main>
    </div>
  )
}
