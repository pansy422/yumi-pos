import * as React from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  Copy,
  Download,
  FileJson,
  Plus,
  RotateCcw,
  Trash2,
  Type,
  Upload,
  Wand2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { ReceiptPreview } from './ReceiptPreview'
import { sampleSale } from './sampleSale'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import {
  BLOCK_LABELS,
  DEFAULT_TEMPLATE,
  PRESETS,
  isValidTemplate,
  type Align,
  type ReceiptBlock,
  type ReceiptTemplate,
  type ShowWhen,
  type Size,
} from '@shared/template'
import type { Settings } from '@shared/types'

const ALIGN_ICON: Record<Align, React.ReactNode> = {
  left: <AlignLeft className="h-3.5 w-3.5" />,
  center: <AlignCenter className="h-3.5 w-3.5" />,
  right: <AlignRight className="h-3.5 w-3.5" />,
}

const SHOW_LABEL: Record<ShowWhen, string> = {
  always: 'Siempre',
  cash: 'Solo si pagó en efectivo',
  has_discount: 'Solo si hubo descuento',
  has_change: 'Solo si hubo vuelto',
}

const ADDABLE_TYPES: ReceiptBlock['type'][] = [
  'text',
  'separator',
  'spacer',
  'store_name',
  'address',
  'rut',
  'phone',
  'sale_number_and_date',
  'sale_number',
  'date',
  'items',
  'subtotal',
  'discount',
  'total',
  'payment_method',
  'cash_received',
  'change_given',
]

function uid(): string {
  return 'b_' + Math.random().toString(36).slice(2, 8)
}

function createBlock(type: ReceiptBlock['type']): ReceiptBlock {
  const id = uid()
  switch (type) {
    case 'text':
      return { id, type: 'text', value: 'Mensaje', align: 'center' }
    case 'separator':
      return { id, type: 'separator', char: '-' }
    case 'spacer':
      return { id, type: 'spacer', lines: 1 }
    default:
      return { id, type } as ReceiptBlock
  }
}

