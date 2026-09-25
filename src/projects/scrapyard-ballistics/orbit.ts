// The free-falling frame's trajectory (SPEC.md section 5). Planet-centred
// float64 metres, y up. Matter.js never sees gravity -- this module owns it
// -- so the same integrator runs whether the rig is shaking through Max-Q
// or coasting at ×1000 warp with the physics world frozen.

export const PLANET_RADIUS = 300_000 // m
export const SURFACE_G = 9.81
export const MU = SURFACE_G * PLANET_RADIUS * PLANET_RADIUS

export interface Vec2 {
  x: number
  y: number
}

export interface FrameState {
  p: Vec2 // position from planet centre
  v: Vec2 // inertial velocity
}

export function gravityAt(p: Vec2): Vec2 {
  const r2 = p.x * p.x + p.y * p.y
  const r = Math.sqrt(r2)
  const k = -MU / (r2 * r)
  return { x: p.x * k, y: p.y * k }
}

// Velocity Verlet: symplectic, so coasting orbits keep their energy over
// thousands of warped steps instead of spiralling in or out.
export function stepGravity(s: FrameState, dt: number) {
  const a0 = gravityAt(s.p)
  s.p.x += s.v.x * dt + 0.5 * a0.x * dt * dt
  s.p.y += s.v.y * dt + 0.5 * a0.y * dt * dt
  const a1 = gravityAt(s.p)
  s.v.x += 0.5 * (a0.x + a1.x) * dt
  s.v.y += 0.5 * (a0.y + a1.y) * dt
}

export function propagate(s: FrameState, dt: number, maxStep = 0.5) {
  const n = Math.max(1, Math.ceil(dt / maxStep))
  const h = dt / n
  for (let i = 0; i < n; i++) stepGravity(s, h)
}

export function altitude(p: Vec2): number {
  return Math.hypot(p.x, p.y) - PLANET_RADIUS
}

// Local "up" (radial unit vector) at a position.
export function radialUp(p: Vec2): Vec2 {
  const r = Math.hypot(p.x, p.y)
  return { x: p.x / r, y: p.y / r }
}

export interface OrbitElements {
  energy: number
  sma: number // semi-major axis (Infinity/negative when escaping)
  ecc: number
  apoapsis: number // altitude, Infinity if escaping
  periapsis: number // altitude
  argPeri: number // angle of periapsis from +x, radians
  p: number // semi-latus rectum
  angMom: number // specific angular momentum (sign = direction)
  bound: boolean
}

export function elements(s: FrameState): OrbitElements {
  const { p, v } = s
  const r = Math.hypot(p.x, p.y)
  const v2 = v.x * v.x + v.y * v.y
  const energy = v2 / 2 - MU / r
  const h = p.x * v.y - p.y * v.x
  const rv = p.x * v.x + p.y * v.y
  const ex = ((v2 - MU / r) * p.x - rv * v.x) / MU
  const ey = ((v2 - MU / r) * p.y - rv * v.y) / MU
  const ecc = Math.hypot(ex, ey)
  const semiLatus = (h * h) / MU
  const bound = energy < 0
  const sma = bound ? -MU / (2 * energy) : Infinity
  // Bound orbits use a(1±e), which stays finite for the degenerate
  // straight-up trajectories (h ≈ 0, e ≈ 1) every launch starts on.
  const rPeri = bound ? sma * (1 - ecc) : semiLatus / (1 + ecc)
  const rApo = bound ? sma * (1 + ecc) : Infinity
  return {
    energy,
    sma,
    ecc,
    apoapsis: rApo - PLANET_RADIUS,
    periapsis: rPeri - PLANET_RADIUS,
    argPeri: Math.atan2(ey, ex),
    p: semiLatus,
    angMom: h,
    bound,
  }
}

export function isStableOrbit(el: OrbitElements, atmosphereTop: number): boolean {
  return el.bound && el.periapsis > atmosphereTop && Number.isFinite(el.apoapsis)
}

// Sample the conic r(θ) = p / (1 + e·cos(θ − ω)) as a polyline for the
// map. Hyperbolic / near-escape arcs are clipped where r blows up; points
// below the surface are dropped so the line stops at the ground.
export function conicPoints(el: OrbitElements, samples = 180, maxR = PLANET_RADIUS * 8): Vec2[] {
  const out: Vec2[] = []
  if (el.p <= 0) return out
  for (let i = 0; i <= samples; i++) {
    const nu = (i / samples) * Math.PI * 2
    const denom = 1 + el.ecc * Math.cos(nu)
    if (denom <= 1e-3) {
      out.push({ x: NaN, y: NaN })
      continue
    }
    const r = el.p / denom
    if (r > maxR) {
      out.push({ x: NaN, y: NaN })
      continue
    }
    const theta = nu + el.argPeri
    out.push({ x: r * Math.cos(theta), y: r * Math.sin(theta) })
  }
  return out
}
