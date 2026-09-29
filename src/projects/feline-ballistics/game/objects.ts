// Prefab library (SPEC.md section 5): every household object a level can
// place, as convex Matter shapes only (no poly-decomp dependency), plus
// the shard slicing used when something breaks.
import Matter from 'matter-js'
import { MATERIALS, type MaterialId } from './materials'
import type { Rng } from '../rng'

export type PrefabId =
  // kitchen
  | 'mug' | 'plate' | 'bowl' | 'wineGlass' | 'vase' | 'jar' | 'spiceJar' | 'teapot' | 'cuttingBoard' | 'pot'
  // books, boxes, wood
  | 'book' | 'bookFlat' | 'box' | 'crate' | 'plank' | 'post' | 'woodBlock'
  // soft stuff
  | 'laundryBasket' | 'laundryPile' | 'pillow'
  // office
  | 'monitor' | 'keyboard' | 'paperStack' | 'glassPane' | 'lamp' | 'mugWorld'
  // bedroom
  | 'figurine' | 'perfume' | 'snowGlobe' | 'alarmClock' | 'trophy' | 'candle'
  // static furniture & room parts
  | 'shelf' | 'counter' | 'fridge' | 'table' | 'sofa' | 'bed' | 'nightstand' | 'desk' | 'bookcase' | 'floorboard' | 'block'
  | 'windowPane'
  // special
  | 'curtain' | 'towel' | 'beam' | 'fan' | 'humanFace' | 'dogBed'

export type Shape = 'rect' | 'trapezoid' | 'circle' | 'compound'

export interface PrefabDef {
  w: number
  h: number
  material: MaterialId
  shape: Shape
  slope?: number // trapezoid slope (Matter's 0..1)
  isStatic?: boolean
  sensor?: 'grip' | 'fan' | 'face' // non-colliding trigger zones
  breakableStatic?: boolean // static until broken (floorboards, window panes)
  label: string
}

export const PREFABS: Record<PrefabId, PrefabDef> = {
  mug: { w: 34, h: 38, material: 'ceramic', shape: 'rect', label: 'Mug' },
  mugWorld: { w: 34, h: 38, material: 'ceramic', shape: 'rect', label: "World's Best Dad mug" },
  plate: { w: 64, h: 9, material: 'ceramic', shape: 'rect', label: 'Plate' },
  bowl: { w: 56, h: 24, material: 'ceramic', shape: 'trapezoid', slope: 0.35, label: 'Bowl' },
  wineGlass: { w: 20, h: 52, material: 'thinGlass', shape: 'rect', label: 'Wine glass' },
  vase: { w: 40, h: 72, material: 'glass', shape: 'trapezoid', slope: 0.25, label: 'Crystal vase' },
  jar: { w: 34, h: 46, material: 'glass', shape: 'rect', label: 'Cookie jar' },
  spiceJar: { w: 18, h: 30, material: 'glass', shape: 'rect', label: 'Spice jar' },
  teapot: { w: 56, h: 44, material: 'ceramic', shape: 'trapezoid', slope: 0.3, label: 'Teapot' },
  cuttingBoard: { w: 96, h: 14, material: 'wood', shape: 'rect', label: 'Cutting board' },
  pot: { w: 60, h: 44, material: 'metal', shape: 'rect', label: 'Stock pot' },
  book: { w: 24, h: 66, material: 'cardboard', shape: 'rect', label: 'Book' },
  bookFlat: { w: 70, h: 18, material: 'cardboard', shape: 'rect', label: 'Book' },
  box: { w: 62, h: 50, material: 'cardboard', shape: 'rect', label: 'Box' },
  crate: { w: 60, h: 60, material: 'wood', shape: 'rect', label: 'Crate' },
  plank: { w: 130, h: 16, material: 'wood', shape: 'rect', label: 'Plank' },
  post: { w: 18, h: 96, material: 'wood', shape: 'rect', label: 'Post' },
  woodBlock: { w: 42, h: 42, material: 'wood', shape: 'rect', label: 'Block' },
  laundryBasket: { w: 78, h: 56, material: 'fabric', shape: 'compound', label: 'Laundry basket' },
  laundryPile: { w: 86, h: 36, material: 'fabric', shape: 'trapezoid', slope: 0.45, label: 'Laundry' },
  pillow: { w: 74, h: 28, material: 'fabric', shape: 'rect', label: 'Pillow' },
  monitor: { w: 110, h: 84, material: 'electronics', shape: 'compound', label: 'Monitor' },
  keyboard: { w: 96, h: 12, material: 'electronics', shape: 'rect', label: 'Keyboard' },
  paperStack: { w: 60, h: 26, material: 'paper', shape: 'rect', label: 'Paperwork' },
  glassPane: { w: 12, h: 110, material: 'thinGlass', shape: 'rect', label: 'Glass pane' },
  lamp: { w: 40, h: 70, material: 'ceramic', shape: 'trapezoid', slope: 0.5, label: 'Lamp' },
  figurine: { w: 22, h: 40, material: 'ceramic', shape: 'rect', label: 'Figurine' },
  perfume: { w: 20, h: 32, material: 'glass', shape: 'rect', label: 'Perfume' },
  snowGlobe: { w: 34, h: 34, material: 'glass', shape: 'circle', label: 'Snow globe' },
  alarmClock: { w: 46, h: 40, material: 'electronics', shape: 'rect', label: 'Alarm clock' },
  trophy: { w: 30, h: 52, material: 'metal', shape: 'trapezoid', slope: 0.3, label: 'Trophy' },
  candle: { w: 16, h: 36, material: 'ceramic', shape: 'rect', label: 'Candle' },
  shelf: { w: 160, h: 14, material: 'static', shape: 'rect', isStatic: true, label: 'Shelf' },
  counter: { w: 300, h: 180, material: 'static', shape: 'rect', isStatic: true, label: 'Counter' },
  fridge: { w: 150, h: 380, material: 'static', shape: 'rect', isStatic: true, label: 'Fridge' },
  table: { w: 220, h: 150, material: 'static', shape: 'compound', isStatic: true, label: 'Table' },
  sofa: { w: 320, h: 120, material: 'static', shape: 'compound', isStatic: true, label: 'Sofa' },
  bed: { w: 420, h: 110, material: 'static', shape: 'rect', isStatic: true, label: 'Bed' },
  nightstand: { w: 110, h: 120, material: 'static', shape: 'rect', isStatic: true, label: 'Nightstand' },
  desk: { w: 320, h: 150, material: 'static', shape: 'compound', isStatic: true, label: 'Desk' },
  bookcase: { w: 180, h: 16, material: 'static', shape: 'rect', isStatic: true, label: 'Bookcase shelf' },
  block: { w: 100, h: 100, material: 'static', shape: 'rect', isStatic: true, label: 'Wall' },
  floorboard: { w: 90, h: 22, material: 'floorboard', shape: 'rect', isStatic: true, breakableStatic: true, label: 'Floorboard' },
  windowPane: { w: 14, h: 160, material: 'thinGlass', shape: 'rect', isStatic: true, breakableStatic: true, label: 'Window' },
  curtain: { w: 60, h: 300, material: 'fabric', shape: 'rect', isStatic: true, sensor: 'grip', label: 'Curtain' },
  towel: { w: 44, h: 90, material: 'fabric', shape: 'rect', isStatic: true, sensor: 'grip', label: 'Dish towel' },
  beam: { w: 240, h: 30, material: 'wood', shape: 'rect', isStatic: true, sensor: 'grip', label: 'Beam' },
  fan: { w: 220, h: 220, material: 'metal', shape: 'circle', isStatic: true, sensor: 'fan', label: 'Ceiling fan' },
  humanFace: { w: 90, h: 50, material: 'fabric', shape: 'rect', isStatic: true, sensor: 'face', label: 'Human' },
  dogBed: { w: 150, h: 26, material: 'fabric', shape: 'rect', isStatic: true, label: 'Dog bed' },
}

