import { useEffect } from 'react'

type Match = {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
}

function matches(e: KeyboardEvent, m: Match): boolean {
  if (e.key.toLowerCase() !== m.key.toLowerCase()) return false
  if (!!m.ctrl !== (e.ctrlKey || e.metaKey)) return false
  if (!!m.shift !== e.shiftKey) return false
  if (!!m.alt !== e.altKey) return false
  return true
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  if (t.isContentEditable) return true
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export function useShortcut(
  match: Match,
  handler: (e: KeyboardEvent) => void,
  opts: { allowInInput?: boolean } = {},
) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!matches(e, match)) return
      if (!opts.allowInInput && isTypingTarget(e.target)) return
      e.preventDefault()
      handler(e)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [match.key, match.ctrl, match.shift, match.alt, opts.allowInInput, handler])
}
