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
      <DialogContent hideClose className="max-w-md">
        <DialogHeader>
          <div className="flex justify-center">
            <Wordmark className="text-2xl" />
          </div>
          <DialogTitle className="text-center">¿Quién va a vender?</DialogTitle>
          <DialogDescription className="text-center">
            Ingresa el PIN para iniciar sesión.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  setPicked(u)
                  setPin('')
                }}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg border-2 px-3 py-3 transition-all',
                  picked?.id === u.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card hover:bg-accent',
                )}
              >
                <UserIcon className="h-5 w-5" />
                <span className="truncate text-sm font-medium">{u.name}</span>
                <span className="text-[10px] uppercase text-muted-foreground">
                  {u.role === 'admin' ? 'Admin' : 'Cajero'}
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-2">
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
            className="h-12 w-full text-base"
          >
            <LogIn className="h-5 w-5" />
            {submitting ? 'Verificando…' : 'Entrar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
