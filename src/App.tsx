import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { ToasterProvider } from '@/hooks/useToast'
import { ShortcutsDialog } from '@/components/common/ShortcutsDialog'
import { FirstRunWizard } from '@/components/common/FirstRunWizard'
import { LoginDialog } from '@/components/common/LoginDialog'
import { FontScaleDialog } from '@/components/common/FontScaleDialog'
import { useSession } from '@/stores/session'
import { useThemeAndScale } from '@/hooks/useThemeAndScale'
import { useShortcut } from '@/lib/keyboard'
import { POS } from '@/pages/POS'
import { Inventory } from '@/pages/Inventory'
import { InventoryScan } from '@/pages/InventoryScan'
import { Sales } from '@/pages/Sales'
import { Cash } from '@/pages/Cash'
import { Reports } from '@/pages/Reports'
import { Settings } from '@/pages/Settings'

export default function App() {
  const refresh = useSession((s) => s.refresh)
  const user = useSession((s) => s.user)
  const [fontDlg, setFontDlg] = useState(false)

  useEffect(() => {
    refresh()
  }, [refresh])
  useThemeAndScale()

  // F8 desde cualquier pantalla abre el diálogo de tamaño de letra.
  // Solo si hay usuario logueado (sino no hay perfil donde guardar).
  useShortcut({ key: 'F8' }, () => user && setFontDlg(true), { allowInInput: true })

  return (
    <ToasterProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/pos" replace />} />
          <Route path="/pos" element={<POS />} />
          <Route path="/inventario" element={<Inventory />} />
          <Route path="/inventario/pistolear" element={<InventoryScan />} />
          <Route path="/ventas" element={<Sales />} />
          <Route path="/caja" element={<Cash />} />
          <Route path="/reportes" element={<Reports />} />
          <Route path="/ajustes" element={<Settings />} />
          <Route path="*" element={<Navigate to="/pos" replace />} />
        </Route>
      </Routes>
      <ShortcutsDialog />
      <FirstRunWizard />
      <LoginDialog />
      <FontScaleDialog open={fontDlg} onOpenChange={setFontDlg} />
    </ToasterProvider>
  )
}