// Collision categories.
export const SOFA_GAP = 40

export const CAT_WORLD = 0x0001
export const CAT_CATBODY = 0x0002
export const CAT_SENSOR = 0x0004
export const CAT_SHARD = 0x0008

// Build the Matter body for a prefab whose *bottom centre* sits at (x, y).
export function buildPrefab(id: PrefabId, x: number, y: number, angle = 0, w?: number, h?: number): Matter.Body {
  const def = PREFABS[id]
  const W = w ?? def.w
  const H = h ?? def.h
  const mat = MATERIALS[def.material]
  const cx = x
  const cy = y - H / 2
  const opts: Matter.IChamferableBodyDefinition = {
    friction: mat.friction,
    frictionStatic: 0.9,
    restitution: mat.restitution,
    density: mat.density,
    isStatic: !!def.isStatic,
    isSensor: !!def.sensor,
    slop: 0.04,
    collisionFilter: def.sensor
      ? { category: CAT_SENSOR, mask: CAT_CATBODY }
      : { category: CAT_WORLD, mask: CAT_WORLD | CAT_CATBODY | CAT_SHARD },
  }
  let body: Matter.Body
  if (def.shape === 'trapezoid') {
    body = Matter.Bodies.trapezoid(cx, cy, W, H, def.slope ?? 0.3, opts)
  } else if (def.shape === 'circle') {
    body = Matter.Bodies.circle(cx, cy, W / 2, opts)
  } else if (def.shape === 'compound') {
    body = buildCompound(id, cx, cy, W, H, opts)
  } else {
    body = Matter.Bodies.rectangle(cx, cy, W, H, opts)
  }
  if (angle) Matter.Body.setAngle(body, angle)
  if (id === 'bed') body.restitution = 0.9 // the Tiptoe trampoline
  return body
}

