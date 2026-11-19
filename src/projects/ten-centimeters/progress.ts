// Progress across shifts, saved through the site's shared storage helper
// (per player profile, versioned, never throws): which shifts are open, and
// the best stars and score on each. Earning a star on a shift opens the next.
import { createStore } from '../../shared/storage'
import { SHIFTS } from './sim/config'
import type { ShiftResult } from './sim/shift'

export interface Progress {
  unlocked: number // shifts 0..unlocked are playable
  bestStars: number[]
  bestScore: number[]
}

function fresh(): Progress {
  return { unlocked: 0, bestStars: SHIFTS.map(() => 0), bestScore: SHIFTS.map(() => 0) }
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const list = (v: unknown, i: number) => num(Array.isArray(v) ? v[i] : 0)

const store = createStore<Progress>({
  key: 'ten-centimeters:progress',
  version: 1,
  defaults: fresh,
  parse: (p) => ({
    unlocked: Math.min(SHIFTS.length - 1, Math.max(0, Math.floor(num(p.unlocked)))),
    bestStars: SHIFTS.map((_, i) => Math.min(3, Math.max(0, Math.floor(list(p.bestStars, i))))),
    bestScore: SHIFTS.map((_, i) => Math.max(0, Math.round(list(p.bestScore, i)))),
  }),
  summary: {
    slug: 'ten-centimeters',
    describe(p) {
      const stars = p.bestStars.reduce((a, b) => a + b, 0)
      if (stars === 0) return null
      const done = p.bestStars.filter((s) => s > 0).length
      return `${done === SHIFTS.length ? 'Every shift' : `Shift ${done}/${SHIFTS.length}`} · ${stars}★`
    },
  },
})

export const loadProgress = store.load

export function recordShift(p: Progress, shift: number, result: ShiftResult): Progress {
  const passed = result.outcome === 'complete' && result.stars > 0
  const next: Progress = {
    unlocked: passed ? Math.max(p.unlocked, Math.min(SHIFTS.length - 1, shift + 1)) : p.unlocked,
    bestStars: p.bestStars.map((s, i) => (i === shift ? Math.max(s, result.stars) : s)),
    bestScore: p.bestScore.map((s, i) => (i === shift ? Math.max(s, result.score) : s)),
  }
  store.save(next)
  return next
}
