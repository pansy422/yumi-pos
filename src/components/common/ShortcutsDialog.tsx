import { useState } from 'react'
import { Keyboard } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Kbd } from './Kbd'
import { useShortcut } from '@/lib/keyboard'

const NAV = [
  { keys: ['F1'], label: 'Ir a Vender' },
  { keys: ['F2'], label: 'Ir a Inventario' },
  { keys: ['F3'], label: 'Ir a Caja' },
  { keys: ['F4'], label: 'Ir a Reportes' },
  { keys: ['F9'], label: 'Ir a Ajustes' },
]

const POS = [
  { keys: ['F5'], label: 'Cobrar' },
  { keys: ['Ctrl', 'B'], label: 'Buscar producto' },
  { keys: ['Esc'], label: 'Vaciar ticket' },
  { keys: ['Enter'], label: 'Confirmar cobro' },
]

const GLOBAL = [
  { keys: ['?'], label: 'Mostrar atajos' },
  { keys: ['Esc'], label: 'Cerrar diálogos' },
]

export function ShortcutsDialog() {
  const [open, setOpen] = useState(false)
  useShortcut({ key: '?', shift: true }, () => setOpen((v) => !v))
  useShortcut({ key: '/' }, () => setOpen((v) => !v))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" />
            Atajos de teclado
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 sm:grid-cols-3">
          <Group title="Navegación" items={NAV} />
          <Group title="POS" items={POS} />
          <Group title="Global" items={GLOBAL} />
        </div>
        <p className="text-xs text-muted-foreground">
          Pulsa <Kbd>?</Kbd> en cualquier momento para abrir esta ayuda.
        </p>
      </DialogContent>
    </Dialog>
  )
}

function Group({ title, items }: { title: string; items: { keys: string[]; label: string }[] }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-caps text-muted-foreground">{title}</div>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.label} className="flex items-center justify-between gap-3">
            <span className="text-sm text-foreground">{it.label}</span>
            <span className="flex items-center gap-1">
              {it.keys.map((k, i) => (
                <Kbd key={i}>{k}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
