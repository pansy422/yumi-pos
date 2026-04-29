import * as React from 'react'
import { LogIn, User as UserIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Wordmark } from '@/components/brand/Logo'
import { PinPad } from '@/components/common/PinPad'
import { useToast } from '@/hooks/useToast'
import { useSession } from '@/stores/session'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { User } from '@shared/types'

/**
 * Diálogo de login con PIN. Se abre automáticamente cuando hay usuarios
 * creados pero no hay sesión activa. Si no hay ningún usuario, no
 * estorba — el sistema sigue siendo "single-user" como antes.
 */
export function LoginDialog() {
  const { toast } = useToast()
  const user = useSession((s) => s.user)
  const userCount = useSession((s) => s.userCount)
  const setUser = useSession((s) => s.setUser)
  const refresh = useSession((s) => s.refresh)

  const [users, setUsers] = React.useState<User[]>([])
  const [picked, setPicked] = React.useState<User | null>(null)
  const [pin, setPin] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  const open = userCount > 0 && !user

  React.useEffect(() => {
    if (!open) return
    api.usersList(false).then((list) => {
      setUsers(list)
      setPicked((cur) => cur ?? list[0] ?? null)
    })
    setPin('')
  }, [open])

  const submit = async () => {
    if (!picked || pin.length === 0 || submitting) return
    setSubmitting(true)
    try {
      const u = await api.usersVerifyPin(picked.id, pin)
      if (!u) {
        toast({ variant: 'destructive', title: 'PIN incorrecto' })
        setPin('')
        return
      }
      setUser(u)
      await refresh()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'No se pudo iniciar sesión',
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent hideClose className="mesh-bg max-w-md">
        <DialogHeader className="space-y-3">
          <div className="flex justify-center">
            <Wordmark className="text-2xl" />
          </div>
          <DialogTitle className="text-center text-xl tracking-display-tight">
            ¿Quién va a vender?
          </DialogTitle>
          <DialogDescription className="text-center">
            Elegí tu usuario y entrá con tu PIN.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {users.map((u) => {
              const active = picked?.id === u.id
              return (
                <button
                  key={u.id}
                  onClick={() => {
                    setPicked(u)
                    setPin('')
                  }}
                  className={cn(
                    'group flex flex-col items-center gap-1.5 rounded-lg px-3 py-3.5',
                    'border transition-[background-color,border-color,transform,box-shadow] duration-200 ease-out-quart',
                    'active:scale-[0.97]',
                    active
                      ? 'border-primary/40 bg-primary/8 text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.2),0_4px_16px_-8px_hsl(var(--primary)/0.3)]'
                      : 'border-border/70 bg-card hover:border-border hover:bg-accent/50',
                  )}
                >
                  <div
                    className={cn(
                      'grid h-9 w-9 place-items-center rounded-full',
                      active ? 'bg-primary/15' : 'bg-muted',
                    )}
                  >
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <span className="truncate text-sm font-medium tracking-tight">
                    {u.name}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-caps text-muted-foreground">
                    {u.role === 'admin' ? 'Admin' : 'Cajero'}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="space-y-2.5">
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              placeholder="• • • •"
              className="h-14 text-center text-3xl tracking-[0.5em] num"
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
            />
            <PinPad
              value={pin}
              onChange={(s) => setPin(s.slice(0, 6))}
              onSubmit={submit}
            />
          </div>

          <Button
            onClick={submit}
            disabled={!picked || pin.length === 0 || submitting}
            className="h-12 w-full text-base tracking-tight"
          >
            <LogIn className="h-5 w-5" />
            {submitting ? 'Verificando…' : 'Entrar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
