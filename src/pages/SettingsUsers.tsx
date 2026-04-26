import * as React from 'react'
import { Plus, Trash2, User as UserIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/useToast'
import { useSession } from '@/stores/session'
import { api } from '@/lib/api'
import type { User, UserInput, UserRole } from '@shared/types'

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrador',
  cashier: 'Cajero',
}

export function UsersTab() {
  const { toast } = useToast()
  const refresh = useSession((s) => s.refresh)
  const [items, setItems] = React.useState<User[]>([])
  const [edit, setEdit] = React.useState<User | null>(null)
  const [creating, setCreating] = React.useState(false)

  const load = async () => {
    setItems(await api.usersList(true))
    refresh()
  }
  React.useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-3">
      <Card className="card-elev">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <UserIcon className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <div className="text-foreground">Usuarios y PIN</div>
              <p className="text-[11px]">
                Cuando hay al menos 1 usuario activo, al abrir la app se pide PIN. Cada venta
                queda asociada al cajero que la cobró.
              </p>
            </div>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nuevo usuario
          </Button>
        </CardContent>
      </Card>

      <Card className="card-elev">
        <CardContent className="p-0">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay usuarios. Sin usuarios el sistema funciona como single-user
              (no pide PIN al abrir).
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
              {items.map((u) => (
                <li
                  key={u.id}
                  className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/30"
                  onClick={() => setEdit(u)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{u.name}</span>
                      <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                        {ROLE_LABEL[u.role]}
                      </Badge>
                      {u.active ? (
                        <Badge variant="success">Activo</Badge>
                      ) : (
                        <Badge variant="destructive">Inactivo</Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Creado{' '}
                      {new Date(u.created_at).toLocaleDateString('es-CL', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`¿Desactivar usuario "${u.name}"?`)) {
                        api.usersDelete(u.id).then(load)
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <UserEditor
        open={creating || !!edit}
        onOpenChange={(v) => {
          if (!v) {
            setCreating(false)
            setEdit(null)
          }
        }}
        user={edit}
        onSaved={async () => {
          setCreating(false)
          setEdit(null)
          await load()
          toast({ variant: 'success', title: 'Usuario guardado' })
        }}
      />
    </div>
  )
}

function UserEditor({
  open,
  onOpenChange,
  user,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  user: User | null
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = React.useState('')
  const [role, setRole] = React.useState<UserRole>('cashier')
  const [pin, setPin] = React.useState('')
  const [active, setActive] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    if (user) {
      setName(user.name)
      setRole(user.role)
      setActive(user.active === 1)
      setPin('')
    } else {
      setName('')
      setRole('cashier')
      setActive(true)
      setPin('')
    }
  }, [open, user])

  const submit = async () => {
    if (!name.trim()) {
      toast({ variant: 'warning', title: 'Falta el nombre' })
      return
    }
    if (!user && pin.length < 4) {
      toast({ variant: 'warning', title: 'PIN debe tener entre 4 y 6 dígitos' })
      return
    }
    if (pin && !/^\d{4,6}$/.test(pin)) {
      toast({ variant: 'warning', title: 'PIN inválido (solo dígitos, 4 a 6)' })
      return
    }
    setSaving(true)
    try {
      const input: UserInput = {
        id: user?.id,
        name: name.trim(),
        role,
        pin: pin || undefined,
        active,
      }
      await api.usersSave(input)
      onSaved()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'No se pudo guardar',
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{user ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
          <DialogDescription>
            Los administradores pueden ver todas las pantallas. Los cajeros se centran en vender
            (se respeta en próximas versiones).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nombre *</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. María"
            />
          </div>
          <div className="space-y-1">
            <Label>Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cashier">Cajero</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>PIN {user ? '(dejar vacío para no cambiar)' : '*'}</Label>
            <Input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              placeholder="4 a 6 dígitos"
              className="text-center num text-xl tracking-[0.4em]"
            />
          </div>
          {user && (
            <div className="flex items-center justify-between rounded-md border border-border/40 bg-muted/30 px-3 py-2">
              <Label className="text-sm text-foreground">Activo</Label>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
