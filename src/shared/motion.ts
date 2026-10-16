// The player's "reduce motion" accessibility setting (OS or browser level).
// Games should skip or soften screen shake, flashes, confetti and other big
// motion when it's on.
import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

// Cached: render loops may ask every frame.
let mql: MediaQueryList | null | undefined

function media(): MediaQueryList | null {
  if (mql === undefined) {
    try {
      mql = window.matchMedia(QUERY)
    } catch {
      mql = null
    }
  }
  return mql
}

export function prefersReducedMotion(): boolean {
  return media()?.matches ?? false
}

function subscribe(listener: () => void) {
  const m = media()
  m?.addEventListener('change', listener)
  return () => m?.removeEventListener('change', listener)
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion)
}
