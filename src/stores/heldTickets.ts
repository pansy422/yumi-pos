import { create } from 'zustand'
import type { CartItem, HeldTicket } from '@shared/types'
import { api } from '@/lib/api'

export type { HeldTicket }

type State = {
  tickets: HeldTicket[]
  loaded: boolean
}

type Actions = {
  /** Carga (o recarga) los tickets desde la base. Se llama al montar el POS. */
  refresh: () => Promise<void>
  /** Guarda un nuevo ticket en espera. Devuelve el creado. */
  hold: (name: string, items: CartItem[], discount: number) => Promise<HeldTicket>
  remove: (id: string) => Promise<void>
  clear: () => Promise<void>
}

/**
 * Tickets en espera persistidos en SQLite (vía IPC). Antes vivían solo
 * en localStorage del renderer; si se limpiaba el perfil se perdían a
 * mitad de turno. Ahora viven en la DB y sobreviven a reinicios y
 * crashes del proceso.
 */
export const useHeldTickets = create<State & Actions>((set) => ({
  tickets: [],
  loaded: false,
  refresh: async () => {
    const list = await api.heldTicketsList()
    set({ tickets: list, loaded: true })
  },
  hold: async (name, items, discount) => {
    const safeName =
      name.trim() ||
      `Ticket ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`
    const t = await api.heldTicketsSave({ name: safeName, items, discount })
    set((s) => ({ tickets: [t, ...s.tickets].slice(0, 30) }))
    return t
  },
  remove: async (id) => {
    await api.heldTicketsRemove(id)
    set((s) => ({ tickets: s.tickets.filter((t) => t.id !== id) }))
  },
  clear: async () => {
    await api.heldTicketsClear()
    set({ tickets: [] })
  },
}))
