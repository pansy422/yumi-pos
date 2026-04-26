import { useEffect, useState } from 'react'
import { ArrowRight, Check, Printer, Store } from 'lucide-react'
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
import { Numpad } from './Numpad'
import { MoneyInput } from './MoneyInput'
import { useToast } from '@/hooks/useToast'
import { useSession } from '@/stores/session'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatCLP } from '@shared/money'
import type { DetectedPrinter, PrinterSettings, StoreSettings } from '@shared/types'

const STEPS = ['welcome', 'store', 'printer', 'cash'] as const
type Step = (typeof STEPS)[number]

export function FirstRunWizard() {
  const settings = useSession((s) => s.settings)
  const cash = useSession((s) => s.cash)
  const refresh = useSession((s) => s.refresh)
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('welcome')

  const [store, setStore] = useState<StoreSettings | null>(null)
  const [printer, setPrinter] = useState<PrinterSettings | null>(null)
  const [openingAmount, setOpeningAmount] = useState(0)
  const [printers, setPrinters] = useState<DetectedPrinter[]>([])

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
    await api.settingsSet({ flags: { onboarded: true } })
    await refresh()
    setOpen(false)
    toast({ variant: 'success', title: '¡Listo para vender!' })
  }

  const total = STEPS.length
  const idx = STEPS.indexOf(step)

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
        <div className="border-b bg-gradient-to-br from-brand-1/10 via-transparent to-brand-2/10 px-8 py-6">
          <div className="flex items-center gap-3">
            <div>
              <DialogTitle className="text-xl">Configuremos Yumi POS</DialogTitle>
              <DialogDescription>3 pasos rápidos y empiezas a vender</DialogDescription>
            </div>
            <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              {STEPS.map((s, i) => (
                <span
                  key={s}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i <= idx ? 'w-8 bg-primary' : 'w-4 bg-muted',
                  )}
                />
              ))}
              <span className="ml-2 num">
                {idx + 1}/{total}
              </span>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 min-h-[360px]">
          {step === 'welcome' && (
            <div className="flex flex-col items-center justify-center gap-4 py-8 text-center animate-fade-in">
              <Wordmark className="text-3xl" />
              <h2 className="text-xl font-semibold">Bienvenido</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Vamos a configurar tu tienda, conectar la impresora y abrir tu primera caja.
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
                Si no tienes impresora todavía, puedes saltar este paso
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
                    <Label>Selecciona una impresora detectada</Label>
                    <div className="max-h-40 overflow-auto rounded-md border">
                      {printers.length === 0 ? (
                        <p className="px-3 py-3 text-sm text-muted-foreground">
                          No se detectaron impresoras. Puedes editar manualmente la interfaz luego.
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

          {step === 'cash' && (
            <div className="grid gap-4 sm:grid-cols-2 animate-fade-in">
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Apertura de caja: ¿con cuánto efectivo arrancas?
                </div>
                <div className="rounded-lg border bg-muted/30 p-4 text-center">
                  <div className="text-xs uppercase text-muted-foreground">Monto inicial</div>
                  <div className="num text-3xl font-bold">{formatCLP(openingAmount)}</div>
                </div>
                <MoneyInput value={openingAmount} onValueChange={setOpeningAmount} />
                {cash && (
                  <p className="text-xs text-warning">
                    Ya tienes una caja abierta — se mantiene la actual.
                  </p>
                )}
              </div>
              <Numpad value={openingAmount} onChange={setOpeningAmount} />
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
            {step !== 'welcome' && step !== 'cash' && (
              <Button variant="outline" onClick={() => setStep(STEPS[idx + 1])}>
                Saltar
              </Button>
            )}
            {step === 'welcome' ? (
              <Button onClick={() => setStep('store')}>
                Empezar <ArrowRight className="h-4 w-4" />
              </Button>
            ) : step === 'cash' ? (
              <Button
                variant="success"
                onClick={async () => {
                  await api.settingsSet({ store, printer })
                  if (!cash && openingAmount >= 0) {
                    try {
                      await api.cashOpen(openingAmount, 'Apertura inicial')
                    } catch {
                      // ignore — user can open later
                    }
                  }
                  await finish()
                }}
              >
                Terminar y vender <Check className="h-4 w-4" />
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
