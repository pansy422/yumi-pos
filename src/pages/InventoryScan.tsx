import { useCallback, useRef, useState } from 'react'
import { ArrowLeft, ScanBarcode } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/common/PageHeader'
import { ProductDialog } from './ProductDialog'
import { useScanner } from '@/hooks/useScanner'
import { useToast } from '@/hooks/useToast'
import { api } from '@/lib/api'
import { formatCLP } from '@shared/money'
import type { Product } from '@shared/types'

type LogEntry = {
  id: number
  ts: string
  product?: Product
  barcode?: string
  kind: 'created' | 'incremented' | 'pending'
}

export function InventoryScan() {
  const { toast } = useToast()
  const [active, setActive] = useState(true)
  const [pending, setPending] = useState<string | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])
  const idRef = useRef(0)
  const nextId = () => ++idRef.current

  const handleScan = useCallback(
    async (code: string) => {
      try {
        const r = await api.productsScanIn(code)
        if (r.kind === 'incremented') {
          setLog((l) =>
            [
              { id: nextId(), ts: new Date().toISOString(), product: r.product, kind: 'incremented' as const },
              ...l,
            ].slice(0, 100),
          )
          toast({ variant: 'success', title: r.product.name, description: `Stock ${r.product.stock}` })
        } else if (r.kind === 'created') {
          setLog((l) =>
            [
              { id: nextId(), ts: new Date().toISOString(), product: r.product, kind: 'created' as const },
              ...l,
            ].slice(0, 100),
          )
        } else {
          setPending(r.barcode)
        }
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Error al pistolear',
          description: err instanceof Error ? err.message : String(err),
        })
      }
    },
    [toast],
  )

  useScanner({ enabled: active && !pending, onScan: handleScan })

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Pistolear stock"
        description="Pasa el código por el lector. Si existe, +1. Si es nuevo, te pide datos."
        actions={
          <Button asChild variant="outline">
            <Link to="/inventario">
              <ArrowLeft className="h-4 w-4" /> Volver
            </Link>
          </Button>
        }
      />
      <div className="grid flex-1 grid-cols-3 gap-4 p-6">
        <div className="col-span-1">
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center justify-between">
                <Label>Modo pistoleo</Label>
                <Switch checked={active} onCheckedChange={setActive} />
              </div>
              <div className="flex flex-col items-center gap-2 rounded-md bg-muted/40 p-6 text-center">
                <ScanBarcode
                  className={`h-12 w-12 ${active ? 'text-primary animate-pulse' : 'text-muted-foreground'}`}
                />
                <p className="text-sm">
                  {active ? 'Listo. Pasa el código…' : 'Activa el modo para escanear.'}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Cada lectura se guarda automáticamente. No tienes que confirmar.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-2">
          <Card className="h-full overflow-hidden">
            <CardContent className="flex h-full flex-col p-0">
              <div className="border-b px-4 py-2 text-xs uppercase text-muted-foreground">
                Últimas lecturas
              </div>
              {log.length === 0 ? (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  Aún no has pistoleado nada en esta sesión
                </div>
              ) : (
                <ul className="divide-y overflow-auto">
                  {log.map((e) => (
                    <li key={e.id} className="flex items-center justify-between px-4 py-2 text-sm">
                      <div>
                        <div className="font-medium">{e.product?.name ?? e.barcode}</div>
                        <div className="text-xs text-muted-foreground">
                          {e.product?.barcode ?? ''} · {new Date(e.ts).toLocaleTimeString('es-CL')}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {e.product && (
                          <span className="text-xs text-muted-foreground">
                            {formatCLP(e.product.price)}
                          </span>
                        )}
                        <Badge variant={e.kind === 'created' ? 'success' : 'secondary'}>
                          {e.kind === 'created'
                            ? 'Creado'
                            : e.kind === 'incremented'
                              ? `Stock ${e.product?.stock ?? ''}`
                              : 'Pendiente'}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ProductDialog
        open={!!pending}
        onOpenChange={(v) => !v && setPending(null)}
        product={null}
        defaultBarcode={pending ?? undefined}
        onSaved={(p) => {
          setLog((l) =>
            [{ id: nextId(), ts: new Date().toISOString(), product: p, kind: 'created' as const }, ...l].slice(0, 100),
          )
          setPending(null)
          toast({ variant: 'success', title: 'Producto creado', description: p.name })
        }}
      />
    </div>
  )
}
