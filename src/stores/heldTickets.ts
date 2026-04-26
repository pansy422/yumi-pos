import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem } from '@shared/types'

export type HeldTicket = {
  id: string
  name: string
  created_at: number
  items: CartItem[]
  discount: number
}

type State = {
  tickets: HeldTicket[]
}

type Actions = {
  hold: (name: string, items: CartItem[], discount: number) => HeldTicket
  remove: (id: string) => void
  clear: () => void
}

export const useHeldTickets = create<State & Actions>()(
  persist(
    (set) => ({
      tickets: [],
      hold: (name, items, discount) => {
        const t: HeldTicket = {
          id: 'h_' + Math.random().toString(36).slice(2, 10),
          name: name.trim() || `Ticket ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`,
          created_at: Date.now(),
          items,
          discount,
        }
        set((s) => ({ tickets: [t, ...s.tickets].slice(0, 30) }))
        return t
      },
      remove: (id) => set((s) => ({ tickets: s.tickets.filter((t) => t.id !== id) })),
      clear: () => set({ tickets: [] }),
    }),
    { name: 'yumi-held-tickets' },
  ),
)
