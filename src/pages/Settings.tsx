import { useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Download,
  Network,
  Printer,
  Receipt,
  Save,
  Sparkles,
  Store,
  Upload,
  Usb,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/common/PageHeader'
import { ReceiptEditor } from '@/components/common/ReceiptEditor'
import { useToast } from '@/hooks/useToast'
import { useSession } from '@/stores/session'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type {
  DetectedPrinter,
  PrinterSettings,
  Settings as SettingsT,
  StoreSettings,
} from '@shared/types'

export function Settings() {
  const { toast } = useToast()
  const settings = useSession((s) => s.settings)
  const refresh = useSession((s) => s.refresh)
  const [appInfo, setAppInfo] = useState<{ version: string; dbPath: string; userDataPath: string } | null>(null)

  useEffect(() => {
    api.appInfo().then(setAppInfo)
  }, [])

  if (!settings) return null

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Ajustes" />
      <div className="p-6">
        <Tabs defaultValue="store">
          <TabsList>
            <TabsTrigger value="store">
              <Store className="h-4 w-4" /> Tienda
            </TabsTrigger>
            <TabsTrigger value="printer">
              <Printer className="h-4 w-4" /> Impresora
            </TabsTrigger>
            <TabsTrigger value="receipt">
              <Receipt className="h-4 w-4" /> Boleta
            </TabsTrigger>
            <TabsTrigger value="data">
              <Database className="h-4 w-4" /> Datos
            </TabsTrigger>
          </TabsList>
          <TabsContent value="store">
            <StoreTab
              settings={settings}
              onSaved={() => {
                refresh()
                toast({ variant: 'success', title: 'Tienda guardada' })
              }}
            />
          </TabsContent>
          <TabsContent value="printer">
            <PrinterTab
              settings={settings}
              onSaved={() => {
                refresh()
                toast({ variant: 'success', title: 'Impresora guardada' })
              }}
            />
          </TabsContent>
          <TabsContent value="receipt">
            <ReceiptEditor
              settings={settings}
              onSave={async (template) => {
                await api.settingsSet({ receipt_template: template })
                await refresh()
                toast({ variant: 'success', title: 'Plantilla guardada' })
              }}
            />
          </TabsContent>
          <TabsContent value="data">
            <DataTab info={appInfo} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function StoreTab({ settings, onSaved }: { settings: SettingsT; onSaved: () => void }) {
  const [form, setForm] = useState<StoreSettings>(settings.store)
  const [saving, setSaving] = useState(false)
  return (
    <div className="space-y-4">
      <Card className="card-elev">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Nombre" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="RUT" value={form.rut} onChange={(v) => setForm({ ...form, rut: v })} />
          <Field
            label="Dirección"
            value={form.address}
            onChange={(v) => setForm({ ...form, address: v })}
            className="sm:col-span-2"
          />
          <Field
            label="Teléfono"
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v })}
          />
          <Field
            label="Pie de boleta"
            value={form.receipt_footer}
            onChange={(v) => setForm({ ...form, receipt_footer: v })}
            className="sm:col-span-2"
          />
        </CardContent>
      </Card>

      <Card className="card-elev">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="flex items-center gap-2 text-sm text-foreground">Impuestos</Label>
            <p className="text-[11px] text-muted-foreground">
              Configura el IVA para que los bloques "Neto" e "IVA" de la boleta usen el porcentaje correcto.
            </p>
          </div>
          <div className="space-y-1">
            <Label>Tasa IVA (%)</Label>
            <Input
              type="number"
              min={0}
              max={50}
              value={form.tax_rate ?? 19}
              onChange={(e) =>
                setForm({ ...form, tax_rate: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })
              }
            />
          </div>
          <div className="flex items-end justify-between gap-3">
            <div className="space-y-0.5">
              <Label className="text-sm text-foreground">Precios incluyen IVA</Label>
              <p className="text-[11px] text-muted-foreground">
                ON: precio mostrado al cliente ya incluye IVA (boleta Chile). OFF: el IVA se suma encima (factura).
              </p>
            </div>
            <Switch
              checked={form.tax_inclusive ?? true}
              onCheckedChange={(v) => setForm({ ...form, tax_inclusive: v })}
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button
              disabled={saving}
              onClick={async () => {
                setSaving(true)
                try {
                  await api.settingsSet({ store: form })
                  onSaved()
                } finally {
                  setSaving(false)
                }
              }}
            >
              <Save className="h-4 w-4" /> Guardar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  className,
  type,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  className?: string
  type?: string
}) {
  return (
    <div className={`space-y-1 ${className ?? ''}`}>
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

const PRESETS: {
  id: string
  label: string
  hint: string
  apply: (p: PrinterSettings) => PrinterSettings
}[] = [
  {
    id: 'epson-tm-t20iiil-net',
    label: 'Epson TM-T20IIIL (Red)',
    hint: 'Ethernet, 80mm',
    apply: (p) => ({
      ...p,
      connection: 'network',
      interface: p.interface.startsWith('tcp://') ? p.interface : 'tcp://192.168.1.100:9100',
      width_chars: 42,
    }),
  },
  {
    id: 'epson-tm-t20iiil-usb',
    label: 'Epson TM-T20III/L (USB)',
    hint: 'USB, 80mm',
    apply: (p) => ({
      ...p,
      connection: 'usb',
      interface: p.interface.startsWith('printer:') ? p.interface : '',
      width_chars: 42,
    }),
  },
  {
    id: 'generic-58mm',
    label: 'Genérica 58mm',
    hint: '32 columnas',
    apply: (p) => ({ ...p, width_chars: 32 }),
  },
]

function isEpsonTm(name: string): boolean {
  const n = name.toUpperCase()
  return /TM-?T\d{2}/.test(n) || n.includes('EPSON')
}

function PrinterTab({ settings, onSaved }: { settings: SettingsT; onSaved: () => void }) {
  const { toast } = useToast()
  const [form, setForm] = useState<PrinterSettings>(settings.printer)
  const [printers, setPrinters] = useState<DetectedPrinter[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.printerList().then(setPrinters)
  }, [])

  const save = async () => {
    setBusy(true)
    try {
      await api.settingsSet({ printer: form })
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  const interfaceValid = (() => {
    if (!form.enabled) return true
    if (form.connection === 'usb') return form.interface.startsWith('printer:') && form.interface.length > 8
    return /^tcp:\/\/[^/:]+(:\d+)?\/?$/.test(form.interface)
  })()

  return (
    <div className="space-y-4">
      <Card className="card-elev">
        <CardContent className="space-y-1.5 p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" /> Presets
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {PRESETS.map((p) => (
              <Button
                key={p.id}
                variant="outline"
                size="sm"
                onClick={() => setForm((prev) => p.apply(prev))}
              >
                {p.id.startsWith('epson') ? <Printer className="h-3.5 w-3.5" /> : null}
                {p.label}
                <span className="text-[10px] text-muted-foreground">{p.hint}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="card-elev">
        <CardContent className="grid gap-5 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2 flex items-center justify-between">
            <div>
              <Label className="text-sm text-foreground">Impresora habilitada</Label>
              <p className="text-xs text-muted-foreground">
                Si está apagada, no se imprimen boletas ni se abre el cajón
              </p>
            </div>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => setForm({ ...form, enabled: v })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de conexión</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    connection: 'usb',
                    interface: form.interface.startsWith('printer:') ? form.interface : '',
                  })
                }
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all',
                  form.connection === 'usb'
                    ? 'border-primary bg-primary/10 text-primary shadow-glow'
                    : 'border-border bg-card hover:bg-accent/60',
                )}
              >
                <Usb className="h-4 w-4" />
                USB / Driver Windows
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    connection: 'network',
                    interface: form.interface.startsWith('tcp://')
                      ? form.interface
                      : 'tcp://192.168.1.100:9100',
                  })
                }
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all',
                  form.connection === 'network'
                    ? 'border-primary bg-primary/10 text-primary shadow-glow'
                    : 'border-border bg-card hover:bg-accent/60',
                )}
              >
                <Network className="h-4 w-4" />
                Red (TCP/IP)
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              {form.connection === 'usb' ? 'Interfaz (printer:NOMBRE)' : 'Interfaz (tcp://IP:PUERTO)'}
            </Label>
            <Input
              value={form.interface}
              onChange={(e) => setForm({ ...form, interface: e.target.value })}
              placeholder={
                form.connection === 'usb'
                  ? 'printer:EPSON TM-T20IIIL Receipt'
                  : 'tcp://192.168.1.100:9100'
              }
              className={cn(
                form.enabled && !interfaceValid && 'border-destructive/60',
              )}
            />
            {form.enabled && !interfaceValid && (
              <p className="text-[11px] text-destructive">
                {form.connection === 'usb'
                  ? 'Selecciona una impresora de la lista de abajo'
                  : 'Formato esperado: tcp://IP:PUERTO (puerto típico 9100)'}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Ancho de papel (caracteres)</Label>
            <Select
              value={String(form.width_chars)}
              onValueChange={(v) => setForm({ ...form, width_chars: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="32">58 mm — 32 columnas</SelectItem>
                <SelectItem value="42">80 mm — 42 columnas (Epson TM-T20)</SelectItem>
                <SelectItem value="48">80 mm — 48 columnas</SelectItem>
                <SelectItem value="56">80 mm — 56 columnas (Font B)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-foreground">Imprimir boleta automáticamente</Label>
              <p className="text-xs text-muted-foreground">Tras cada cobro</p>
            </div>
            <Switch
              checked={form.auto_print}
              onCheckedChange={(v) => setForm({ ...form, auto_print: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-foreground">Abrir cajón en efectivo</Label>
              <p className="text-xs text-muted-foreground">Pulso DK al cobrar en efectivo</p>
            </div>
            <Switch
              checked={form.open_drawer_on_cash}
              onCheckedChange={(v) => setForm({ ...form, open_drawer_on_cash: v })}
            />
          </div>

          <div className="sm:col-span-2 flex items-center justify-between rounded-md border border-border/40 bg-muted/30 px-3 py-2">
            <div>
              <Label className="text-sm text-foreground">Imprimir copia para la tienda</Label>
              <p className="text-xs text-muted-foreground">
                Sale una segunda boleta con encabezado "COPIA TIENDA". Gasta el doble de papel.
              </p>
            </div>
            <Switch
              checked={form.extra_copy}
              onCheckedChange={(v) => setForm({ ...form, extra_copy: v })}
            />
          </div>

          <div className="sm:col-span-2 flex flex-wrap items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              disabled={busy || !form.enabled}
              onClick={async () => {
                await api.settingsSet({ printer: form })
                const r = await api.printerOpenDrawer()
                if (r.ok) toast({ variant: 'success', title: 'Cajón abierto' })
                else
                  toast({ variant: 'destructive', title: 'No se pudo abrir', description: r.error })
              }}
            >
              Abrir cajón
            </Button>
            <Button
              variant="outline"
              disabled={busy || !form.enabled || !interfaceValid}
              onClick={async () => {
                await api.settingsSet({ printer: form })
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
            <Button onClick={save} disabled={busy}>
              <Save className="h-4 w-4" /> Guardar
            </Button>
          </div>
        </CardContent>
      </Card>

      {form.connection === 'usb' && (
        <Card className="card-elev">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Impresoras detectadas en Windows
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => setPrinters(await api.printerList())}
              >
                Refrescar
              </Button>
            </div>
            {printers.length === 0 ? (
              <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                <div className="flex items-center gap-2 font-medium">
                  <AlertCircle className="h-4 w-4" /> Ninguna impresora detectada
                </div>
                <p className="mt-1 text-xs">
                  Instala el driver Epson Advanced Printer Driver para tu TM-T20IIIL en Windows y vuelve a refrescar.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/50">
                {printers.map((p) => {
                  const iface = `printer:${p.name}`
                  const active = form.interface === iface
                  const recommended = isEpsonTm(p.name)
                  return (
                    <li
                      key={p.name}
                      className={cn(
                        'flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-accent/40',
                        active && 'bg-primary/10',
                      )}
                      onClick={() =>
                        setForm({ ...form, connection: 'usb', interface: iface })
                      }
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{p.name}</span>
                          {recommended && (
                            <Badge variant="success" className="shrink-0">
                              Recomendada
                            </Badge>
                          )}
                          {p.isDefault && (
                            <Badge variant="secondary" className="shrink-0">
                              Predeterminada
                            </Badge>
                          )}
                        </div>
                        {(p.driver || p.port) && (
                          <div className="mono text-[11px] text-muted-foreground">
                            {[p.driver, p.port].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                      {active && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {form.connection === 'network' && (
        <Card className="card-elev">
          <CardContent className="p-5 text-sm">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Network className="h-3.5 w-3.5" /> Modo red
            </div>
            <ul className="space-y-1.5 text-muted-foreground">
              <li>
                1. La impresora y el PC deben estar en la misma red. Verifica con el cable Ethernet conectado.
              </li>
              <li>
                2. Imprime un autotest manteniendo el botón <span className="mono">FEED</span> al
                encender la impresora — saldrá la IP impresa.
              </li>
              <li>
                3. Escribe la IP arriba en formato <span className="mono">tcp://IP:9100</span> y
                presiona Imprimir prueba.
              </li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function DataTab({ info }: { info: { version: string; dbPath: string; userDataPath: string } | null }) {
  const { toast } = useToast()
  return (
    <div className="space-y-4">
      <Card className="card-elev">
        <CardContent className="grid gap-3 p-5 text-sm">
          <Row k="Versión" v={info?.version ?? '—'} />
          <Row k="Base de datos" v={info?.dbPath ?? '—'} />
          <Row k="Datos de usuario" v={info?.userDataPath ?? '—'} />
        </CardContent>
      </Card>
      <Card className="card-elev">
        <CardContent className="space-y-3 p-5">
          <div>
            <div className="font-semibold">Respaldo</div>
            <p className="text-xs text-muted-foreground">
              Guarda una copia de tu base de datos. Hazlo periódicamente.
            </p>
          </div>
          <Separator />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={async () => {
                const r = await api.backupExport()
                if (r) toast({ variant: 'success', title: 'Respaldo guardado', description: r.path })
              }}
            >
              <Download className="h-4 w-4" /> Descargar respaldo
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const r = await api.backupImport()
                if (r) toast({ variant: 'success', title: 'Respaldo restaurado', description: r.path })
              }}
            >
              <Upload className="h-4 w-4" /> Restaurar respaldo
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{k}</span>
      <span className="mono break-all text-right text-xs">{v}</span>
    </div>
  )
}
