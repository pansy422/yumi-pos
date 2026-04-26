import { useEffect, useState } from 'react'
import { Database, Download, Printer, Save, Store, Upload } from 'lucide-react'
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
import { PageHeader } from '@/components/common/PageHeader'
import { useToast } from '@/hooks/useToast'
import { useSession } from '@/stores/session'
import { api } from '@/lib/api'
import type { DetectedPrinter, PrinterSettings, Settings as SettingsT, StoreSettings } from '@shared/types'

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
    <Card>
      <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
        <Field label="Nombre" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Field label="RUT" value={form.rut} onChange={(v) => setForm({ ...form, rut: v })} />
        <Field label="Dirección" value={form.address} onChange={(v) => setForm({ ...form, address: v })} className="sm:col-span-2" />
        <Field label="Teléfono" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <Field
          label="Pie de boleta"
          value={form.receipt_footer}
          onChange={(v) => setForm({ ...form, receipt_footer: v })}
          className="sm:col-span-2"
        />
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
  )
}

function Field({
  label,
  value,
  onChange,
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <div className={`space-y-1 ${className ?? ''}`}>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
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

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2 flex items-center justify-between">
            <div>
              <Label>Impresora habilitada</Label>
              <p className="text-xs text-muted-foreground">
                Si está apagada, no se imprimen boletas
              </p>
            </div>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => setForm({ ...form, enabled: v })}
            />
          </div>
          <div className="space-y-1">
            <Label>Tipo de conexión</Label>
            <Select
              value={form.connection}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  connection: v as PrinterSettings['connection'],
                  interface: v === 'usb' ? 'printer:auto' : 'tcp://192.168.0.10:9100',
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="usb">USB</SelectItem>
                <SelectItem value="network">Red (IP)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>
              Interfaz {form.connection === 'usb' ? '(printer:NOMBRE)' : '(tcp://IP:9100)'}
            </Label>
            <Input
              value={form.interface}
              onChange={(e) => setForm({ ...form, interface: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Ancho (caracteres)</Label>
            <Input
              type="number"
              value={form.width_chars}
              onChange={(e) =>
                setForm({ ...form, width_chars: Math.max(16, Number(e.target.value) || 32) })
              }
            />
          </div>
          <div className="space-y-1 flex items-center justify-between">
            <Label>Imprimir boleta automáticamente</Label>
            <Switch
              checked={form.auto_print}
              onCheckedChange={(v) => setForm({ ...form, auto_print: v })}
            />
          </div>
          <div className="space-y-1 flex items-center justify-between">
            <Label>Abrir cajón en efectivo</Label>
            <Switch
              checked={form.open_drawer_on_cash}
              onCheckedChange={(v) => setForm({ ...form, open_drawer_on_cash: v })}
            />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                const r = await api.printerOpenDrawer()
                if (r.ok) toast({ variant: 'success', title: 'Cajón abierto' })
                else toast({ variant: 'destructive', title: 'No se pudo abrir', description: r.error })
              }}
            >
              Abrir cajón
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                const r = await api.printerTest()
                if (r.ok) toast({ variant: 'success', title: 'Prueba enviada' })
                else
                  toast({ variant: 'destructive', title: 'No se pudo imprimir', description: r.error })
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

      <Card>
        <CardContent className="p-4">
          <div className="mb-2 text-xs uppercase text-muted-foreground">
            Impresoras detectadas en Windows
          </div>
          {printers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguna impresora detectada.</p>
          ) : (
            <ul className="divide-y">
              {printers.map((p) => (
                <li
                  key={p.name}
                  className="flex cursor-pointer items-center justify-between py-2 text-sm hover:bg-accent/40 rounded px-2"
                  onClick={() =>
                    setForm({ ...form, connection: 'usb', interface: `printer:${p.name}` })
                  }
                >
                  <span>{p.name}</span>
                  {p.isDefault && <span className="text-xs text-primary">predeterminada</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DataTab({ info }: { info: { version: string; dbPath: string; userDataPath: string } | null }) {
  const { toast } = useToast()
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 p-4 text-sm">
          <Row k="Versión" v={info?.version ?? '—'} />
          <Row k="Base de datos" v={info?.dbPath ?? '—'} />
          <Row k="Datos de usuario" v={info?.userDataPath ?? '—'} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 p-4">
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
      <span className="font-mono text-xs break-all text-right">{v}</span>
    </div>
  )
}
