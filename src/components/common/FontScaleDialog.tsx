import * as React from 'react'
import { Type } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/useToast'
import { useSession } from '@/stores/session'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const FONT_SCALES: { id: number; label: string; hint: string }[] = [
  { id: 0.9, label: 'Pequeña', hint: 'A' },
  { id: 1.0, label: 'Normal', hint: 'A' },
  { id: 1.15, label: 'Grande', hint: 'A' },
  { id: 1.3, label: 'Muy grande', hint: 'A' },
  { id: 1.5, label: 'Máxima', hint: 'A' },
]

/**
 * Atajo rápido para cambiar el tamaño de letra del usuario logueado
 * sin tener que ir a Settings → Usuarios → editar. Crítico para
 * accesibilidad: si un cajero subió mucho la letra y ahora no puede
 * navegar bien, debe poder bajarla desde cualquier pantalla.
 *
 * Trigger: tecla F8 desde cualquier vista, o el botón Type en sidebar /
 * top bar del POS.
 */
export function FontScaleDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { toast } = useToast()
  const user = useSession((s) => s.user)
  const setUser = useSession((s) => s.setUser)
  const [saving, setSaving] = React.useState<number | null>(null)

  const apply = async (scale: number) => {
    if (!user || saving != null) return
    setSaving(scale)
    try {
      const updated = await api.usersSave({
        id: user.id,
        name: user.name,
        role: user.role,
        font_scale: scale,
        active: user.active === 1,
      })
      setUser(updated)
      toast({
        variant: 'success',
        title: 'Tamaño de letra actualizado',
        duration: 1500,
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'No se pudo cambiar',
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSaving(null)
    }
  }

  if (!user) return null

  const current = user.font_scale ?? 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 tracking-display-tight">
            <Type className="h-5 w-5 text-primary" />
            Tamaño de letra
          </DialogTitle>
          <DialogDescription>
            Se aplica al instante para{' '}
            <span className="font-medium text-foreground">{user.name}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-5 overflow-hidden rounded-lg border border-border/60 bg-muted/30">
          {FONT_SCALES.map((s) => {
            const active = Math.abs(current - s.id) < 0.01
            const busy = saving === s.id
            return (
              <button
                key={s.id}
                type="button"
                disabled={saving != null}
                onClick={() => apply(s.id)}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 px-1 py-3',
                  'transition-[background-color,color,transform] duration-150 ease-out-quart',
                  'active:scale-[0.97] disabled:opacity-60',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:bg-accent',
                )}
              >
                <span style={{ fontSize: `${10 + (s.id - 1) * 8}px`, fontWeight: 600 }}>
                  {busy ? '…' : s.hint}
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-caps">
                  {s.label}
                </span>
              </button>
            )
          })}
        </div>

        <p className="text-[11px] text-muted-foreground">
          La preferencia se guarda en tu perfil. Tip:{' '}
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">F8</kbd>{' '}
          abre este diálogo desde cualquier pantalla.
        </p>
      </DialogContent>
    </Dialog>
  )
}
