import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type QuickKey = {
  slot: number
  product_id: string
  name: string
  price: number
  color?: string
}

const SLOT_COUNT = 6

type State = {
  keys: QuickKey[]
  count: number
}

type Actions = {
  set: (slot: number, product: { id: string; name: string; price: number }, color?: string) => void
  unset: (slot: number) => void
  clear: () => void
  get: (slot: number) => QuickKey | null
}

export const useQuickKeys = create<State & Actions>()(
  persist(
    (set, get) => ({
      keys: [],
      count: SLOT_COUNT,
      set: (slot, product, color) =>
        set((s) => {
          const filtered = s.keys.filter((k) => k.slot !== slot)
          return {
            keys: [
              ...filtered,
              { slot, product_id: product.id, name: product.name, price: product.price, color },
            ].sort((a, b) => a.slot - b.slot),
          }
        }),
      unset: (slot) => set((s) => ({ keys: s.keys.filter((k) => k.slot !== slot) })),
      clear: () => set({ keys: [] }),
      get: (slot) => get().keys.find((k) => k.slot === slot) ?? null,
    }),
    { name: 'yumi-quick-keys' },
  ),
)

export const QUICK_KEY_COLORS = [
  'hsl(168, 75%, 52%)',
  'hsl(260, 85%, 65%)',
  'hsl(36, 95%, 56%)',
  'hsl(200, 95%, 60%)',
  'hsl(330, 75%, 60%)',
  'hsl(152, 75%, 50%)',
  'hsl(20, 90%, 60%)',
  'hsl(280, 65%, 60%)',
]
