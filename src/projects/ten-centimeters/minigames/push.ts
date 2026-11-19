// The delivery mini-game's rules: a contraction marker sweeps back and forth
// across the push meter; push while it's inside the green zone. A push near
// the zone's middle is perfect, anywhere inside is good, outside is a miss.
// The baby arrives when progress reaches 100. No React or DOM here.

export type PushRating = 'perfect' | 'good' | 'miss'

export const PUSH_POINTS: Record<PushRating, number> = { perfect: 40, good: 28, miss: 0 }
const PUSH_VALUE: Record<PushRating, number> = { perfect: 1, good: 0.75, miss: 0 }
export const MAX_PUSHES = 9 // after this many the midwife helps and the baby comes anyway
const REST = 0.7 // seconds Mom catches her breath between pushes
const LEAD_IN = 1.2 // seconds before the first contraction
const ZONE_WIDTHS = [0.24, 0.2, 0.17, 0.15] // per successful push, then stays at the last
const PERFECT_FRACTION = 0.35 // the middle slice of the zone that counts as perfect
export const CONTRACTION_SECONDS = 5 // a contraction with no push ends as a miss

export interface PushGame {
  time: number
  marker: number // 0..1 across the meter
  dir: 1 | -1
  speed: number // meter widths per second
  zoneCenter: number
  zoneWidth: number
  progress: number // 0..100
  pushes: PushRating[]
  rest: number // seconds until the next push is allowed
  sweep: number // seconds into the current contraction
  done: boolean
}

// A calmer mom (an epidural, low stress) gives a slower, easier meter.
export function makePush(stress: number, epidural: boolean, rand: () => number): PushGame {
  const calm = epidural ? 0.85 : 1
  return {
    time: 0,
    marker: 0,
    dir: 1,
    speed: (0.55 + (Math.min(100, Math.max(0, stress)) / 100) * 0.45) * calm,
    zoneCenter: 0.35 + rand() * 0.3,
    zoneWidth: ZONE_WIDTHS[0],
    progress: 0,
    pushes: [],
    rest: LEAD_IN,
    sweep: 0,
    done: false,
  }
}

// Advances the meter. Returns 'miss' if a contraction passed with no push.
export function stepPush(g: PushGame, dt: number, rand: () => number): PushRating | null {
  if (g.done) return null
  g.time += dt
  if (g.rest > 0) {
    g.rest = Math.max(0, g.rest - dt)
    return null
  }
  g.sweep += dt
  if (g.sweep >= CONTRACTION_SECONDS) {
    g.marker = -1 // well outside the zone
    return push(g, rand)
  }
  g.marker += g.dir * g.speed * dt
  if (g.marker >= 1) {
    g.marker = 2 - g.marker
    g.dir = -1
  } else if (g.marker <= 0) {
    g.marker = -g.marker
    g.dir = 1
  }
  return null
}

export function canPush(g: PushGame): boolean {
  return !g.done && g.rest <= 0
}

export function rate(g: PushGame): PushRating {
  const off = Math.abs(g.marker - g.zoneCenter)
  if (off <= (g.zoneWidth / 2) * PERFECT_FRACTION) return 'perfect'
  if (off <= g.zoneWidth / 2) return 'good'
  return 'miss'
}

// Push now. Returns the rating, or null if Mom is still catching her breath.
export function push(g: PushGame, rand: () => number): PushRating | null {
  if (!canPush(g)) return null
  const r = rate(g)
  g.pushes.push(r)
  g.progress = Math.min(100, g.progress + PUSH_POINTS[r])
  const hits = g.pushes.filter((p) => p !== 'miss').length
  if (g.progress >= 100 || g.pushes.length >= MAX_PUSHES) {
    g.progress = 100
    g.done = true
    return r
  }
  // Next contraction: a fresh zone somewhere else, a little narrower and quicker after a good push.
  g.zoneWidth = ZONE_WIDTHS[Math.min(hits, ZONE_WIDTHS.length - 1)]
  g.zoneCenter = g.zoneWidth / 2 + 0.05 + rand() * (0.9 - g.zoneWidth)
  if (r !== 'miss') g.speed *= 1.08
  g.rest = REST
  g.sweep = 0
  g.marker = g.dir === 1 ? 0 : 1
  return r
}

// 0..1: the average push, so three perfect pushes is 1 and a string of misses is near 0.
export function pushQuality(g: PushGame): number {
  if (!g.pushes.length) return 0
  return g.pushes.reduce((a, r) => a + PUSH_VALUE[r], 0) / g.pushes.length
}
