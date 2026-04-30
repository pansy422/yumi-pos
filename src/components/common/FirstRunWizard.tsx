import { useEffect, useState } from 'react'
import { ArrowRight, Check, Printer, Store, UserCog } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Wordmark } from '@/components/brand/Logo'
import { useToast } from '@/hooks/useToast'
import { useSession } from '@/stores/session'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { DetectedPrinter, PrinterSettings, StoreSettings } from '@shared/types'

const STEPS = ['welcome', 'store', 'printer', 'admin'] as const
type Step = (typeof STEPS)[number]

export function FirstRunWizard() {
  const settings = useSession((s) => s.settings)
  const refresh = useSession((s) => s.refresh)
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('welcome')

  const [store, setStore] = useState<StoreSettings | null>(null)
  const [printer, setPrinter] = useState<PrinterSettings | null>(null)
  const [printers, setPrinters] = useState<DetectedPrinter[]>([])

  // Admin inicial — para que la primera caja siempre quede asignada al
  // dueño. Antes el wizard abría la caja sin cajero (porque todavía no
  // había users), generando "caja huérfana": abierta sin dueño,
  // ventas sin asignar. El nuevo flujo es: configurar tienda → configurar
  // impresora → crear admin → cerrar wizard. La caja la abre el admin
  // después de loguearse desde Caja → Abrir caja, ya con su nombre.
  const [adminName, setAdminName] = useState('')
  const [adminPin, setAdminPin] = useState('')
  const [savingAdmin, setSavingAdmin] = useState(false)

  useEffect(() => {
    if (!settings) return
    if (!settings.flags.onboarded) {
      setStore(settings.store)
      setPrinter(settings.printer)
      setOpen(true)
      api.printerList().then(setPrinters)
    }
  }, [settings])

  if (!settings || !store || !printer) return null

  const finish = async () => {
    await api.settingsSet({
      flags: { ...(settings.flags ?? { theme: 'light' }), onboarded: true },
    })
    await refresh()
    setOpen(false)
    toast({ variant: 'success', title: '¡Listo para vender!' })
  }

  const total = STEPS.length
  const idx = STEPS.indexOf(step)
  const adminPinValid = /^\d{4,6}$/.test(adminPin)
  const canFinish = adminName.trim().length > 0 && adminPinValid

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) finish()
      }}
    >
      <DialogContent
        hideClose
        className="max-w-2xl overflow-hidden p-0"
      >
        <div className="mesh-bg border-b border-border/60 bg-card px-8 py-6">
          <div className="flex items-center gap-3">
            <div>
              <DialogTitle className="text-xl tracking-display-tight">
                Configuremos Yumi POS
              </DialogTitle>
              <DialogDescription className="mt-1">
                3 pasos rápidos y arrancás a vender.
              </DialogDescription>
            </div>
            <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              {STEPS.map((s, i) => (
                <span
                  key={s}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300 ease-out-quart',
                    i <= idx
                      ? 'w-8 brand-gradient'
                      : 'w-4 bg-muted',
                  )}
                />
              ))}
              <span className="num ml-2 font-medium tracking-tight">
                {idx + 1}/{total}
              </span>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 min-h-[360px]">
          {step === 'welcome' && (
            <div className="flex flex-col items-center justify-center gap-5 py-12 text-center animate-fade-in">
              <Wordmark className="text-3xl" />
              <h2 className="font-display text-2xl font-semibold tracking-display-tight">
                Hola
              </h2>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                Configurá tu tienda, conectá la impresora y creá tu usuario admin.
                Toma menos de 2 minutos.
              </p>
            </div>
          )}

          {step === 'store' && (
            <div className="grid gap-4 sm:grid-cols-2 animate-fade-in">
              <div className="sm:col-span-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Store className="h-4 w-4 text-primary" />
                Datos que saldrán impresos en cada boleta
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Nombre de la tienda *</Label>
                <Input
                  autoFocus
                  value={store.name}
                  onChange={(e) => setStore({ ...store, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>RUT</Label>
                <Input
                  value={store.rut}
                  onChange={(e) => setStore({ ...store, rut: e.target.value })}
                  placeholder="12.345.678-9"
                />
              </div>
              <div className="space-y-1">
                <Label>Teléfono</Label>
                <Input
                  value={store.phone}
                  onChange={(e) => setStore({ ...store, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Dirección</Label>
                <Input
                  value={store.address}
                  onChange={(e) => setStore({ ...store, address: e.target.value })}
                />
              </div>
            </div>
          )}

          {step === 'printer' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Printer className="h-4 w-4 text-primary" />
                Si no tenés impresora todavía, podés saltar este paso
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-card p-4">
                <div>
                  <Label>Impresora habilitada</Label>
                  <p className="text-xs text-muted-foreground">Imprime boletas y abre el cajón</p>
                </div>
                <Switch
                  checked={printer.enabled}
                  onCheckedChange={(v) => setPrinter({ ...printer, enabled: v })}
                />
              </div>
              {printer.enabled && (
                <>
                  <div className="space-y-1">
                    <Label>Seleccioná una impresora detectada</Label>
                    <div className="max-h-40 overflow-auto rounded-md border">
                      {printers.length === 0 ? (
                        <p className="px-3 py-3 text-sm text-muted-foreground">
                          No se detectaron impresoras. Podés editar manualmente la interfaz luego.
                        </p>
                      ) : (
                        <ul className="divide-y">
                          {printers.map((p) => {
                            const iface = `printer:${p.name}`
                            const active = printer.interface === iface
                            return (
                              <li
                                key={p.name}
                                onClick={() =>
                                  setPrinter({ ...printer, connection: 'usb', interface: iface })
                                }
                                className={cn(
                                  'flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-accent/40',
                                  active && 'bg-primary/10',
                                )}
                              >
                                <span>{p.name}</span>
                                {active ? (
                                  <Check className="h-4 w-4 text-primary" />
                                ) : (
                                  p.isDefault && <span className="text-xs text-primary">predeterminada</span>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await api.settingsSet({ printer })
                      const r = await api.printerTest()
                      if (r.ok) toast({ variant: 'success', title: 'Prueba enviada' })
                      else
                        toast({
                          variant: 'destructive',
                          title: 'No se pudo imprimir',
                          description: r.error,
                        })
                    }}
                  >
                    Imprimir prueba
                  </Button>
                </>
              )}
            </div>
          )}

          {step === 'admin' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <UserCog className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <div className="text-foreground">Tu usuario administrador</div>
                  <p className="mt-0.5 text-[12px] leading-relaxed">
                    Sin un usuario no se pueden cobrar ventas a nombre de nadie ni
                    abrir caja. Creá el tuyo ahora — después podés agregar más
                    cajeros desde Ajustes → Usuarios.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Tu nombre *</Label>
                  <Input
                    autoFocus
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="ej. Vicente"
                  />
                </div>
                <div className="space-y-1">
                  <Label>PIN de 4 a 6 dígitos *</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={adminPin}
                    onChange={(e) =>
                      setAdminPin(e.target.value.replace(/[^\d]/g, '').slice(0, 6))
                    }
                    placeholder="• • • •"
                    className="num text-center text-xl tracking-[0.4em]"
                  />
                  {adminPin.length > 0 && !adminPinValid && (
                    <p className="text-[11px] text-warning">Solo dígitos, entre 4 y 6.</p>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-[11px] text-muted-foreground">
                <strong className="text-foreground">Tip:</strong> al cerrar este
                asistente, la app te va a pedir el PIN para entrar. Anotalo en
                un lugar seguro — si lo perdés tenés que reinstalar.
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t bg-card/40 px-8 py-4">
          <Button
            variant="ghost"
            disabled={step === 'welcome'}
            onClick={() => setStep(STEPS[Math.max(0, idx - 1)])}
          >
            Atrás
          </Button>
          <div className="flex items-center gap-2">
            {step !== 'welcome' && step !== 'admin' && (
              <Button variant="outline" onClick={() => setStep(STEPS[idx + 1])}>
                Saltar
              </Button>
            )}
            {step === 'welcome' ? (
              <Button onClick={() => setStep('store')}>
                Empezar <ArrowRight className="h-4 w-4" />
              </Button>
            ) : step === 'admin' ? (
              <Button
                variant="success"
                disabled={!canFinish || savingAdmin}
                onClick={async () => {
                  setSavingAdmin(true)
                  try {
                    await api.settingsSet({ store, printer })
                    await api.usersSave({
                      name: adminName.trim(),
                      pin: adminPin,
                      role: 'admin',
                      active: true,
                    })
                    await finish()
                  } catch (err) {
                    toast({
                      variant: 'destructive',
                      title: 'No se pudo crear el usuario',
                      description: err instanceof Error ? err.message : String(err),
                    })
                  } finally {
                    setSavingAdmin(false)
                  }
                }}
              >
                {savingAdmin ? 'Creando…' : 'Terminar y entrar'}{' '}
                <Check className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={async () => {
                  if (step === 'store') await api.settingsSet({ store })
                  if (step === 'printer') await api.settingsSet({ printer })
                  setStep(STEPS[idx + 1])
                }}
              >
                Continuar <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
