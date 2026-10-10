// Wear and repairs. A part that survives a hard landing (impact above three quarters
// of what it can take) comes back worn: its welds are weaker and, if it's
// an engine, it fails more often. Inventory only counts worn units per part
// type, so the rig uses worn units first -- you fly the beat-up junk until
// you pay to fix it.
import { PART_DEFS, type PartId } from './parts'
import type { SaveData } from './progress'
import type { Blueprint } from './workshop'

export const WORN_INTEGRITY = 0.75 // weld rating multiplier
export const WORN_FAILURE = 2.5 // engine failure-rate multiplier
export const HARD_LANDING = 0.75 // fraction of crash tolerance that wears a part
export const REPAIR_FRACTION = 0.3 // of the part's catalog price

// Which placed parts are the worn ones: the first N of each type, in
// placement order.
export function wornUids(bp: Blueprint, worn: Partial<Record<PartId, number>>): Set<number> {
  const left = { ...worn }
  const out = new Set<number>()
  for (const p of bp.parts) {
    const n = left[p.partId] ?? 0
    if (n > 0) {
      out.add(p.uid)
      left[p.partId] = n - 1
    }
  }
  return out
}

export function repairCost(id: PartId): number {
  return Math.max(5, Math.ceil(PART_DEFS[id].cost * REPAIR_FRACTION))
}

export function repairAllCost(save: SaveData): number {
  let total = 0
  for (const [id, n] of Object.entries(save.worn) as [PartId, number][]) total += repairCost(id) * n
  return total
}

export function repair(save: SaveData, id: PartId): SaveData | null {
  const n = save.worn[id] ?? 0
  const cost = repairCost(id)
  if (n <= 0 || save.cash < cost) return null
  return { ...save, cash: save.cash - cost, worn: { ...save.worn, [id]: n - 1 } }
}

export function repairAll(save: SaveData): SaveData | null {
  const cost = repairAllCost(save)
  if (cost <= 0 || save.cash < cost) return null
  return { ...save, cash: save.cash - cost, worn: {} }
}
