// Explosion effects: a burst of particles generated once at creation time
// (from the run's seeded Rng) and then just aged forward -- cheap to step
// every frame since nothing is re-simulated, only `age` advances.
import type { Rng } from './rng'

export interface ExplosionParticle {
  angle: number
  speed: number
  size: number
  color: string
}

export interface Explosion {
  id: number
  worldX: number
  y: number
  age: number
  duration: number
  particles: ExplosionParticle[]
}

const ENEMY_COLORS = ['#fbbf24', '#f87171', '#fb923c', '#fde68a']
const SHIP_COLORS = ['#67e8f9', '#e5e7eb', '#a3e635', '#fbbf24']

// scale differentiates a small enemy/asteroid pop from a bigger ship-death
// blast -- more particles, wider spread, longer-lived.
export function spawnExplosion(
  rng: Rng,
  worldX: number,
  y: number,
  nextId: number,
  scale: 'small' | 'large' = 'small',
): Explosion {
  const count = scale === 'large' ? 22 : 10
  const maxSpeed = scale === 'large' ? 220 : 130
  const duration = scale === 'large' ? 0.9 : 0.5
  const colors = scale === 'large' ? SHIP_COLORS : ENEMY_COLORS
  const particles: ExplosionParticle[] = []
  for (let i = 0; i < count; i++) {
    particles.push({
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(maxSpeed * 0.3, maxSpeed),
      size: rng.range(1.5, scale === 'large' ? 4.5 : 3),
      color: colors[Math.floor(rng.next() * colors.length)],
    })
  }
  return { id: nextId, worldX, y, age: 0, duration, particles }
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
