import { create } from 'zustand'
import type { CartItem, Product } from '@shared/types'

type State = {
  items: CartItem[]
  discount: number
  lastAddedAt: number
  lastAddedId: string | null
}

type Actions = {
  add: (p: Product, qty?: number) => void
  setQty: (productId: string, qty: number) => void
  remove: (productId: string) => void
  clear: () => void
  setDiscount: (n: number) => void
  subtotal: () => number
  total: () => number
}

export const useCart = create<State & Actions>((set, get) => ({
  items: [],
  discount: 0,
  lastAddedAt: 0,
  lastAddedId: null,
  add: (p, qty = 1) =>
    set((s) => {
      const idx = s.items.findIndex((i) => i.product_id === p.id)
      const stamp = Date.now()
      if (idx >= 0) {
        const copy = [...s.items]
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + qty }
        return { items: copy, lastAddedAt: stamp, lastAddedId: p.id }
      }
      return {
        items: [
          ...s.items,
          {
            product_id: p.id,
            barcode: p.barcode,
            name: p.name,
            price: p.price,
            cost: p.cost,
            qty,
            stock: p.stock,
          },
        ],
        lastAddedAt: stamp,
        lastAddedId: p.id,
      }
    }),
  setQty: (productId, qty) =>
    set((s) => ({
      items: s.items
        .map((i) => (i.product_id === productId ? { ...i, qty: Math.max(0, Math.round(qty)) } : i))
        .filter((i) => i.qty > 0),
    })),
  remove: (productId) =>
    set((s) => ({ items: s.items.filter((i) => i.product_id !== productId) })),
  clear: () => set({ items: [], discount: 0, lastAddedId: null }),
  setDiscount: (n) => set({ discount: Math.max(0, Math.round(n)) }),
  subtotal: () => get().items.reduce((acc, i) => acc + i.price * i.qty, 0),
  total: () => Math.max(0, get().subtotal() - get().discount),
}))
