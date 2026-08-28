// Simple N-body gravity simulation tuned for gameplay feel rather than
// real-world units. A body's `mass` directly controls how strongly it
// bends the rocket's path -- asteroids have small mass, planets more,
// stars a lot -- independent of its visual radius (though in practice the
// level data keeps bigger-looking bodies more massive too, for intuition).

export interface Vec2 {
  x: number
  y: number
}

export type BodyKind = 'asteroid' | 'planet' | 'star'

/** A body orbiting a fixed point in space. `x`/`y` on the owning `Body` are
 * its position at t=0 (kept in sync with this at generation time); its
 * position at any other moment comes from `effectivePosition`. */
export interface Orbit {
  cx: number
  cy: number
  radius: number
  angularSpeed: number // radians/sec
  phase: number // radians, at t=0
}

export interface Body {
  x: number
  y: number
  radius: number
  mass: number
  kind: BodyKind
  orbit?: Orbit
}

export interface Target {
  x: number
  y: number
  radius: number
}

export interface Bounds {
  width: number
  height: number
}

export interface RocketState {
  pos: Vec2
  vel: Vec2
}

export type FlightOutcome = 'hit-earth' | 'crashed' | 'out-of-bounds' | 'flying'

export interface TrajectoryResult {
  points: Vec2[]
  outcome: FlightOutcome
}

/** Gravitational constant, tuned (alongside level body masses) for feel. */
export const G = 800

/** Fixed timestep for one physics tick. The game loop and trajectory
 * preview/solvability checks all use this same tick size, so a preview
 * never predicts something the real flight wouldn't do. */
export const TICK_DT = 1 / 120

export const ROCKET_RADIUS = 4
const OUT_OF_BOUNDS_MARGIN = 100
const MAX_TICKS = 2400 // 20s of simulated flight at TICK_DT

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Where a body actually is at time `t` (seconds since the shot in question
 * started) -- static bodies just return their fixed position; orbiting ones
 * sweep around their orbit's center. This is the single source of truth for
 * body position used by gravity, collision, and scoring, so a moving body
 * can never be in one place for physics and another for rendering/scoring. */
export function effectivePosition(body: Body, t: number): Vec2 {
  if (!body.orbit) return { x: body.x, y: body.y }
  const { cx, cy, radius, angularSpeed, phase } = body.orbit
  const a = phase + angularSpeed * t
  return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) }
}

/** Distance from the rocket's edge to a body's surface (0 if touching/inside)
 * at time `t`. */
export function surfaceDistance(pos: Vec2, body: Body, t = 0): number {
  return Math.max(0, distance(pos, effectivePosition(body, t)) - body.radius - ROCKET_RADIUS)
}

/** Convert an aim angle (degrees, clockwise from "up") and a speed into a velocity vector. */
export function velocityFromAngle(angleDeg: number, power: number): Vec2 {
  const rad = (angleDeg * Math.PI) / 180
  return { x: power * Math.sin(rad), y: -power * Math.cos(rad) }
}

/** Sum of gravitational acceleration from every body, at `pos`, at time `t`. */
export function accelerationAt(pos: Vec2, bodies: Body[], t = 0): Vec2 {
  let ax = 0
  let ay = 0
  for (const body of bodies) {
    const bodyPos = effectivePosition(body, t)
    const dx = bodyPos.x - pos.x
    const dy = bodyPos.y - pos.y
    const distSq = dx * dx + dy * dy
    const dist = Math.sqrt(distSq) || 1
    const strength = (G * body.mass) / distSq
    ax += (strength * dx) / dist
    ay += (strength * dy) / dist
  }
  return { x: ax, y: ay }
}

/** Advance the rocket by one fixed tick (semi-implicit Euler: velocity first,
 * then position), using the gravity field as it is at time `t`. */
export function stepRocket(state: RocketState, bodies: Body[], dt: number, t = 0): RocketState {
  const acc = accelerationAt(state.pos, bodies, t)
  const vel = { x: state.vel.x + acc.x * dt, y: state.vel.y + acc.y * dt }
  const pos = { x: state.pos.x + vel.x * dt, y: state.pos.y + vel.y * dt }
  return { pos, vel }
}

/** What (if anything) has happened to the rocket at this position, at time `t`. */
export function checkOutcome(
  pos: Vec2,
  bodies: Body[],
  earth: Target,
  bounds: Bounds,
  t = 0,
): FlightOutcome {
  for (const body of bodies) {
    if (distance(pos, effectivePosition(body, t)) < body.radius + ROCKET_RADIUS) return 'crashed'
  }
  if (distance(pos, earth) < earth.radius + ROCKET_RADIUS) return 'hit-earth'
  if (
    pos.x < -OUT_OF_BOUNDS_MARGIN ||
    pos.x > bounds.width + OUT_OF_BOUNDS_MARGIN ||
    pos.y < -OUT_OF_BOUNDS_MARGIN ||
    pos.y > bounds.height + OUT_OF_BOUNDS_MARGIN
  ) {
    return 'out-of-bounds'
  }
  return 'flying'
}

/**
 * Simulate a full flight ahead of time (used for both the optional live
 * trajectory preview and level-solvability checking) -- runs the same
 * `stepRocket`/`checkOutcome` the real flight uses, capped at MAX_TICKS.
 * `sampleEvery` thins the returned points for cheaper rendering; the
 * outcome check still runs every tick regardless.
 */
export function simulateTrajectory(
  start: Vec2,
  vel: Vec2,
  bodies: Body[],
  earth: Target,
  bounds: Bounds,
  sampleEvery = 1,
  t0 = 0,
  maxTicks = MAX_TICKS,
): TrajectoryResult {
  let state: RocketState = { pos: { ...start }, vel: { ...vel } }
  const points: Vec2[] = [state.pos]
  for (let tick = 1; tick <= maxTicks; tick++) {
    const t = t0 + tick * TICK_DT
    state = stepRocket(state, bodies, TICK_DT, t)
    const outcome = checkOutcome(state.pos, bodies, earth, bounds, t)
    if (tick % sampleEvery === 0 || outcome !== 'flying') points.push(state.pos)
    if (outcome !== 'flying') return { points, outcome }
  }
  return { points, outcome: 'flying' }
}
