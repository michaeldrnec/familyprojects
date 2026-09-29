// The liquid cat (SPEC.md section 3): a ring of circle particles around a
// hidden centre, held together by perimeter springs, cross braces, soft
// spokes and a pressure term that pushes the ring back toward its rest
// area. Low stiffness lets it pour through gaps narrower than itself;
// pressure keeps it from collapsing into a puddle. Reflex state (loaf,
// claw grip, glide, swishes) also lives here.
import Matter from 'matter-js'
import type { Breed } from './breeds'
import { CAT_CATBODY, CAT_SENSOR, CAT_SHARD, CAT_WORLD } from './objects'

export const RING_N = 12

export type CatState = 'flying' | 'gripping' | 'gone'

export interface Cat {
  breed: Breed
  ring: Matter.Body[]
  center: Matter.Body
  perimeter: Matter.Constraint[]
  braces: Matter.Constraint[]
  spokes: Matter.Constraint[]
  restArea: number
  state: CatState
  loaf: boolean
  holding: boolean
  glide: number // seconds of floof glide left
  swishes: number
  abilityLeft: number
  gripUsed: boolean
  grip: Matter.Constraint | null
  gripTime: number
  slam: number // seconds the Chonk Slam impact boost stays armed
  zoom: number // seconds of zoomies streak (cosmetic)
  spin: number // cosmetic corkscrew
  lastBounce: number
  flightTime: number
  face: 'focus' | 'wide' | 'smug' | 'yowl'
}


export function createCat(world: Matter.World, breed: Breed, x: number, y: number): Cat {
  const group = Matter.Body.nextGroup(true)
  const R = breed.radius
  const ring: Matter.Body[] = []
  const particleMass = (breed.mass * 0.9) / RING_N
  for (let i = 0; i < RING_N; i++) {
    const a = (i / RING_N) * Math.PI * 2
    const p = Matter.Bodies.circle(x + Math.cos(a) * R, y + Math.sin(a) * R, breed.particleRadius, {
      friction: breed.friction,
      frictionStatic: 0.6,
      restitution: breed.restitution,
      frictionAir: 0.003,
      slop: 0.02,
      label: 'cat',
      sleepThreshold: -1,
      collisionFilter: { group, category: CAT_CATBODY, mask: CAT_WORLD | CAT_SENSOR | CAT_SHARD },
    })
    Matter.Body.setMass(p, particleMass)
    ring.push(p)
  }
  const center = Matter.Bodies.circle(x, y, 6, {
    label: 'catCenter',
    frictionAir: 0.003,
    sleepThreshold: -1,
    collisionFilter: { group, category: CAT_CATBODY, mask: 0 },
  })
  Matter.Body.setMass(center, breed.mass * 0.1)

  const perimeter: Matter.Constraint[] = []
  const braces: Matter.Constraint[] = []
  const spokes: Matter.Constraint[] = []
  for (let i = 0; i < RING_N; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % RING_N]
    const c = ring[(i + 2) % RING_N]
    perimeter.push(Matter.Constraint.create({ bodyA: a, bodyB: b, stiffness: breed.ringStiffness, damping: 0.05 }))
    braces.push(Matter.Constraint.create({ bodyA: a, bodyB: c, stiffness: breed.ringStiffness * 0.35, damping: 0.05 }))
    spokes.push(Matter.Constraint.create({ bodyA: center, bodyB: a, stiffness: breed.spokeStiffness, damping: 0.05 }))
  }
  Matter.Composite.add(world, [...ring, center, ...perimeter, ...braces, ...spokes])

  return {
    breed,
    ring,
    center,
    perimeter,
    braces,
    spokes,
    restArea: polygonArea(ring),
    state: 'flying',
    loaf: false,
    holding: false,
    glide: 0,
    swishes: 2,
    abilityLeft: breed.abilityUses,
    gripUsed: false,
    grip: null,
    gripTime: 0,
    slam: 0,
    zoom: 0,
    spin: 0,
    lastBounce: -1,
    flightTime: 0,
    face: 'wide',
  }
}

export function removeCat(world: Matter.World, cat: Cat) {
  if (cat.grip) Matter.Composite.remove(world, cat.grip)
  Matter.Composite.remove(world, [...cat.ring, cat.center, ...cat.perimeter, ...cat.braces, ...cat.spokes])
  cat.state = 'gone'
}

