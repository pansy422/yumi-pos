import { useEffect, useRef } from 'react'

type Options = {
  enabled?: boolean
  minLength?: number
  maxIntervalMs?: number
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
  onScan,
}: Options) {
  const buffer = useRef<string>('')
  const lastTime = useRef<number>(0)

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
        if (code.length >= minLength) {
          e.preventDefault()
          onScan(code)
        }
        return
      }
      if (e.key.length === 1 && buffer.current.length < 64) {
        buffer.current += e.key
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, minLength, maxIntervalMs, onScan])
}
