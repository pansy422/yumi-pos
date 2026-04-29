import { useEffect } from 'react'
import { useSession } from '@/stores/session'

/**
 * Aplica el tema (light/dark) y la escala de fuente al <html> según la
 * configuración global y el usuario logueado.
 *
 * - Tema: settings.flags.theme determina si va `dark` class. Default: light.
 * - Font scale: si hay usuario logueado, su `font_scale`. Si no, 1.0.
 *   Cuando hay usuarios pero ninguno está logueado (LoginDialog abierto)
 *   forzamos 1.0 para que la pantalla de login siempre se vea bien —
 *   si un user previo había subido la letra a 1.5x no queremos que el
 *   LoginDialog herede ese scale y termine inusable.
 *   Se aplica como CSS variable `--font-scale` que escala el font-size
 *   raíz del documento. Todas las clases de Tailwind que usan `rem`
 *   escalan automáticamente.
 */
export function useThemeAndScale() {
  const settings = useSession((s) => s.settings)
  const user = useSession((s) => s.user)
  const userCount = useSession((s) => s.userCount)

  useEffect(() => {
    const root = document.documentElement
    const theme = settings?.flags.theme ?? 'light'
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
  }, [settings?.flags.theme])

  useEffect(() => {
    const root = document.documentElement
    // Si hay usuarios pero ninguno logueado, estamos en LoginDialog →
    // siempre scale 1 para que el login no quede gigante.
    const inLogin = userCount > 0 && !user
    const scale = inLogin ? 1 : (user?.font_scale ?? 1)
    root.style.setProperty('--font-scale', String(scale))
  }, [user, userCount])
}
