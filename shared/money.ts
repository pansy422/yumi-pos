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
 * Formatea una fecha ISO (yyyy-mm-dd o yyyy-mm-ddTHH:MM:SS...) a la
 * convención chilena dd-mm-yyyy. Para mostrar al usuario; nunca para
 * almacenar (la BD usa ISO siempre). Antes mostrábamos `2026-05-04`
 * directo en tablas y un cajero CL podía leer eso como "4 de mayo" o
 * "5 de abril" según el dia.
 */
export function formatDateCL(iso: string): string {
  if (!iso) return ''
  // Acepta tanto "2026-05-04" como "2026-05-04T13:45:00".
  const datePart = iso.slice(0, 10)
  const m = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  return `${m[3]}-${m[2]}-${m[1]}`
}

/**
 * Formatea fecha + hora en convención chilena: "04-05-2026 14:30".
 * Usa la TZ local del SO. Para boletas, listados y reportes.
 */
export function formatDateTimeCL(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso)
  if (isNaN(d.getTime())) return ''
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${day}-${month}-${year} ${hh}:${mm}`
}

/**
 * Formatea una cantidad almacenada en gramos a "Ng" o "N.NNN kg" según
 * sea más legible. Por debajo de 1 kg usa gramos enteros; arriba usa kg
 * con 3 decimales.
 */
/**
 * Formatea gramos a string legible. < 1 kg → "850 g". >= 1 kg → "1,5 kg",
 * "100 kg", "12,345 kg".
 *
 * Convención chilena: coma como separador decimal, sin decimales cuando
 * el valor es entero. Antes usábamos `.toFixed(3)` y mostrábamos "100.000 kg"
 * para 100 kg, que en CL se lee como "cien mil kilos" (lectura ambigua y
 * confusa para el usuario). Tampoco agregamos separador de miles para
 * los kilos: "1500 kg" en vez de "1.500 kg" (un minimarket raramente
 * pasa de 1000 kg de algo, y el separador agrega más confusión que claridad).
 */
export function formatWeight(grams: number): string {
  const g = Math.max(0, Math.round(grams))
  if (g < 1000) return `${g} g`
  const kg = g / 1000
  if (g % 1000 === 0) return `${kg} kg`
  // Hasta 3 decimales, coma como separador, sin ceros sobrantes.
  const text = kg
    .toFixed(3)
    .replace(/0+$/, '')
    .replace(/\.$/, '')
    .replace('.', ',')
  return `${text} kg`
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
