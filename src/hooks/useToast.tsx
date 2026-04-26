import * as React from 'react'
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from '@/components/ui/toast'

type Variant = 'default' | 'success' | 'warning' | 'destructive'
type ToastItem = { id: number; title?: string; description?: string; variant?: Variant; duration?: number }

type Ctx = {
  toast: (t: Omit<ToastItem, 'id'>) => void
}

const ToastCtx = React.createContext<Ctx | null>(null)

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([])
  const idRef = React.useRef(0)

  const toast = React.useCallback((t: Omit<ToastItem, 'id'>) => {
    idRef.current += 1
    const next: ToastItem = { id: idRef.current, duration: 4000, ...t }
    setItems((prev) => [...prev, next])
  }, [])

  const remove = (id: number) => setItems((prev) => prev.filter((p) => p.id !== id))

  return (
    <ToastCtx.Provider value={{ toast }}>
      <ToastProvider swipeDirection="right">
        {children}
        {items.map((t) => (
          <Toast
            key={t.id}
            variant={t.variant}
            duration={t.duration}
            onOpenChange={(open) => { if (!open) remove(t.id) }}
          >
            <div className="grid gap-1">
              {t.title && <ToastTitle>{t.title}</ToastTitle>}
              {t.description && <ToastDescription>{t.description}</ToastDescription>}
            </div>
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToastCtx.Provider>
  )
}

export function useToast(): Ctx {
  const ctx = React.useContext(ToastCtx)
  if (!ctx) throw new Error('useToast: falta ToasterProvider')
  return ctx
}
