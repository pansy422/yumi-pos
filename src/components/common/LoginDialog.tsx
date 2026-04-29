import * as React from 'react'
import { LogIn, Power, User as UserIcon } from 'lucide-react'
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
 * Login takeover de pantalla completa. Se monta cuando hay usuarios
 * creados y no hay sesión activa. Cubre TODA la app — diferente al
 * Dialog modal anterior que dejaba ver fantasma del POS detrás y se
 * veía perdido en pantallas grandes.
 *
 * Si no hay ningún usuario, no se muestra: el sistema queda en modo
 * "single-user" como antes.
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

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-background animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      {/* Mesh de fondo a pantalla completa: dos manchas radiales
          blureadas y una capa con vibrancy. Bloquea todo lo que esté
          detrás (POS, sidebar) → no más "ghost UI" visible. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-[10%] -top-[15%] h-[55%] w-[55%] rounded-full opacity-50"
          style={{
            background:
              'radial-gradient(circle, hsl(168 85% 60% / 0.55), transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          className="absolute -bottom-[20%] -right-[10%] h-[60%] w-[60%] rounded-full opacity-45"
          style={{
            background:
              'radial-gradient(circle, hsl(280 80% 65% / 0.55), transparent 70%)',
            filter: 'blur(90px)',
          }}
        />
        <div
          className="absolute right-[10%] top-[5%] h-[28%] w-[28%] rounded-full opacity-30"
          style={{
            background:
              'radial-gradient(circle, hsl(220 90% 60% / 0.5), transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
      </div>

      {/* Botón de salida — cierra la app de Electron. Acá la cajera
          siempre tiene una salida si se equivocó al hacer logout y no
          sabe ningún PIN. */}
      <button
        onClick={() => {
          const wc = (window as unknown as { winControls?: { close: () => void } })
            .winControls
          if (wc?.close) wc.close()
          else window.close()
        }}
        className={cn(
          'absolute right-6 top-6 grid h-10 w-10 place-items-center rounded-full',
          'border border-border/60 bg-card/80 text-muted-foreground backdrop-blur-md',
          'transition-[background-color,color,transform] duration-150 ease-out-quart',
          'hover:bg-card hover:text-foreground active:scale-[0.92]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
        title="Cerrar la app"
      >
        <Power className="h-4 w-4" />
      </button>

      <div className="relative z-10 w-full max-w-md animate-scale-in p-6">
        <div className="rounded-2xl border border-border/60 bg-card/85 p-6 shadow-[0_24px_64px_-16px_hsl(var(--shadow-color)/0.25),0_4px_16px_-8px_hsl(var(--shadow-color)/0.15)] backdrop-blur-xl backdrop-saturate-150">
          <div className="flex flex-col items-center gap-3">
            <Wordmark className="text-2xl" />
            <h2 className="text-center text-xl font-semibold tracking-display-tight">
              ¿Quién va a vender?
            </h2>
            <p className="text-center text-sm text-muted-foreground">
              Elegí tu usuario y entrá con tu PIN.
            </p>
          </div>

          <div className="mt-5 space-y-5">
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

            <div className={cn('glow-rainbow', pin.length > 0 && 'is-active')}>
              <Button
                onClick={submit}
                disabled={!picked || pin.length === 0 || submitting}
                className="shimmer-sweep relative h-12 w-full overflow-hidden text-base tracking-tight"
              >
                <LogIn className="h-5 w-5" />
                {submitting ? 'Verificando…' : 'Entrar'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
