import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CashSession, Settings, User } from '@shared/types'
import { api } from '@/lib/api'

type State = {
  cash: CashSession | null
  settings: Settings | null
  loading: boolean
  /** Cajero actual. null cuando todavía no se hizo login (o cuando no
   *  hay usuarios creados — en ese caso no se exige login). */
  user: User | null
  userCount: number
}

type Actions = {
  refresh: () => Promise<void>
  setCash: (s: CashSession | null) => void
  setSettings: (s: Settings) => void
  setUser: (u: User | null) => void
  logout: () => void
}

export const useSession = create<State & Actions>()(
  persist(
    (set) => ({
      cash: null,
      settings: null,
      loading: true,
      user: null,
      userCount: 0,
      refresh: async () => {
        set({ loading: true })
        const [cash, settings, userCount, users] = await Promise.all([
          api.cashCurrent(),
          api.settingsGet(),
          api.usersCount(),
          api.usersList(false),
        ])
        // El user activo se persiste en localStorage. Si la DB se reseteó
        // (restore de respaldo, borrado manual, etc.), el UUID guardado
        // puede apuntar a un user que ya no existe → todas las inserciones
        // posteriores fallarían con FOREIGN KEY constraint failed. Acá
        // limpiamos el estado si el user persistido ya no está en la DB.
        const persisted = useSession.getState().user
        const stillExists = persisted ? users.some((u) => u.id === persisted.id) : true
        set({
          cash,
          settings,
          userCount,
          loading: false,
          user: stillExists ? persisted : null,
        })
      },
      setCash: (cash) => set({ cash }),
      setSettings: (settings) => set({ settings }),
      setUser: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    {
      name: 'yumi-session',
      // Solo persistimos al usuario activo y settings/cash dont need persist
      // (se reflectchan al iniciar). Esto evita que un usuario quede
      // logueado para siempre — pero también lo persiste entre cierres
      // del programa para no obligar al cajero a meter PIN cada vez.
      partialize: (s) => ({ user: s.user }),
    },
  ),
)
