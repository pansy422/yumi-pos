import { useSession } from '@/stores/session'

/**
 * Devuelve el rol del cajero logueado (`admin` o `cashier`). Si no hay
 * sesión activa (modo single-user) devolvemos 'admin' para no
 * restringir al dueño que está corriendo la app sin haber creado
 * usuarios todavía.
 *
 * Modelo de confianza: esto es un POS desktop, no una web. El gating
 * es para evitar que la cajera apriete por error botones del dueño,
 * no para protegerse de un atacante (con devtools puede saltearlo
 * trivialmente). Si necesitan seguridad real, hay que enforce en el
 * proceso main.
 */
export function useRole(): 'admin' | 'cashier' {
  const user = useSession((s) => s.user)
  if (!user) return 'admin'
  return user.role === 'admin' ? 'admin' : 'cashier'
}

export function useIsAdmin(): boolean {
  return useRole() === 'admin'
}
