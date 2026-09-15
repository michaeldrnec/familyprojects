// Photon beams (spec.md section 4.1): fired by Lancer/Siege dreadnoughts,
// travel straight inward along a fixed angle from the rim toward the star.
// Simple radial motion -- all the "aiming" challenge is on the player's
// side, matching the telegraph-then-commit Missile Command feel.
import { RIM_RADIUS } from './physics'

export interface Beam {
  id: number
  angle: number // fixed direction of travel, doesn't change in flight
  radius: number // current distance from center
  speed: number // px/s, inward (radius decreases)
}

export function spawnBeam(id: number, angle: number, speed: number): Beam {
  return { id, angle, radius: RIM_RADIUS, speed }
}

// Only moves beams -- it does not remove ones that reach the core. The
// caller (SolarWard.tsx) checks for that after stepping, so it can apply
// segment damage at the beam's angle before dropping it, the same
// step-then-resolve split used for collisions elsewhere in this game.
export function stepBeams(beams: Beam[], dt: number): Beam[] {
  return beams.map((b) => ({ ...b, radius: b.radius - b.speed * dt }))
}
