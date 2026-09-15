// Explosion effects: a burst of particles generated once at creation time
// (from the run's seeded Rng) and then just aged forward -- cheap to step
// every frame since nothing is re-simulated, only `age` advances. Same
// approach as starwarden/explosions.ts, adapted to plain x/y since this
// arena has no wraparound world to track positions against.
import type { Rng } from './rng'

export interface ExplosionParticle {
  angle: number
  speed: number
  size: number
  color: string
}

export interface Explosion {
  id: number
  x: number
  y: number
  age: number
  duration: number
  particles: ExplosionParticle[]
}

const BEAM_COLORS = ['#67e8f9', '#a5f3fc', '#e0f2fe']
const FIGHTER_COLORS = ['#fb923c', '#fde68a', '#f87171']
const OVERCHARGE_COLORS = ['#fde047', '#fef08a', '#ffffff', '#67e8f9']

export type ExplosionKind = 'beam' | 'fighter' | 'overcharge'

export function spawnExplosion(rng: Rng, x: number, y: number, nextId: number, kind: ExplosionKind): Explosion {
  const big = kind === 'overcharge'
  const count = big ? 26 : kind === 'fighter' ? 14 : 8
  const maxSpeed = big ? 260 : kind === 'fighter' ? 150 : 100
  const duration = big ? 0.9 : kind === 'fighter' ? 0.55 : 0.4
  const colors = kind === 'beam' ? BEAM_COLORS : kind === 'fighter' ? FIGHTER_COLORS : OVERCHARGE_COLORS
  const particles: ExplosionParticle[] = []
  for (let i = 0; i < count; i++) {
    particles.push({
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(maxSpeed * 0.3, maxSpeed),
      size: rng.range(1.5, big ? 4.5 : 3),
      color: colors[Math.floor(rng.next() * colors.length)],
    })
  }
  return { id: nextId, x, y, age: 0, duration, particles }
}

export function stepExplosions(explosions: Explosion[], dt: number): Explosion[] {
  const out: Explosion[] = []
  for (const ex of explosions) {
    const age = ex.age + dt
    if (age >= ex.duration) continue
    out.push({ ...ex, age })
  }
  return out
}
