import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { lineTotal } from '@shared/money'
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
  setSurcharge: (productId: string, n: number) => void
  remove: (productId: string) => void
  clear: () => void
  setDiscount: (n: number) => void
  subtotal: () => number
  surchargeTotal: () => number
  total: () => number
  loadItems: (items: CartItem[], discount: number) => void
}

export const useCart = create<State & Actions>()(
  persist(
    (set, get) => ({
      items: [],
      discount: 0,
      lastAddedAt: 0,
      lastAddedId: null,
      add: (p, qty = 1) =>
        set((s) => {
          const idx = s.items.findIndex((i) => i.product_id === p.id)
          const stamp = Date.now()
          // Para productos al peso, en lugar de acumular reemplazamos la
          // cantidad — porque cada pesada del producto en la balanza es un
          // valor único, no se incrementa.
          if (idx >= 0) {
            const copy = [...s.items]
            const existing = copy[idx]
            copy[idx] = {
              ...existing,
              qty: existing.is_weight === 1 ? qty : existing.qty + qty,
            }
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
                surcharge: 0,
                is_weight: p.is_weight === 1 ? 1 : 0,
                category: p.category ?? null,
              },
            ],
            lastAddedAt: stamp,
            lastAddedId: p.id,
          }
        }),
      setQty: (productId, qty) =>
        set((s) => ({
          items: s.items
            .map((i) =>
              i.product_id === productId ? { ...i, qty: Math.max(0, Math.round(qty)) } : i,
            )
            .filter((i) => i.qty > 0),
        })),
      setSurcharge: (productId, n) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.product_id === productId ? { ...i, surcharge: Math.round(n) } : i,
          ),
        })),
      remove: (productId) =>
        set((s) => ({ items: s.items.filter((i) => i.product_id !== productId) })),
      clear: () => set({ items: [], discount: 0, lastAddedId: null }),
      setDiscount: (n) => set({ discount: Math.max(0, Math.round(n)) }),
      subtotal: () => get().items.reduce((acc, i) => acc + lineTotal(i), 0),
      surchargeTotal: () =>
        get().items.reduce((acc, i) => {
          if (i.is_weight === 1) return acc + Math.round((i.surcharge * i.qty) / 1000)
          return acc + i.surcharge * i.qty
        }, 0),
      total: () => Math.max(0, get().subtotal() - get().discount),
      loadItems: (items, discount) =>
        set({
          items: items.map((i) => ({
            ...i,
            surcharge: i.surcharge ?? 0,
            is_weight: i.is_weight === 1 ? 1 : 0,
            category: i.category ?? null,
          })),
          discount,
          lastAddedId: null,
          lastAddedAt: 0,
        }),
    }),
    {
      name: 'yumi-cart-current',
      partialize: (s) => ({ items: s.items, discount: s.discount }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<State>),
        items: ((persisted as { items?: CartItem[] }).items ?? []).map((i) => ({
          ...i,
          surcharge: i.surcharge ?? 0,
          is_weight: i.is_weight === 1 ? 1 : 0,
          category: i.category ?? null,
        })),
        lastAddedAt: 0,
        lastAddedId: null,
      }),
    },
  ),
)

export { lineTotal as cartLineTotal }
