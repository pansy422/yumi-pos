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
