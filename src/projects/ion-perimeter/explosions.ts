// Particle-burst effects: generated once at creation time from the run's
// seeded Rng and then just aged forward -- cheap to step every frame since
// nothing is re-simulated, only `age` advances. Modeled directly on
// starwarden/explosions.ts.
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

const HIT_COLORS = ['#fde68a', '#fbbf24', '#f87171']
const DEATH_COLORS = ['#67e8f9', '#fde047', '#e5e7eb', '#fb923c']

// scale differentiates a small on-hit spark from a bigger kill/leak blast --
// more particles, wider spread, longer-lived.
export function spawnExplosion(rng: Rng, x: number, y: number, nextId: number, scale: 'hit' | 'kill' | 'leak' = 'kill'): Explosion {
  const count = scale === 'hit' ? 5 : scale === 'leak' ? 26 : 16
  const maxSpeed = scale === 'hit' ? 70 : scale === 'leak' ? 240 : 170
  const duration = scale === 'hit' ? 0.22 : scale === 'leak' ? 0.7 : 0.5
  const colors = scale === 'hit' ? HIT_COLORS : scale === 'leak' ? ['#f87171', '#fb923c', '#fde68a'] : DEATH_COLORS
  const particles: ExplosionParticle[] = []
  for (let i = 0; i < count; i++) {
    particles.push({
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(maxSpeed * 0.3, maxSpeed),
      size: rng.range(1.5, scale === 'hit' ? 2.5 : 4.5),
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