export function ReceiptEditor({
  settings,
  onSave,
}: {
  settings: Settings
  onSave: (template: ReceiptTemplate) => Promise<void>
}) {
  const { toast } = useToast()
  const [template, setTemplate] = React.useState<ReceiptTemplate>(settings.receipt_template)
  const [editing, setEditing] = React.useState<string | null>(null)
  const [importDlg, setImportDlg] = React.useState(false)
  const [importText, setImportText] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const dirty = JSON.stringify(template) !== JSON.stringify(settings.receipt_template)

  const update = (id: string, patch: Partial<ReceiptBlock>) => {
    setTemplate((t) => ({
      ...t,
      blocks: t.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as ReceiptBlock) : b)),
    }))
  }

  const move = (id: string, dir: -1 | 1) => {
    setTemplate((t) => {
      const idx = t.blocks.findIndex((b) => b.id === id)
      if (idx < 0) return t
      const j = idx + dir
      if (j < 0 || j >= t.blocks.length) return t
      const copy = [...t.blocks]
      ;[copy[idx], copy[j]] = [copy[j], copy[idx]]
      return { ...t, blocks: copy }
    })
  }

  const remove = (id: string) =>
    setTemplate((t) => ({ ...t, blocks: t.blocks.filter((b) => b.id !== id) }))

  const duplicate = (id: string) =>
    setTemplate((t) => {
      const idx = t.blocks.findIndex((b) => b.id === id)
      if (idx < 0) return t
      const orig = t.blocks[idx]
      const copy = [...t.blocks]
      copy.splice(idx + 1, 0, { ...orig, id: uid() })
      return { ...t, blocks: copy }
    })

  const add = (type: ReceiptBlock['type']) =>
    setTemplate((t) => ({ ...t, blocks: [...t.blocks, createBlock(type)] }))

  const reset = () => setTemplate(DEFAULT_TEMPLATE)

  const [presetKey, setPresetKey] = React.useState(0)

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)
    if (p) setTemplate(p.template)
    // El dropdown es para "aplicar un preset" (acción), no para mostrar
    // el preset actual. Forzamos remount para que vuelva al placeholder
    // "Aplicar preset" en vez de quedarse mostrando el último elegido
    // (que se desbordaba sobre el borde del trigger).
    setPresetKey((k) => k + 1)
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla-boleta-yumi-pos.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importText)
      if (!isValidTemplate(parsed)) throw new Error('Formato inválido')
      setTemplate(parsed)
      setImportDlg(false)
      setImportText('')
      toast({ variant: 'success', title: 'Plantilla cargada' })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'No se pudo importar',
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(template)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
      <div className="space-y-3 min-w-0">
        <Card className="card-elev">
          <CardContent className="flex flex-wrap items-center gap-2 p-4">
            <Select key={presetKey} onValueChange={applyPreset}>
              <SelectTrigger className="w-48">
                <Wand2 className="h-3.5 w-3.5" />
                <SelectValue placeholder="Aplicar preset" />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id} textValue={p.label}>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm">{p.label}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {p.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5" /> Restaurar default
            </Button>
            <Button variant="outline" size="sm" onClick={exportJson}>
              <Download className="h-3.5 w-3.5" /> Exportar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportDlg(true)}>
              <Upload className="h-3.5 w-3.5" /> Importar
            </Button>
            <div className="ml-auto flex items-center gap-2">
              {dirty && <Badge variant="warning">Sin guardar</Badge>}
              <Button onClick={handleSave} disabled={saving || !dirty}>
                {saving ? 'Guardando…' : 'Guardar plantilla'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elev">
          <CardContent className="p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
                Bloques ({template.blocks.length})
              </div>
              <AddBlockMenu onAdd={add} />
            </div>
            <ul className="space-y-1.5">
              {template.blocks.map((b, idx) => (
                <BlockRow
                  key={b.id}
                  block={b}
                  isFirst={idx === 0}
                  isLast={idx === template.blocks.length - 1}
                  isOpen={editing === b.id}
                  onToggleOpen={() => setEditing((cur) => (cur === b.id ? null : b.id))}
                  onMoveUp={() => move(b.id, -1)}
                  onMoveDown={() => move(b.id, +1)}
                  onDuplicate={() => duplicate(b.id)}
                  onRemove={() => remove(b.id)}
                  onChange={(patch) => update(b.id, patch)}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <Card className="card-elev">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-caps text-muted-foreground">
              <Type className="h-3.5 w-3.5" /> Vista previa en vivo
            </div>
            <ReceiptPreview
              sale={sampleSale()}
              store={settings.store}
              template={template}
              width={settings.printer.width_chars > 0 ? settings.printer.width_chars : 42}
            />
            <p className="mt-2 text-[11px] text-muted-foreground">
              Boleta de muestra. La impresora rendiriza casi idéntico (espaciado depende del ancho real del papel).
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={importDlg} onOpenChange={setImportDlg}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Importar plantilla</DialogTitle>
            <DialogDescription>
              Pega el JSON exportado previamente. Se reemplaza la plantilla actual.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            className="mono h-64 w-full resize-none rounded-md border border-input bg-background p-3 text-xs"
            placeholder='{"version":1,"blocks":[…]}'
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDlg(false)}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={!importText.trim()}>
              <FileJson className="h-4 w-4" /> Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AddBlockMenu({ onAdd }: { onAdd: (t: ReceiptBlock['type']) => void }) {
  return (
    <Select onValueChange={(v) => onAdd(v as ReceiptBlock['type'])} value="">
      <SelectTrigger className="w-44">
        <Plus className="h-3.5 w-3.5" />
        <SelectValue placeholder="Agregar bloque" />
      </SelectTrigger>
      <SelectContent>
        {ADDABLE_TYPES.map((t) => (
          <SelectItem key={t} value={t}>
            {BLOCK_LABELS[t]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function BlockRow({
  block,
  isFirst,
  isLast,
  isOpen,
  onToggleOpen,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onRemove,
  onChange,
}: {
  block: ReceiptBlock
  isFirst: boolean
  isLast: boolean
  isOpen: boolean
  onToggleOpen: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDuplicate: () => void
  onRemove: () => void
  onChange: (patch: Partial<ReceiptBlock>) => void
}) {
  const align = block.align ?? 'left'
  const summary = blockSummary(block)
  return (
    <li
      className={cn(
        'rounded-lg border border-border/60 bg-card/50 transition-colors',
        isOpen && 'border-primary/40 bg-primary/5',
      )}
    >
      <div
        className="flex items-center gap-2 p-2 cursor-pointer"
        onClick={onToggleOpen}
      >
        <div className="flex flex-col">
          <button
            disabled={isFirst}
            onClick={(e) => {
              e.stopPropagation()
              onMoveUp()
            }}
            className="rounded p-0.5 hover:bg-accent disabled:opacity-20"
          >
            <ArrowUp className="h-3 w-3" />
          </button>
          <button
            disabled={isLast}
            onClick={(e) => {
              e.stopPropagation()
              onMoveDown()
            }}
            className="rounded p-0.5 hover:bg-accent disabled:opacity-20"
          >
            <ArrowDown className="h-3 w-3" />
          </button>
        </div>
        <Badge variant="secondary" className="px-1.5 py-0">
          {ALIGN_ICON[align]}
        </Badge>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{BLOCK_LABELS[block.type]}</span>
            {block.bold && <Bold className="h-3 w-3 text-muted-foreground" />}
            {block.size && block.size !== 'normal' && (
              <span className="text-[10px] uppercase text-muted-foreground">
                {block.size === 'large' ? 'Grande' : 'XL'}
              </span>
            )}
            {block.show && block.show !== 'always' && (
              <Badge variant="outline" className="text-[10px]">
                {SHOW_LABEL[block.show]}
              </Badge>
            )}
          </div>
          {summary && (
            <div className="mono truncate text-[11px] text-muted-foreground">{summary}</div>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDuplicate()
          }}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Duplicar"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          title="Eliminar"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {isOpen && <BlockEditor block={block} onChange={onChange} />}
    </li>
  )
}

function blockSummary(b: ReceiptBlock): string | null {
  if (b.type === 'text') return `"${b.value}"`
  if (b.type === 'spacer') return `${b.lines ?? 1} línea(s)`
  if (b.type === 'separator') return `Carácter "${b.char ?? '-'}"`
  return null
}

function BlockEditor({
  block,
  onChange,
}: {
  block: ReceiptBlock
  onChange: (patch: Partial<ReceiptBlock>) => void
}) {
  return (
    <div className="space-y-3 border-t border-border/40 p-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-caps">Alineación</Label>
          <div className="flex overflow-hidden rounded-md border border-border">
            {(['left', 'center', 'right'] as Align[]).map((a) => (
              <button
                key={a}
                onClick={() => onChange({ align: a })}
                className={cn(
                  'flex-1 px-2 py-1.5 transition-colors',
                  (block.align ?? 'left') === a
                    ? 'bg-primary/15 text-primary'
                    : 'hover:bg-accent',
                )}
              >
                {ALIGN_ICON[a]}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-caps">Tamaño</Label>
          <Select
            value={block.size ?? 'normal'}
            onValueChange={(v) => onChange({ size: v as Size })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="large">Grande (doble alto)</SelectItem>
              <SelectItem value="xl">XL (doble alto y ancho)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-caps">Negrita</Label>
          <div className="flex h-9 items-center">
            <Switch
              checked={!!block.bold}
              onCheckedChange={(v) => onChange({ bold: v })}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-caps">Mostrar</Label>
          <Select
            value={block.show ?? 'always'}
            onValueChange={(v) => onChange({ show: v as ShowWhen })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="always">{SHOW_LABEL.always}</SelectItem>
              <SelectItem value="cash">{SHOW_LABEL.cash}</SelectItem>
              <SelectItem value="has_discount">{SHOW_LABEL.has_discount}</SelectItem>
              <SelectItem value="has_change">{SHOW_LABEL.has_change}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {block.type === 'text' && (
        <div className="space-y-1">
          <Label>Texto</Label>
          <Input
            value={block.value}
            onChange={(e) => onChange({ value: e.target.value } as Partial<ReceiptBlock>)}
          />
          <p className="text-[11px] text-muted-foreground">
            Variables disponibles: <span className="mono">{'{{store_name}} {{rut}} {{address}} {{phone}} {{footer}} {{number}} {{date}} {{total}} {{subtotal}} {{discount}} {{received}} {{change}} {{payment}}'}</span>
          </p>
        </div>
      )}
      {block.type === 'separator' && (
        <div className="space-y-1">
          <Label>Carácter (1)</Label>
          <Input
            maxLength={1}
            value={block.char ?? '-'}
            onChange={(e) => onChange({ char: e.target.value || '-' } as Partial<ReceiptBlock>)}
            className="w-20"
          />
        </div>
      )}
      {block.type === 'spacer' && (
        <div className="space-y-1">
          <Label>Líneas en blanco</Label>
          <Input
            type="number"
            min={1}
            max={6}
            value={block.lines ?? 1}
            onChange={(e) =>
              onChange({ lines: Math.max(1, Math.min(6, Number(e.target.value) || 1)) } as Partial<ReceiptBlock>)
            }
            className="w-24"
          />
        </div>
      )}
    </div>
  )
}
