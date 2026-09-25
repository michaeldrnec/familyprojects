// Blueprint grid logic for the workshop (SPEC.md section 3): placement,
// rotation, which faces weld together, connected components and the live
// COM / center-of-thrust / torque readout. Pure data -- no DOM, no Matter --
// so structure.ts can build the physics rig from the same weld list the
// workshop overlays draw.
import { PART_DEFS, G0, fuelFlow, wetMass, type PartDef, type PartId } from './parts'
import type { Wire, PartSettings } from './wiring'

export const GRID_COLS = 9
export const GRID_ROWS = 14

export type Rot = 0 | 1 | 2 | 3 // quarter turns clockwise
export type Dir = 0 | 1 | 2 | 3 // 0 top, 1 right, 2 bottom, 3 left

export interface PlacedPart {
  uid: number
  partId: PartId
  c: number
  r: number
  rot: Rot
}

export interface Blueprint {
  parts: PlacedPart[]
  wires: Wire[]
  settings: Record<number, PartSettings>
  nextUid: number
}

export interface Weld {
  a: number // uid
  b: number // uid
  // shared edge endpoints in grid meters (origin = grid top-left, y down)
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface Vec {
  x: number
  y: number
}

const DIR_STEP: Vec[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
]

export function emptyBlueprint(): Blueprint {
  return { parts: [], wires: [], settings: {}, nextUid: 1 }
}

export function footprint(partId: PartId, rot: Rot): { w: number; h: number } {
  const def = PART_DEFS[partId]
  return rot % 2 === 0 ? { w: def.w, h: def.h } : { w: def.h, h: def.w }
}

export function cellsOf(p: PlacedPart): [number, number][] {
  const { w, h } = footprint(p.partId, p.rot)
  const out: [number, number][] = []
  for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) out.push([p.c + dx, p.r + dy])
  return out
}

export function partCenter(p: PlacedPart): Vec {
  const { w, h } = footprint(p.partId, p.rot)
  return { x: p.c + w / 2, y: p.r + h / 2 }
}

// Unit vector a rotated part's "up" (its unrotated -y) points along, in grid
// coordinates. Engines thrust along this.
export function upVector(rot: Rot): Vec {
  return DIR_STEP[rot]
}

export function faceAttachable(p: PlacedPart, dir: Dir): boolean {
  const original = (dir - p.rot + 4) % 4
  return PART_DEFS[p.partId].attach[original]
}

// A bolt ring clamps around an engine's nozzle bell, so engines can sit
// directly on a staging bolt even though a nozzle face won't weld to
// anything else.
function canWeld(p: PlacedPart, n: PlacedPart, dir: Dir): boolean {
  const back = ((dir + 2) % 4) as Dir
  const pOk = faceAttachable(p, dir) || (!!defOf(n).bolt && !!defOf(p).engine)
  const nOk = faceAttachable(n, back) || (!!defOf(p).bolt && !!defOf(n).engine)
  return pOk && nOk
}

function key(c: number, r: number) {
  return c * 100 + r
}

export function occupancy(bp: Blueprint): Map<number, PlacedPart> {
  const map = new Map<number, PlacedPart>()
  for (const p of bp.parts) for (const [c, r] of cellsOf(p)) map.set(key(c, r), p)
  return map
}

export function partAt(bp: Blueprint, c: number, r: number): PlacedPart | undefined {
  return occupancy(bp).get(key(c, r))
}

export function canPlace(bp: Blueprint, partId: PartId, c: number, r: number, rot: Rot, ignoreUid?: number): boolean {
  const { w, h } = footprint(partId, rot)
  if (c < 0 || r < 0 || c + w > GRID_COLS || r + h > GRID_ROWS) return false
  const occ = occupancy(bp)
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      const hit = occ.get(key(c + dx, r + dy))
      if (hit && hit.uid !== ignoreUid) return false
    }
  }
  return true
}

export function placePart(bp: Blueprint, partId: PartId, c: number, r: number, rot: Rot): Blueprint {
  const part: PlacedPart = { uid: bp.nextUid, partId, c, r, rot }
  return { ...bp, parts: [...bp.parts, part], nextUid: bp.nextUid + 1 }
}

