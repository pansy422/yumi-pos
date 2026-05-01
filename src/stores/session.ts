import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CashSession, Settings, User } from '@shared/types'
import { api } from '@/lib/api'
import { useCart } from '@/stores/cart'

type State = {
  cash: CashSession | null
  settings: Settings | null
  loading: boolean
  /** Cajero actual. null cuando todavía no se hizo login (o cuando no
   *  hay usuarios creados — en ese caso no se exige login). */
  user: User | null
  userCount: number
  /** Contador que se bumpea cada vez que se crea o anula una venta. Sirve
   *  como "señal" para que widgets de stats (TodayCard, etc.) se
   *  refresquen sin necesidad de recargar la página. */
  salesVersion: number
}

type Actions = {
  refresh: () => Promise<void>
  setCash: (s: CashSession | null) => void
  setSettings: (s: Settings) => void
  setUser: (u: User | null) => void
  logout: () => void
  /** Llamar después de crear/anular/devolver una venta para que los
   *  componentes que dependen de stats del día vuelvan a fetchear. */
  bumpSalesVersion: () => void
}

export const useSession = create<State & Actions>()(
  persist(
    (set) => ({
      cash: null,
      settings: null,
      loading: true,
      user: null,
      userCount: 0,
      salesVersion: 0,
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
      // Logout limpia también el carrito — sin esto, el siguiente cajero
      // vería los productos que dejó cargados el cajero anterior y podría
      // cobrar una venta a su nombre.
      logout: () => {
        set({ user: null })
        useCart.getState().clear()
      },
      bumpSalesVersion: () => set((s) => ({ salesVersion: s.salesVersion + 1 })),
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
