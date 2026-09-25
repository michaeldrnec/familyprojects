// Persistent save (SPEC.md section 9), following ion-perimeter/progress.ts:
// one localStorage key, every read defensive, every write wrapped in
// try/catch so private browsing still plays fine without persistence.
import { PART_DEFS, type ContractId, type PartId } from './parts'
import { emptyBlueprint, type Blueprint } from './workshop'

const STORAGE_KEY = 'scrapyard-ballistics:save'

export interface SaveData {
  cash: number
  inventory: Partial<Record<PartId, number>>
  completed: ContractId[]
  bestAltitude: number
  flights: number
  blueprint: Blueprint
}

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

export function freshSave(): SaveData {
  return {
    cash: STARTING_CASH,
    inventory: { ...STARTER_INVENTORY },
    completed: [],
    bestAltitude: 0,
    flights: 0,
    blueprint: emptyBlueprint(),
  }
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
    const inventory: Partial<Record<PartId, number>> = {}
    if (parsed.inventory && typeof parsed.inventory === 'object') {
      for (const [id, n] of Object.entries(parsed.inventory)) {
        if (isPartId(id) && typeof n === 'number' && n > 0) inventory[id] = Math.floor(n)
      }
    }
    const bp = parsed.blueprint
    const blueprint: Blueprint =
      bp && Array.isArray(bp.parts) && Array.isArray(bp.wires)
        ? {
            parts: bp.parts.filter((p: { partId: string }) => isPartId(p.partId)),
            wires: bp.wires,
            settings: bp.settings ?? {},
            nextUid: typeof bp.nextUid === 'number' ? bp.nextUid : 1,
          }
        : base.blueprint
    return {
      cash: typeof parsed.cash === 'number' ? parsed.cash : base.cash,
      inventory,
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      bestAltitude: typeof parsed.bestAltitude === 'number' ? parsed.bestAltitude : 0,
      flights: typeof parsed.flights === 'number' ? parsed.flights : 0,
      blueprint,
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
