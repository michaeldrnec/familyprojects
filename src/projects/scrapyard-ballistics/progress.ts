// Persistent save (SPEC.md section 9), following ion-perimeter/progress.ts:
// one localStorage key, every read defensive, every write wrapped in
// try/catch so private browsing still plays fine without persistence.
import { PART_DEFS, type ContractId, type PartId } from './parts'
import { emptyBlueprint, placePart, type Blueprint, type Rot } from './workshop'
import { autoWire } from './wiring'
import { isJob, refillJobs, type Job } from './jobs'

const STORAGE_KEY = 'scrapyard-ballistics:save'

export interface SaveData {
  cash: number
  inventory: Partial<Record<PartId, number>>
  completed: ContractId[]
  bestAltitude: number
  flights: number
  blueprint: Blueprint
  designs: Design[] // named saved blueprints
  worn: Partial<Record<PartId, number>> // how many of each inventory part are worn
  jobs: Job[]
  bestTrack: TrackPoint[] // the best flight's altitude profile, for the ghost
}

export interface Design {
  name: string
  blueprint: Blueprint
}

// [time s, altitude m, downrange m], rounded so the save stays small.
export type TrackPoint = [number, number, number]

export const MAX_DESIGNS = 6

export const STARTING_CASH = 250

// Enough junk for one decent first hop -- see the balance notes in SPEC.md.
export const STARTER_INVENTORY: Partial<Record<PartId, number>> = {
  lawnChair: 1,
  mower: 3,
  gasCan: 3,
  rustyPlate: 4,
  fin: 2,
  chute: 1,
  bolt: 2,
  sodaKeg: 2,
  noseCone: 1,
  timer: 1,
}

// The scrap pile always tops you back up to a minimal launchable kit, so
// a run of crashes can't strand you with nothing to fly.
export const MINIMUM_KIT: Partial<Record<PartId, number>> = {
  lawnChair: 1,
  mower: 2,
  gasCan: 2,
  rustyPlate: 2,
  fin: 2,
  chute: 1,
}

// "Fence Hopper": three mowers on three jerry cans under the lawn chair,
// a chute on top and a fin either side of the engines. Built from the
// starter inventory and pre-wired, so a first flight is one button away.
export function starterBlueprint(): Blueprint {
  const layout: [PartId, number, number, Rot, boolean?][] = [
    ['chute', 4, 10, 0],
    ['lawnChair', 4, 11, 0],
    ['gasCan', 3, 12, 0],
    ['gasCan', 4, 12, 0],
    ['gasCan', 5, 12, 0],
    ['mower', 3, 13, 0],
    ['mower', 4, 13, 0],
    ['mower', 5, 13, 0],
    ['fin', 2, 13, 0, true],
    ['fin', 6, 13, 0],
  ]
  let bp = emptyBlueprint()
  for (const [id, c, r, rot, flip] of layout) bp = placePart(bp, id, c, r, rot, !!flip)
  return autoWire(bp)
}

export const STARTER_DESIGN_NAME = 'Fence Hopper (starter)'

export function freshSave(): SaveData {
  const blueprint = starterBlueprint()
  return {
    cash: STARTING_CASH,
    inventory: { ...STARTER_INVENTORY },
    completed: [],
    bestAltitude: 0,
    flights: 0,
    blueprint,
    designs: [],
    worn: {},
    jobs: refillJobs([], 0, blueprint, 1),
    bestTrack: [],
  }
}

export function parseBlueprint(bp: unknown): Blueprint | null {
  const b = bp as Blueprint
  if (!b || !Array.isArray(b.parts) || !Array.isArray(b.wires)) return null
  return {
    parts: b.parts.filter((p) => p && isPartId(p.partId)),
    wires: b.wires,
    settings: b.settings ?? {},
    nextUid: typeof b.nextUid === 'number' ? b.nextUid : 1,
  }
}

function parseCounts(x: unknown): Partial<Record<PartId, number>> {
  const out: Partial<Record<PartId, number>> = {}
  if (x && typeof x === 'object') {
    for (const [id, n] of Object.entries(x)) {
      if (isPartId(id) && typeof n === 'number' && n > 0) out[id] = Math.floor(n)
    }
  }
  return out
}

function isPartId(id: string): id is PartId {
  return id in PART_DEFS
}

export function loadSave(): SaveData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return freshSave()
    const parsed = JSON.parse(raw)
    const base = freshSave()
    const inventory = parseCounts(parsed.inventory)
    const worn = parseCounts(parsed.worn)
    for (const id of Object.keys(worn) as PartId[]) worn[id] = Math.min(worn[id]!, inventory[id] ?? 0)
    const blueprint = parseBlueprint(parsed.blueprint) ?? base.blueprint
    const designs: Design[] = Array.isArray(parsed.designs)
      ? parsed.designs
          .map((d: { name?: unknown; blueprint?: unknown }) => {
            const bp = parseBlueprint(d?.blueprint)
            return bp && typeof d.name === 'string' ? { name: d.name, blueprint: bp } : null
          })
          .filter((d: Design | null): d is Design => d !== null)
          .slice(0, MAX_DESIGNS)
      : []
    const bestAltitude = typeof parsed.bestAltitude === 'number' ? parsed.bestAltitude : 0
    const flights = typeof parsed.flights === 'number' ? parsed.flights : 0
    const jobs = Array.isArray(parsed.jobs) ? parsed.jobs.filter(isJob) : []
    return {
      cash: typeof parsed.cash === 'number' ? parsed.cash : base.cash,
      inventory,
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      bestAltitude,
      flights,
      blueprint,
      designs,
      worn,
      jobs: refillJobs(jobs, bestAltitude, blueprint, flights + 7),
      bestTrack: Array.isArray(parsed.bestTrack) ? parsed.bestTrack.filter((p: unknown) => Array.isArray(p) && p.length === 3) : [],
    }
  } catch {
    return freshSave()
  }
}

export function writeSave(save: SaveData) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save))
  } catch {
    // Storage disabled -- the session still plays, it just won't persist.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

// Returns the parts the scrap pile handed out (for the debrief callout).
export function topUpMinimumKit(inventory: Partial<Record<PartId, number>>): Partial<Record<PartId, number>> {
  const given: Partial<Record<PartId, number>> = {}
  for (const [id, n] of Object.entries(MINIMUM_KIT) as [PartId, number][]) {
    const have = inventory[id] ?? 0
    if (have < n) {
      given[id] = n - have
      inventory[id] = n
    }
  }
  return given
}
