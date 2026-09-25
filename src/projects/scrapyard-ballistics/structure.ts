// Builds the Matter.js rig from a blueprint and watches its welds (SPEC.md
// section 5). Each part is one rectangle body; each weld is a pair of
// zero-length pins at the ends of the shared edge, which locks rotation
// but still lets a soft material flex a little. The world has gravity and
// collisions off: Matter is only resolving the rig's internal dynamics,
// while orbit.ts carries the whole thing through space.
import Matter from 'matter-js'
import { wetMass, type PartDef } from './parts'
import { blueprintStats, cellsOf, defOf, footprint, partCenter, upVector, welds, type Blueprint, type Dir, type Rot, type Vec } from './workshop'

export const PPM = 20 // Matter units per metre
export const STEP = 1 / 120 // s
export const STEP_MS = STEP * 1000

// Force (N) -> Matter force units, and torque (N·m) -> Matter torque units.
// See the unit notes in flight.ts.
export const N_TO_MATTER = PPM / 1e6
export const NM_TO_MATTER = (PPM * PPM) / 1e6

export interface RigPart {
  uid: number
  def: PartDef
  rot: Rot
  body: Matter.Body
  localUp: Vec // unit vector, part "up" in body frame at angle 0 (grid frame)
  w: number // footprint in metres (rotated)
  h: number
  neighbors: [number[], number[], number[], number[]] // welded uids by grid dir
  gridCenter: Vec // blueprint grid metres, for rendering the blueprint ghost
}

export interface RigWeld {
  a: number
  b: number
  cons: [Matter.Constraint, Matter.Constraint]
  rating: number // N
  load: number // N, smoothed
  fatigue: number // 0..1, accumulates while over 70% of rating
  alive: boolean
  // Section cut through this weld's edge, in blueprint grid metres: every
  // part whose centre lies beyond `coord` on `axis` (in the b direction)
  // is the far side; every weld on the same line shares the load.
  axis: 'x' | 'y'
  coord: number
  bSign: 1 | -1
}

export interface Rig {
  engine: Matter.Engine
  parts: Map<number, RigPart>
  welds: RigWeld[]
  commandUid: number | null
}

const WELD_STIFFNESS: Partial<Record<string, number>> = {
  rustyPlate: 0.55,
  steelScaffold: 0.8,
  aluminum: 0.9,
}

function weldStiffness(a: PartDef, b: PartDef): number {
  return Math.min(WELD_STIFFNESS[a.id] ?? 0.85, WELD_STIFFNESS[b.id] ?? 0.85)
}

export function buildRig(bp: Blueprint): Rig {
  const engine = Matter.Engine.create({
    gravity: { x: 0, y: 0, scale: 0 },
    positionIterations: 10,
    velocityIterations: 8,
    constraintIterations: 8,
    enableSleeping: false,
  })
  const stats = blueprintStats(bp)
  const origin = stats.com ?? { x: 0, y: 0 }
  const parts = new Map<number, RigPart>()

  for (const p of bp.parts) {
    const def = defOf(p)
    const { w, h } = footprint(p.partId, p.rot)
    const c = partCenter(p)
    const body = Matter.Bodies.rectangle((c.x - origin.x) * PPM, (c.y - origin.y) * PPM, w * PPM, h * PPM, {
      frictionAir: 0,
      friction: 0,
      restitution: 0,
      collisionFilter: { group: -1, category: 0x0001, mask: 0 },
      label: String(p.uid),
    })
    Matter.Body.setMass(body, wetMass(def))
    parts.set(p.uid, {
      uid: p.uid,
      def,
      rot: p.rot,
      body,
      localUp: upVector(p.rot),
      w,
      h,
      neighbors: [[], [], [], []],
      gridCenter: c,
    })
    Matter.Composite.add(engine.world, body)
  }

  const rigWelds: RigWeld[] = []
  for (const wd of welds(bp)) {
    const A = parts.get(wd.a)!
    const B = parts.get(wd.b)!
    const stiffness = weldStiffness(A.def, B.def)
    const pins = [
      { x: wd.x1, y: wd.y1 },
      { x: wd.x2, y: wd.y2 },
    ].map((pt) => {
      const wx = (pt.x - origin.x) * PPM
      const wy = (pt.y - origin.y) * PPM
      return Matter.Constraint.create({
        bodyA: A.body,
        bodyB: B.body,
        pointA: { x: wx - A.body.position.x, y: wy - A.body.position.y },
        pointB: { x: wx - B.body.position.x, y: wy - B.body.position.y },
        length: 0,
        stiffness,
        damping: 0.08,
      })
    }) as [Matter.Constraint, Matter.Constraint]
    Matter.Composite.add(engine.world, pins)
    rigWelds.push({
      a: wd.a,
      b: wd.b,
      cons: pins,
      rating: Math.min(A.def.integrity, B.def.integrity),
      load: 0,
      fatigue: 0,
      alive: true,
      axis: wd.x1 === wd.x2 ? 'x' : 'y',
      coord: wd.x1 === wd.x2 ? wd.x1 : wd.y1,
      bSign: (wd.x1 === wd.x2 ? B.gridCenter.x > wd.x1 : B.gridCenter.y > wd.y1) ? 1 : -1,
    })
    // Which side of each part the other sits on, in grid directions.
    const dirAB = gridDir(A.gridCenter, B.gridCenter, wd)
    A.neighbors[dirAB].push(wd.b)
    B.neighbors[((dirAB + 2) % 4) as Dir].push(wd.a)
  }

  const command = bp.parts.find((p) => defOf(p).command)
  return { engine, parts, welds: rigWelds, commandUid: command ? command.uid : null }
}

