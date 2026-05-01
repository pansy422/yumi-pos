export function formatCLP(n: number): string {
  const sign = n < 0 ? '-' : ''
  return sign + '$' + Math.abs(Math.round(n)).toLocaleString('es-CL')
}

export function parseCLP(input: string | number): number {
  if (typeof input === 'number') return clampMoney(Math.round(input))
  const cleaned = input.replace(/[^\d-]/g, '')
  if (cleaned === '' || cleaned === '-') return 0
  return clampMoney(Math.round(Number(cleaned)))
}

/**
 * Acota un monto a un rango razonable: ±$999.999.999. Sirve como red
 * de seguridad si el cajero pega por error un número gigante (sample:
 * "999999999999999999") — JS lo convertiría en 1e18 y rompería los
 * cálculos de vuelto y total. 999 millones cubre cualquier transacción
 * imaginable de un minimarket.
 */
export function clampMoney(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(-999_999_999, Math.min(999_999_999, n))
}

export function todayISO(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Formatea una cantidad almacenada en gramos a "Ng" o "N.NNN kg" según
 * sea más legible. Por debajo de 1 kg usa gramos enteros; arriba usa kg
 * con 3 decimales.
 */
export function formatWeight(grams: number): string {
  const g = Math.max(0, Math.round(grams))
  if (g < 1000) return `${g} g`
  return `${(g / 1000).toFixed(3)} kg`
}

/**
 * Total de una línea de venta (en pesos enteros).
 *
 * Para productos al peso (`is_weight=1`):
 *   - `qty` viene en gramos (entero)
 *   - `price` y `surcharge` son por kg
 *   - line_total = (price + surcharge) × qty / 1000  redondeado a CLP
 *
 * Para productos por unidad:
 *   - line_total = (price + surcharge) × qty
 *
 * IMPORTANTE: esta función es la única fuente de verdad. Si la cambias,
 * el cart frontend, el motor de promos y el INSERT de sale_items se
 * actualizan automáticamente. Antes había 3 copias literales y se
 * podían desincronizar.
 */
export function lineTotal(item: {
  price: number
  surcharge?: number
  qty: number
  is_weight?: 0 | 1 | number
}): number {
  const unit = item.price + (item.surcharge ?? 0)
  return item.is_weight === 1
    ? Math.round((unit * item.qty) / 1000)
    : unit * item.qty
}

/**
 * Costo total de una línea (mismo manejo de peso que `lineTotal`, pero
 * con `cost` en vez de `price`). Útil para reportes de ganancia y
 * valor de inventario.
 */
export function lineCost(item: {
  cost: number
  qty: number
  is_weight?: 0 | 1 | number
}): number {
  return item.is_weight === 1
    ? Math.round((item.cost * item.qty) / 1000)
    : item.cost * item.qty
}
