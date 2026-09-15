// The turret's own projectile: fired outward along whatever angle the
// turret is currently facing (spec.md section 3) -- intercepting a beam or
// fighter requires actually being lined up with it, not just pointed
// roughly its way.
import { ORBIT_RADIUS } from './physics'

export interface Shot {
  id: number
  angle: number // fixed direction of travel, doesn't change in flight
  radius: number
  speed: number // px/s outward
}

export function spawnShot(id: number, angle: number, speed: number): Shot {
  return { id, angle, radius: ORBIT_RADIUS, speed }
}

export function stepShots(shots: Shot[], dt: number): Shot[] {
  return shots.map((s) => ({ ...s, radius: s.radius + s.speed * dt }))
}