export function removePart(bp: Blueprint, uid: number): Blueprint {
  const settings = { ...bp.settings }
  delete settings[uid]
  return {
    ...bp,
    parts: bp.parts.filter((p) => p.uid !== uid),
    wires: bp.wires.filter((w) => w.to.uid !== uid && !(w.from.kind === 'part' && w.from.uid === uid)),
    settings,
  }
}

// Rotating in place can fail (a 1x2 part rotating into a wall or a
// neighbor); returns null so the caller can play the denied cue.
export function rotatePart(bp: Blueprint, uid: number): Blueprint | null {
  const p = bp.parts.find((q) => q.uid === uid)
  if (!p) return null
  const rot = ((p.rot + 1) % 4) as Rot
  if (!canPlace(bp, p.partId, p.c, p.r, rot, uid)) return null
  return { ...bp, parts: bp.parts.map((q) => (q.uid === uid ? { ...q, rot } : q)) }
}

export function welds(bp: Blueprint): Weld[] {
  const occ = occupancy(bp)
  const out: Weld[] = []
  for (const p of bp.parts) {
    for (const [c, r] of cellsOf(p)) {
      // Only look right and down so each shared edge is visited once.
      for (const dir of [1, 2] as Dir[]) {
        const n = occ.get(key(c + DIR_STEP[dir].x, r + DIR_STEP[dir].y))
        if (!n || n.uid === p.uid) continue
        if (!canWeld(p, n, dir)) continue
        if (dir === 1) out.push({ a: p.uid, b: n.uid, x1: c + 1, y1: r, x2: c + 1, y2: r + 1 })
        else out.push({ a: p.uid, b: n.uid, x1: c, y1: r + 1, x2: c + 1, y2: r + 1 })
      }
    }
  }
  return out
}

// Union-find over a uid set and a list of edges. Shared by the workshop's
// disconnected-part warning and flight's live breakup detection.
export function components(uids: number[], edges: { a: number; b: number }[]): number[][] {
  const parent = new Map<number, number>()
  for (const u of uids) parent.set(u, u)
  function find(u: number): number {
    let root = u
    while (parent.get(root) !== root) root = parent.get(root)!
    while (parent.get(u) !== root) {
      const next = parent.get(u)!
      parent.set(u, root)
      u = next
    }
    return root
  }
  for (const e of edges) {
    if (!parent.has(e.a) || !parent.has(e.b)) continue
    parent.set(find(e.a), find(e.b))
  }
  const groups = new Map<number, number[]>()
  for (const u of uids) {
    const root = find(u)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root)!.push(u)
  }
  return [...groups.values()]
}

export function defOf(p: PlacedPart): PartDef {
  return PART_DEFS[p.partId]
}

export interface BlueprintStats {
  mass: number // wet kg
  dryMass: number
  com: Vec | null
  cot: Vec | null // center of thrust for the IGNITE stage
  thrust: number // N, IGNITE stage, nominal
  torque: number // N·m about COM, IGNITE stage (positive = clockwise on screen)
  twr: number
  deltaV: number // rough all-up estimate, m/s
  warnings: string[]
}

export function igniteStageUids(bp: Blueprint): number[] {
  const wired = bp.wires
    .filter((w) => w.from.kind === 'button' && w.from.id === 'IGNITE' && w.to.port === 'ignite')
    .map((w) => w.to.uid)
  return wired
}

