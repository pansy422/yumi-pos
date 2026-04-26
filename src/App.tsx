import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { ToasterProvider } from '@/hooks/useToast'
import { ShortcutsDialog } from '@/components/common/ShortcutsDialog'
import { FirstRunWizard } from '@/components/common/FirstRunWizard'
import { useSession } from '@/stores/session'
import { POS } from '@/pages/POS'
import { Inventory } from '@/pages/Inventory'
import { InventoryScan } from '@/pages/InventoryScan'
import { Cash } from '@/pages/Cash'
import { Reports } from '@/pages/Reports'
import { Settings } from '@/pages/Settings'

export default function App() {
  const refresh = useSession((s) => s.refresh)
  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <ToasterProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/pos" replace />} />
          <Route path="/pos" element={<POS />} />
          <Route path="/inventario" element={<Inventory />} />
          <Route path="/inventario/pistolear" element={<InventoryScan />} />
          <Route path="/caja" element={<Cash />} />
          <Route path="/reportes" element={<Reports />} />
          <Route path="/ajustes" element={<Settings />} />
          <Route path="*" element={<Navigate to="/pos" replace />} />
        </Route>
      </Routes>
      <ShortcutsDialog />
      <FirstRunWizard />
    </ToasterProvider>
  )
}