function buildCompound(id: PrefabId, cx: number, cy: number, W: number, H: number, opts: Matter.IChamferableBodyDefinition): Matter.Body {
  const R = Matter.Bodies.rectangle
  const partOpts = { ...opts, isStatic: false }
  let parts: Matter.Body[]
  switch (id) {
    case 'laundryBasket':
      // A U: floor + two walls, with a soft bundle inside.
      parts = [
        R(cx, cy + H / 2 - 5, W, 10, partOpts),
        R(cx - W / 2 + 5, cy, 10, H, partOpts),
        R(cx + W / 2 - 5, cy, 10, H, partOpts),
        R(cx, cy + 4, W - 20, H - 26, partOpts),
      ]
      break
    case 'monitor':
      parts = [
        R(cx, cy - H / 2 + 33, W, 66, partOpts), // screen
        R(cx, cy + H / 2 - 12, 14, 16, partOpts), // neck
        R(cx, cy + H / 2 - 3, 60, 6, partOpts), // foot
      ]
      break
    case 'table':
      parts = [R(cx, cy - H / 2 + 8, W, 16, partOpts), R(cx - W / 2 + 12, cy + 8, 14, H - 16, partOpts), R(cx + W / 2 - 12, cy + 8, 14, H - 16, partOpts)]
      break
    case 'desk':
      parts = [R(cx, cy - H / 2 + 9, W, 18, partOpts), R(cx - W / 2 + 40, cy + 9, 80, H - 18, partOpts), R(cx + W / 2 - 10, cy + 9, 14, H - 18, partOpts)]
      break
    case 'sofa':
      // Seat on short legs so there's a gap underneath -- the "Under the
      // Sofa" squeeze. 40 units ≈ 0.59 of a Tabby's width: the M0 spike
      // showed liquid cats pour through ≥ 0.55 and jam below ~0.45.
      // In 2D a leg would wall off the whole opening, so the legs are
      // drawn (render/objects.ts) but have no physics; the arms stop at
      // the gap line.
      {
        const gapTop = cy + H / 2 - SOFA_GAP
        const armTop = cy - H / 2 + 10
        parts = [
          R(cx, gapTop - 25, W, 50, partOpts), // seat block
          R(cx + W / 2 - 18, (armTop + gapTop) / 2, 36, gapTop - armTop, partOpts), // arm
          R(cx - W / 2 + 18, (armTop + gapTop) / 2, 36, gapTop - armTop, partOpts), // arm
          R(cx, cy - H / 2 + 22, W - 70, 44, partOpts), // back cushion
        ]
      }
      break
    default:
      parts = [R(cx, cy, W, H, partOpts)]
  }
  const body = Matter.Body.create({ ...opts, parts })
  if (opts.isStatic) Matter.Body.setStatic(body, true)
  return body
}

// ---------------------------------------------------------------------------
// Shards: slice the broken object's footprint into small convex pieces that
// inherit its motion plus a spray. Pure geometry in the body's local frame,
// then transformed out by its position/angle.
// ---------------------------------------------------------------------------

export interface ShardSpec {
  verts: { x: number; y: number }[] // local
  cx: number
  cy: number
}

export function sliceShards(w: number, h: number, style: 'shards' | 'chunks' | 'planks', rng: Rng): ShardSpec[] {
  const out: ShardSpec[] = []
  if (style === 'planks') {
    // split across the long axis
    const long = w >= h
    for (const s of [-1, 1]) {
      const pw = long ? w / 2 - 2 : w
      const ph = long ? h : h / 2 - 2
      const cx = long ? (s * w) / 4 : 0
      const cy = long ? 0 : (s * h) / 4
      out.push({ cx, cy, verts: rectVerts(pw, ph) })
    }
    return out
  }
  const cols = style === 'shards' ? 3 : 2
  const rows = style === 'shards' ? Math.max(2, Math.round(h / w * 2)) : 2
  const cw = w / cols
  const ch = h / rows
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const cx = -w / 2 + cw * (i + 0.5)
      const cy = -h / 2 + ch * (j + 0.5)
      if (style === 'shards') {
        // a triangle per cell, jittered, so glass looks like glass
        const a = { x: -cw / 2 + rng.range(0, cw * 0.3), y: -ch / 2 }
        const b = { x: cw / 2, y: -ch / 2 + rng.range(0, ch * 0.4) }
        const c = { x: rng.range(-cw / 2, cw / 2), y: ch / 2 }
        out.push({ cx, cy, verts: [a, b, c] })
      } else {
        out.push({ cx, cy, verts: rectVerts(cw - 2, ch - 2) })
      }
    }
  }
  return out
}

function rectVerts(w: number, h: number) {
  return [
    { x: -w / 2, y: -h / 2 },
    { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 },
    { x: -w / 2, y: h / 2 },
  ]
}

export function buildShard(spec: ShardSpec, parent: Matter.Body, material: MaterialId): Matter.Body {
  const mat = MATERIALS[material]
  const cos = Math.cos(parent.angle)
  const sin = Math.sin(parent.angle)
  const wx = parent.position.x + spec.cx * cos - spec.cy * sin
  const wy = parent.position.y + spec.cx * sin + spec.cy * cos
  const verts = spec.verts.map((v) => ({ x: wx + v.x * cos - v.y * sin, y: wy + v.x * sin + v.y * cos }))
  const body = Matter.Bodies.fromVertices(wx, wy, [verts], {
    friction: 0.6,
    restitution: 0.2,
    density: mat.density,
    collisionFilter: { category: CAT_SHARD, mask: CAT_WORLD },
  })
  return body
}
