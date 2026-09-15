// Turret movement model (spec.md section 3): the turret orbits the star at
// a fixed radius -- the entire skill lives on one axis, angular position.
// Left/Right apply angular thrust, not direct rotation: releasing lets
// momentum carry the turret onward, so lining up on a target means
// thrusting one way then braking with the other, not snapping a cursor
// onto it. Directly reuses the thrust-vector-with-inertia feel from
// starwarden/physics.ts, mapped onto a circle instead of a line.

export const VIEW_SIZE = 760
export const CENTER = { x: VIEW_SIZE / 2, y: VIEW_SIZE / 2 }

export const STAR_RADIUS = 34
export const ORBIT_RADIUS = 260
export const RIM_RADIUS = 340

export const TURRET_SIZE = 15

export const ANGULAR_THRUST_ACCEL = 5.2 // rad/s^2 while a thrust key is held
export const MAX_ANGULAR_SPEED = 3.4 // rad/s
// Fraction of angular velocity retained per second with no thrust input --
// high, so the turret coasts a real distance before a counter-thrust is
// needed to stop it, same tuning philosophy as starwarden's DRAG_PER_SEC.
export const ANGULAR_DRAG_PER_SEC = 0.88

export interface TurretState {
  angle: number // radians, position around the orbit
  angularVel: number
  thrustDir: -1 | 0 | 1 // which way (if any) is currently thrusting, for the flame/sound
}

export interface TurretInput {
  left: boolean
  right: boolean
}

export function initialTurret(): TurretState {
  return { angle: -Math.PI / 2, angularVel: 0, thrustDir: 0 }
}

export function normalizeAngle(a: number): number {
  const twoPi = Math.PI * 2
  return ((a % twoPi) + twoPi) % twoPi
}

// Shortest signed angular difference from a to b, in (-PI, PI] -- e.g. so a
// fighter just past the seam at 0/2*PI still reads as "a little ahead"
// instead of almost a full lap away.
export function angleDelta(b: number, a: number): number {
  const twoPi = Math.PI * 2
  let d = (b - a) % twoPi
  if (d > Math.PI) d -= twoPi
  if (d < -Math.PI) d += twoPi
  return d
}

export function pointOnCircle(angle: number, radius: number): { x: number; y: number } {
  return { x: CENTER.x + Math.cos(angle) * radius, y: CENTER.y + Math.sin(angle) * radius }
}

export function stepTurret(turret: TurretState, input: TurretInput, dt: number): TurretState {
  const thrustDir: -1 | 0 | 1 = input.left && !input.right ? -1 : input.right && !input.left ? 1 : 0
  let angularVel = turret.angularVel
  if (thrustDir !== 0) {
    angularVel += thrustDir * ANGULAR_THRUST_ACCEL * dt
    angularVel = Math.max(-MAX_ANGULAR_SPEED, Math.min(MAX_ANGULAR_SPEED, angularVel))
  } else {
    angularVel *= Math.pow(ANGULAR_DRAG_PER_SEC, dt)
    if (Math.abs(angularVel) < 0.01) angularVel = 0
  }
  const angle = normalizeAngle(turret.angle + angularVel * dt)
  return { angle, angularVel, thrustDir }
}