// Direction from A to B across the shared edge: a vertical edge (x1 === x2)
// means B is left or right; a horizontal one means above or below.
function gridDir(a: Vec, b: Vec, wd: { x1: number; x2: number; y1: number }): Dir {
  if (wd.x1 === wd.x2) return b.x > a.x ? 1 : 3
  return b.y > a.y ? 2 : 0
}

export interface PartLoad {
  fx: number // external force on the part this step, N (local frame, y down)
  fy: number
  torque: number // external couple, N·m (gyro)
}

export interface RigidMotion {
  ax: number // COM acceleration of the main craft, m/s² (external forces only -- the frame is free-falling)
  ay: number
  alpha: number // rad/s²
  omega: number // rad/s
  com: Vec // metres, local frame
}

// Rigid-body motion of the main craft implied by this step's external
// forces. Using the forces directly (rather than differencing Matter's
// jittery velocities) keeps the load readout steady.
export function rigidMotion(rig: Rig, main: Set<number>, loads: Map<number, PartLoad>, omega: number): RigidMotion {
  let m = 0
  let cx = 0
  let cy = 0
  for (const uid of main) {
    const b = rig.parts.get(uid)!.body
    m += b.mass
    cx += b.mass * b.position.x
    cy += b.mass * b.position.y
  }
  const com = { x: cx / m / PPM, y: cy / m / PPM }
  let fx = 0
  let fy = 0
  let tau = 0
  let inertia = 0
  for (const uid of main) {
    const b = rig.parts.get(uid)!.body
    const rx = b.position.x / PPM - com.x
    const ry = b.position.y / PPM - com.y
    const l = loads.get(uid)
    inertia += b.inertia / (PPM * PPM) + b.mass * (rx * rx + ry * ry)
    if (!l) continue
    fx += l.fx
    fy += l.fy
    tau += rx * l.fy - ry * l.fx + l.torque
  }
  return { ax: fx / m, ay: fy / m, alpha: inertia > 0 ? tau / inertia : 0, omega, com }
}

