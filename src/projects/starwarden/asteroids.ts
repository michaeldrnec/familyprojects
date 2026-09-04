// Periodic asteroid/debris hazard: unlike enemies these drift diagonally
// through the world and bounce off the top/bottom bounds instead of
// holding an altitude. Destructible (a few laser hits) for points, but
// also a straightforward ramming hazard if the player just plows into one.
import { VIEW_HEIGHT, Y_MARGIN } from './physics'
import type { Rng } from './rng'

export interface Asteroid {
  id: number
  worldX: number
  y: number
  vx: number
  vy: number
  radius: number
  health: number
  rotation: number
  rotationSpeed: number
  jagSeed: number
}

export const ASTEROID_POINTS = 15
const ASTEROID_HEALTH = 3

const SIZE_TIERS: { radius: number; speed: number; weight: number }[] = [
  { radius: 20, speed: 55, weight: 0.65 }, // small
  { radius: 34, speed: 35, weight: 0.35 }, // large
]

export function spawnAsteroid(rng: Rng, worldWidth: number, nextId: number): Asteroid {
  let roll = rng.next()
  let tier = SIZE_TIERS[0]
  for (const t of SIZE_TIERS) {
    roll -= t.weight
    if (roll <= 0) {
      tier = t
      break
    }
  }
  const angle = rng.range(0, Math.PI * 2)
  return {
    id: nextId,
    worldX: rng.range(0, worldWidth),
    y: rng.range(Y_MARGIN, VIEW_HEIGHT - Y_MARGIN),
    vx: Math.cos(angle) * tier.speed,
    vy: Math.sin(angle) * tier.speed,
    radius: tier.radius,
    health: ASTEROID_HEALTH,
    rotation: rng.range(0, Math.PI * 2),
    rotationSpeed: rng.range(-1.2, 1.2),
    jagSeed: rng.range(0, 1000),
  }
}

export function stepAsteroids(asteroids: Asteroid[], worldWidth: number, dt: number): Asteroid[] {
  return asteroids.map((a) => {
    let y = a.y + a.vy * dt
    let vy = a.vy
    if (y < Y_MARGIN) {
      y = Y_MARGIN
      vy = Math.abs(vy)
    } else if (y > VIEW_HEIGHT - Y_MARGIN) {
      y = VIEW_HEIGHT - Y_MARGIN
      vy = -Math.abs(vy)
    }
    const worldX = ((a.worldX + a.vx * dt) % worldWidth + worldWidth) % worldWidth
    return { ...a, worldX, y, vy, rotation: a.rotation + a.rotationSpeed * dt }
  })
}
