import { create } from 'zustand'
import type { CashSession, Settings } from '@shared/types'
import { api } from '@/lib/api'

type State = {
  cash: CashSession | null
  settings: Settings | null
  loading: boolean
}

type Actions = {
  refresh: () => Promise<void>
  setCash: (s: CashSession | null) => void
  setSettings: (s: Settings) => void
}

export const useSession = create<State & Actions>((set) => ({
  cash: null,
  settings: null,
  loading: true,
  refresh: async () => {
    set({ loading: true })
    const [cash, settings] = await Promise.all([api.cashCurrent(), api.settingsGet()])
    set({ cash, settings, loading: false })
  },
  setCash: (cash) => set({ cash }),
  setSettings: (settings) => set({ settings }),
}))