// Section-cut weld loads. Every live weld lies on a straight cut line
// (the edge it welds). Newton on the far side of that line says the
// structure must be supplying
//   F = Σ (m·a_i − F_ext,i)   and   M = Σ [(r_i − c) × (m·a_i − F_ext,i) + I_i·α − τ_ext,i]
// about the section centroid c, where a_i is the rigid-body acceleration
// at part i. The welds on the line then share it like a bolt group: F
// evenly, M in proportion to each pin's distance from c (M·d / Σd²).
// Returns welds that broke.
export function updateWeldLoads(
  rig: Rig,
  main: Set<number>,
  loads: Map<number, PartLoad>,
  motion: RigidMotion,
  dt: number,
  loadScale = 1,
): RigWeld[] {
  const broken: RigWeld[] = []
  const lines = new Map<string, RigWeld[]>()
  for (const w of rig.welds) {
    if (!w.alive) continue
    if (!main.has(w.a) || !main.has(w.b)) {
      // Welds on debris still exist but aren't worth stressing.
      w.load *= 0.9
      continue
    }
    const k = `${w.axis}${w.coord}`
    if (!lines.has(k)) lines.set(k, [])
    lines.get(k)!.push(w)
  }
  const w2 = motion.omega * motion.omega
  for (const group of lines.values()) {
    const { axis, coord } = group[0]
    // Pin positions (metres, local) and the section centroid.
    const pins: { x: number; y: number }[][] = group.map((w) =>
      w.cons.map((c) => {
        const bA = c.bodyA!
        return { x: (bA.position.x + c.pointA.x) / PPM, y: (bA.position.y + c.pointA.y) / PPM }
      }),
    )
    let cx = 0
    let cy = 0
    let n = 0
    for (const pp of pins) for (const pt of pp) {
      cx += pt.x
      cy += pt.y
      n++
    }
    cx /= n
    cy /= n
    let J = 0
    for (const pp of pins) for (const pt of pp) J += (pt.x - cx) ** 2 + (pt.y - cy) ** 2
    let fx = 0
    let fy = 0
    let mom = 0
    for (const uid of main) {
      const part = rig.parts.get(uid)!
      const along = axis === 'x' ? part.gridCenter.x : part.gridCenter.y
      if (along <= coord + 1e-6) continue // far side = the +axis side
      const b = part.body
      const px = b.position.x / PPM
      const py = b.position.y / PPM
      const rx = px - motion.com.x
      const ry = py - motion.com.y
      // a_i = a_cm + α ẑ×r − ω² r   (ẑ×r = (−ry, rx) in a y-down frame)
      const aix = motion.ax - motion.alpha * ry - w2 * rx
      const aiy = motion.ay + motion.alpha * rx - w2 * ry
      const l = loads.get(uid)
      const nx = b.mass * aix - (l?.fx ?? 0)
      const ny = b.mass * aiy - (l?.fy ?? 0)
      fx += nx
      fy += ny
      mom += (px - cx) * ny - (py - cy) * nx + (b.inertia / (PPM * PPM)) * motion.alpha - (l?.torque ?? 0)
    }
    const shear = Math.hypot(fx, fy) / group.length
    group.forEach((w, i) => {
      let bend = 0
      if (J > 1e-9) for (const pt of pins[i]) bend += (Math.abs(mom) * Math.hypot(pt.x - cx, pt.y - cy)) / J
      const load = (shear + bend / 2) * loadScale
      // Smooth over a few steps so single-step force spikes don't snap a weld.
      w.load += (load - w.load) * 0.2
      const ratio = w.load / w.rating
      if (ratio > 0.7) w.fatigue = Math.min(1, w.fatigue + (ratio - 0.7) * dt * 0.8)
      const effectiveRating = w.rating * (1 - 0.5 * w.fatigue)
      if (w.load > effectiveRating) broken.push(w)
    })
  }
  return broken
}

export function breakWeld(rig: Rig, w: RigWeld) {
  if (!w.alive) return
  w.alive = false
  Matter.Composite.remove(rig.engine.world, w.cons[0])
  Matter.Composite.remove(rig.engine.world, w.cons[1])
  const A = rig.parts.get(w.a)
  const B = rig.parts.get(w.b)
  if (A) A.neighbors = A.neighbors.map((n) => n.filter((u) => u !== w.b)) as RigPart['neighbors']
  if (B) B.neighbors = B.neighbors.map((n) => n.filter((u) => u !== w.a)) as RigPart['neighbors']
}

// Every weld touching a part -- how bolts blow and how parts explode.
export function breakAllWeldsOf(rig: Rig, uid: number) {
  for (const w of rig.welds) if (w.alive && (w.a === uid || w.b === uid)) breakWeld(rig, w)
}

export function removePartBody(rig: Rig, uid: number) {
  breakAllWeldsOf(rig, uid)
  const p = rig.parts.get(uid)
  if (p) Matter.Composite.remove(rig.engine.world, p.body)
}

export function aliveEdges(rig: Rig): { a: number; b: number }[] {
  return rig.welds.filter((w) => w.alive)
}

// For rendering blueprint ghosts / part lookups by grid cell.
export function rigCells(bp: Blueprint): Map<number, [number, number][]> {
  const m = new Map<number, [number, number][]>()
  for (const p of bp.parts) m.set(p.uid, cellsOf(p))
  return m
}

// Matter's Verlet integrator stores velocity implicitly as the previous
// position/angle; @types/matter-js leaves those fields out.
export type BodyInternals = Matter.Body & { positionPrev: Matter.Vector; anglePrev: number }

export function internals(b: Matter.Body): BodyInternals {
  return b as BodyInternals
}

// Unit conversions between Matter's per-step displacement velocities and
// m/s, used by flight.ts's rebase and drag code.
export function bodyVelocity(b: Matter.Body, dt: number): Vec {
  const prev = internals(b).positionPrev
  return {
    x: (b.position.x - prev.x) / PPM / dt,
    y: (b.position.y - prev.y) / PPM / dt,
  }
}

export function setBodyVelocity(b: Matter.Body, v: Vec, dt: number) {
  const prev = internals(b).positionPrev
  prev.x = b.position.x - v.x * dt * PPM
  prev.y = b.position.y - v.y * dt * PPM
}

export function bodyAngularVelocity(b: Matter.Body, dt: number): number {
  return (b.angle - internals(b).anglePrev) / dt
}
