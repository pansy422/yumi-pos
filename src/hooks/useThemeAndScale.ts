import { useEffect } from 'react'
import { useSession } from '@/stores/session'

/**
 * Aplica el tema (light/dark) y la escala de fuente al <html> según la
 * configuración global y el usuario logueado.
 *
 * - Tema: settings.flags.theme determina si va `dark` class. Default: light.
 * - Font scale: si hay usuario logueado, su `font_scale`. Si no, 1.0.
 *   Se aplica como CSS variable `--font-scale` que escala el font-size
 *   raíz del documento. Todas las clases de Tailwind que usan `rem`
 *   escalan automáticamente.
 */
export function useThemeAndScale() {
  const settings = useSession((s) => s.settings)
  const user = useSession((s) => s.user)

  useEffect(() => {
    const root = document.documentElement
    const theme = settings?.flags.theme ?? 'light'
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
  }, [settings?.flags.theme])

  useEffect(() => {
    const root = document.documentElement
    const scale = user?.font_scale ?? 1
    root.style.setProperty('--font-scale', String(scale))
  }, [user?.font_scale])
}
