// Swarm fighters (spec.md section 4.2): launched from a dreadnought, weave
// inward faster than beams and steer gradually toward the turret's current
// angle -- a dogfight-timing target instead of a straight-line intercept.
import { RIM_RADIUS, angleDelta, normalizeAngle } from './physics'
import type { Rng } from './rng'

export interface Fighter {
  id: number
  angle: number
  radius: number
  speed: number // px/s inward
  weavePhase: number
  weaveFreq: number
  weaveAmplitude: number // rad/s contribution from weaving
  steerStrength: number // fraction of the angle gap to the turret closed per second
}

export function spawnFighter(rng: Rng, id: number, angle: number, speed: number): Fighter {
  return {
    id,
    angle,
    radius: RIM_RADIUS,
    speed,
    weavePhase: rng.range(0, Math.PI * 2),
    weaveFreq: rng.range(2.2, 3.6),
    weaveAmplitude: rng.range(0.9, 1.6),
    steerStrength: rng.range(0.15, 0.35),
  }
}

export function stepFighters(fighters: Fighter[], turretAngle: number, dt: number): Fighter[] {
  return fighters.map((f) => {
    const weavePhase = f.weavePhase + f.weaveFreq * dt
    const weave = Math.sin(weavePhase) * f.weaveAmplitude
    const steer = angleDelta(turretAngle, f.angle) * f.steerStrength
    const angle = normalizeAngle(f.angle + (weave + steer) * dt)
    const radius = f.radius - f.speed * dt
    return { ...f, angle, radius, weavePhase }
  })
}