export function polygonArea(ring: Matter.Body[]): number {
  let a = 0
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i].position
    const q = ring[(i + 1) % ring.length].position
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
}

export function catCenter(cat: Cat): { x: number; y: number } {
  let x = 0
  let y = 0
  for (const p of cat.ring) {
    x += p.position.x
    y += p.position.y
  }
  return { x: x / cat.ring.length, y: y / cat.ring.length }
}

export function catVelocity(cat: Cat): { x: number; y: number } {
  let x = 0
  let y = 0
  for (const p of cat.ring) {
    const v = Matter.Body.getVelocity(p)
    x += v.x
    y += v.y
  }
  return { x: x / cat.ring.length, y: y / cat.ring.length }
}

// Mean rotation of the ring relative to its rest layout -- which way the
// cat's head is pointing.
export function catAngle(cat: Cat): number {
  const c = catCenter(cat)
  let sx = 0
  let sy = 0
  for (let i = 0; i < RING_N; i++) {
    const p = cat.ring[i].position
    const rest = (i / RING_N) * Math.PI * 2
    const cur = Math.atan2(p.y - c.y, p.x - c.x)
    sx += Math.cos(cur - rest)
    sy += Math.sin(cur - rest)
  }
  return Math.atan2(sy, sx)
}

export function setCatVelocity(cat: Cat, v: { x: number; y: number }) {
  for (const b of [...cat.ring, cat.center]) Matter.Body.setVelocity(b, v)
}

export function addCatVelocity(cat: Cat, dv: { x: number; y: number }) {
  for (const b of [...cat.ring, cat.center]) {
    const v = Matter.Body.getVelocity(b)
    Matter.Body.setVelocity(b, { x: v.x + dv.x, y: v.y + dv.y })
  }
}

// Called every substep: pressure toward rest area (liquid, not puddle),
// glide drag, loaf-mode firmness.
export function stepCat(cat: Cat, dt: number) {
  if (cat.state === 'gone') return
  cat.flightTime += dt
  if (cat.slam > 0) cat.slam -= dt
  if (cat.zoom > 0) cat.zoom -= dt
  cat.spin *= 0.97

  const target = cat.restArea * (cat.loaf ? 0.62 : 1)
  const area = polygonArea(cat.ring)
  // Ring winding sign: rest area is positive for the layout built above.
  const deficit = (target - area) / Math.abs(target)
  const k = cat.breed.pressure * (cat.loaf ? 2.2 : 1) * deficit * 0.9
  if (Math.abs(k) > 1e-4) {
    for (let i = 0; i < RING_N; i++) {
      const prev = cat.ring[(i + RING_N - 1) % RING_N].position
      const next = cat.ring[(i + 1) % RING_N].position
      // Outward normal of the edge through the neighbours.
      let nx = next.y - prev.y
      let ny = -(next.x - prev.x)
      const len = Math.hypot(nx, ny) || 1
      nx /= len
      ny /= len
      const v = Matter.Body.getVelocity(cat.ring[i])
      Matter.Body.setVelocity(cat.ring[i], { x: v.x + nx * k * dt * 6, y: v.y + ny * k * dt * 6 })
    }
  }

  if (cat.glide > 0) {
    cat.glide -= dt
    for (const b of [...cat.ring, cat.center]) {
      const v = Matter.Body.getVelocity(b)
      Matter.Body.setVelocity(b, { x: v.x * 0.996, y: Math.min(v.y, 2.2) })
    }
  }
}

export function setLoaf(cat: Cat, on: boolean) {
  if (cat.loaf === on) return
  cat.loaf = on
  const mult = on ? 2 : 0.5
  for (const p of cat.ring) {
    Matter.Body.setMass(p, p.mass * mult)
    p.restitution = on ? 0.05 : cat.breed.restitution
  }
  const stiff = on ? 3 : 1
  for (const c of cat.perimeter) c.stiffness = Math.min(0.95, cat.breed.ringStiffness * stiff)
  for (const c of cat.spokes) c.stiffness = Math.min(0.9, cat.breed.spokeStiffness * stiff)
}

export function catMass(cat: Cat): number {
  return cat.breed.mass * (cat.loaf ? 2 : 1)
}
