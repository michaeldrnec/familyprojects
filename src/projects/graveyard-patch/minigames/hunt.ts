// Bug Hunt's rules: little bugs crawl in from the edges of your code and
// across the screen; tap them before they crawl off the other side. Board
// units are 0..1 on both axes; the component maps them to pixels.
import type { Rng } from '../../../shared/rng'
import type { Severity } from '../sim/config'

export const BUG_KINDS = ['🐞', '🐛', '🐜']
const LEAD_IN = 0.6
const MARGIN = 0.05 // how far past the edge a bug spawns and escapes

const WAVE: Record<Severity, { count: number; gap: number; cross: number; spare: number }> = {
  P3: { count: 6, gap: 0.9, cross: 4.6, spare: 1 },
  P1: { count: 9, gap: 0.75, cross: 4.1, spare: 2 },
  P0: { count: 12, gap: 0.65, cross: 3.6, spare: 2 },
}

export type BugState = 'waiting' | 'crawling' | 'squashed' | 'escaped'

export interface Bug {
  id: number
  kind: string
  spawnAt: number
  x: number
  y: number
  heading: number // radians
  speed: number // board units per second
  state: BugState
  since: number // seconds in the current state
}

export interface Hunt {
  bugs: Bug[]
  time: number
  needed: number
}

// A start just outside one edge, aimed through the middle of the board so
// every bug crosses where you can reach it.
function entry(rng: Rng): { x: number; y: number; heading: number } {
  const side = rng.int(0, 4)
  const along = rng.range(0.15, 0.85)
  const start =
    side === 0 ? { x: along, y: -MARGIN } : side === 1 ? { x: 1 + MARGIN, y: along } : side === 2 ? { x: along, y: 1 + MARGIN } : { x: -MARGIN, y: along }
  const aim = { x: rng.range(0.3, 0.7), y: rng.range(0.3, 0.7) }
  return { ...start, heading: Math.atan2(aim.y - start.y, aim.x - start.x) }
}

export function makeHunt(rng: Rng, severity: Severity, speed: number): Hunt {
  const wave = WAVE[severity]
  const bugs: Bug[] = []
  let at = LEAD_IN
  for (let i = 0; i < wave.count; i++) {
    bugs.push({
      id: i,
      kind: BUG_KINDS[rng.int(0, BUG_KINDS.length)],
      spawnAt: at,
      ...entry(rng),
      speed: (speed / wave.cross) * rng.range(0.85, 1.15),
      state: 'waiting',
      since: 0,
    })
    at += (wave.gap / speed) * rng.range(0.7, 1.3)
  }
  return { bugs, time: 0, needed: wave.count - wave.spare }
}

const outside = (b: Bug) => b.x < -MARGIN || b.x > 1 + MARGIN || b.y < -MARGIN || b.y > 1 + MARGIN

// Advances the hunt by dt. `tempo` speeds the bugs up (the jitters) and
// `zigzag` (0..1) makes them weave. Returns how many escaped this step.
export function stepHunt(h: Hunt, dt: number, rng: Rng, tempo = 1, zigzag = 0): number {
  h.time += dt
  let escaped = 0
  for (const b of h.bugs) {
    b.since += dt
    if (b.state === 'waiting' && h.time >= b.spawnAt) {
      b.state = 'crawling'
      b.since = 0
    }
    if (b.state !== 'crawling') continue
    // A gentle random wander, plus a weave while you're jittery.
    b.heading += rng.range(-1, 1) * 1.2 * dt
    const weave = zigzag * Math.sin(b.since * 9 + b.id) * 1.4
    const step = b.speed * tempo * dt
    b.x += Math.cos(b.heading + weave) * step
    b.y += Math.sin(b.heading + weave) * step
    if (b.since > 0.5 && outside(b)) {
      b.state = 'escaped'
      b.since = 0
      escaped++
    }
  }
  return escaped
}

export function squash(b: Bug) {
  b.state = 'squashed'
  b.since = 0
}

export function huntTally(h: Hunt) {
  const squashed = h.bugs.filter((b) => b.state === 'squashed').length
  const escaped = h.bugs.filter((b) => b.state === 'escaped').length
  const total = h.bugs.length
  // Over as soon as every bug is dealt with, or too many got away to pass.
  const done = squashed + escaped === total || escaped > total - h.needed
  return { squashed, escaped, total, needed: h.needed, done, pass: squashed >= h.needed }
}
