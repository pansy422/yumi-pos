import { useEffect, useRef } from 'react'

type Options = {
  enabled?: boolean
  minLength?: number
  maxIntervalMs?: number
  /**
   * Ms mínimos entre dos lecturas idénticas. Por debajo se ignora la
   * segunda como un doble-disparo del hardware del lector. Un cajero
   * físicamente no escanea el mismo código dos veces en menos de
   * ~250ms — eso siempre es ruido del lector. Lecturas distintas no
   * se filtran.
   */
  dedupeMs?: number
  onScan: (code: string) => void
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  if (t.isContentEditable) return true
  const tag = t.tagName
  if (tag !== 'INPUT' && tag !== 'TEXTAREA') return false
  const role = (t as HTMLElement).dataset.scannerScope
  return role !== 'capture'
}

export function useScanner({
  enabled = true,
  minLength = 4,
  maxIntervalMs = 50,
  dedupeMs = 250,
  onScan,
}: Options) {
  const buffer = useRef<string>('')
  const lastTime = useRef<number>(0)
  const lastFire = useRef<{ code: string; ts: number }>({ code: '', ts: 0 })

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const now = Date.now()
      if (now - lastTime.current > maxIntervalMs) buffer.current = ''
      lastTime.current = now

      if (e.key === 'Enter' || e.key === 'Tab') {
        const code = buffer.current.trim()
        buffer.current = ''
        if (code.length < minLength) return
        e.preventDefault()
        // Anti doble-disparo: ignorar el mismo código si llegó hace
        // menos de dedupeMs. Códigos distintos pasan siempre.
        if (
          code === lastFire.current.code &&
          now - lastFire.current.ts < dedupeMs
        ) {
          return
        }
        lastFire.current = { code, ts: now }
        onScan(code)
        return
      }
      if (e.key.length === 1 && buffer.current.length < 64) {
        buffer.current += e.key
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, minLength, maxIntervalMs, dedupeMs, onScan])
}
