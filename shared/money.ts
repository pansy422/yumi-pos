export function formatCLP(n: number): string {
  const sign = n < 0 ? '-' : ''
  return sign + '$' + Math.abs(Math.round(n)).toLocaleString('es-CL')
}

export function parseCLP(input: string | number): number {
  if (typeof input === 'number') return Math.round(input)
  const cleaned = input.replace(/[^\d-]/g, '')
  if (cleaned === '' || cleaned === '-') return 0
  return Math.round(Number(cleaned))
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

export type Rounding = 'none' | 'nearest_10' | 'nearest_100' | 'psycho_90' | 'psycho_990'

/**
 * Redondea un precio según la convención chilena. Por defecto usamos
 * "psicológico *990" → siempre termina en 990 (ej. 990, 1.990, 2.990).
 * Para precios bajos (≤ 1.489) cae a 990 mínimo.
 */
export function roundPrice(amount: number, mode: Rounding = 'psycho_990'): number {
  if (!isFinite(amount) || amount <= 0) return 0
  switch (mode) {
    case 'none':
      return Math.round(amount)
    case 'nearest_10':
      return Math.round(amount / 10) * 10
    case 'nearest_100':
      return Math.round(amount / 100) * 100
    case 'psycho_90':
      // El más cercano de la forma X*100 + 90 (ej. 90, 190, 290…). Mín 90.
      return Math.max(90, Math.round((amount - 90) / 100) * 100 + 90)
    case 'psycho_990':
    default:
      // El más cercano de la forma X*1000 + 990 (ej. 990, 1.990…). Mín 990.
      return Math.max(990, Math.round((amount - 990) / 1000) * 1000 + 990)
  }
}
