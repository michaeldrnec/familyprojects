// The Black Market (SPEC.md section 8): every part is for sale at its
// catalog price once its unlock contract is done. Payload parts are never
// sold -- they arrive with contracts.
import { PART_DEFS, PART_ORDER, type ContractId, type PartDef, type PartId } from './parts'
import type { SaveData } from './progress'

export function listed(def: PartDef, completed: ContractId[]): boolean {
  if (def.payload) return false
  return !def.unlock || completed.includes(def.unlock)
}

export function shopParts(): PartDef[] {
  return PART_ORDER.map((id) => PART_DEFS[id]).filter((d) => !d.payload)
}

export function buy(save: SaveData, id: PartId): SaveData | null {
  const def = PART_DEFS[id]
  if (!listed(def, save.completed) || save.cash < def.cost) return null
  return { ...save, cash: save.cash - def.cost, inventory: { ...save.inventory, [id]: (save.inventory[id] ?? 0) + 1 } }
}

// Pawn a part back for 40% -- a way out if you've overbought.
export const SELL_FRACTION = 0.4

export function sell(save: SaveData, id: PartId): SaveData | null {
  const have = save.inventory[id] ?? 0
  const def = PART_DEFS[id]
  if (have <= 0 || def.payload) return null
  return {
    ...save,
    cash: save.cash + Math.floor(def.cost * SELL_FRACTION),
    inventory: { ...save.inventory, [id]: have - 1 },
  }
}