export function blueprintStats(bp: Blueprint): BlueprintStats {
  let mass = 0
  let dryMass = 0
  let mx = 0
  let my = 0
  for (const p of bp.parts) {
    const def = defOf(p)
    const m = wetMass(def)
    const c = partCenter(p)
    mass += m
    dryMass += def.mass
    mx += m * c.x
    my += m * c.y
  }
  const com = mass > 0 ? { x: mx / mass, y: my / mass } : null

  const igniteUids = new Set(igniteStageUids(bp))
  const engines = bp.parts.filter((p) => defOf(p).engine)
  const stageEngines = igniteUids.size > 0 ? engines.filter((p) => igniteUids.has(p.uid)) : engines
  let thrust = 0
  let tx = 0
  let ty = 0
  let fx = 0
  let fy = 0
  let torque = 0
  for (const p of stageEngines) {
    const e = defOf(p).engine!
    const c = partCenter(p)
    const up = upVector(p.rot)
    thrust += e.thrust
    tx += e.thrust * c.x
    ty += e.thrust * c.y
    fx += up.x * e.thrust
    fy += up.y * e.thrust
    if (com) torque += (c.x - com.x) * up.y * e.thrust - (c.y - com.y) * up.x * e.thrust
  }
  const cot = thrust > 0 ? { x: tx / thrust, y: ty / thrust } : null
  const netUp = -fy
  const twr = mass > 0 ? netUp / (mass * G0) : 0

  // All-up Δv: thrust-weighted Isp across every engine, full wet -> dry.
  let ispNum = 0
  let ispDen = 0
  for (const p of engines) {
    const e = defOf(p).engine!
    ispNum += e.thrust
    ispDen += fuelFlow(e)
  }
  const isp = ispDen > 0 ? ispNum / ispDen / G0 : 0
  const deltaV = dryMass > 0 && isp > 0 ? isp * G0 * Math.log(mass / dryMass) : 0

  const warnings: string[] = []
  const commands = bp.parts.filter((p) => defOf(p).command)
  if (commands.length === 0) warnings.push('No command seat — nobody is flying this thing.')
  if (commands.length > 1) warnings.push('More than one command seat — only the first one counts.')
  if (engines.length === 0) warnings.push('No engines. Bold.')
  if (bp.parts.length > 0) {
    const comps = components(bp.parts.map((p) => p.uid), welds(bp))
    if (comps.length > 1) warnings.push(`${comps.length - 1} part group(s) aren't welded to anything — they'll fall off at launch.`)
  }
  if (engines.length > 0 && igniteUids.size === 0) warnings.push('Nothing is wired to IGNITE. Open Wiring (or Auto-wire).')
  const tanklessEngines = engines.filter((p) => !defOf(p).engine!.internalFuel)
  if (tanklessEngines.length > 0 && !bp.parts.some((p) => defOf(p).tank)) warnings.push('Engines need a fuel tank on their stage.')
  if (thrust > 0 && twr < 1) warnings.push(`Liftoff TWR ${twr.toFixed(2)} — it won't leave the pad.`)
  if (thrust > 0 && Math.abs(torque) > 1500) warnings.push('Thrust is off-center — expect it to veer hard.')
  if (!bp.parts.some((p) => defOf(p).chute)) warnings.push('No parachute. The pilot has opinions about that.')

  return { mass, dryMass, com, cot, thrust, torque, twr, deltaV, warnings }
}

// Parts in the blueprint beyond what the inventory holds -- the workshop
// greys these out and Launch refuses until they're removed.
export function inventoryShortfall(bp: Blueprint, inventory: Partial<Record<PartId, number>>): Partial<Record<PartId, number>> {
  const used: Partial<Record<PartId, number>> = {}
  for (const p of bp.parts) used[p.partId] = (used[p.partId] ?? 0) + 1
  const short: Partial<Record<PartId, number>> = {}
  for (const [id, n] of Object.entries(used) as [PartId, number][]) {
    const have = inventory[id] ?? 0
    if (n > have) short[id] = n - have
  }
  return short
}

export function partCounts(bp: Blueprint): Partial<Record<PartId, number>> {
  const used: Partial<Record<PartId, number>> = {}
  for (const p of bp.parts) used[p.partId] = (used[p.partId] ?? 0) + 1
  return used
}

// Parts on the board the inventory can't cover (lost last flight), by uid,
// so the board can cross them out.
export function missingUids(bp: Blueprint, inventory: Partial<Record<PartId, number>>): Set<number> {
  const remaining = { ...inventory }
  const out = new Set<number>()
  for (const p of bp.parts) {
    const n = remaining[p.partId] ?? 0
    if (n > 0) remaining[p.partId] = n - 1
    else out.add(p.uid)
  }
  return out
}
