// Turning a finished flight into cash, salvage and contract completions
// (SPEC.md section 7). Pure: takes the save + outcome, returns the new save
// and a debrief summary for the screen.
import { CONTRACTS, contractVisible } from './contracts'
import type { FlightOutcome } from './flight'
import type { ContractId, PartId } from './parts'
import { topUpMinimumKit, type SaveData } from './progress'
import type { Blueprint } from './workshop'

export interface Debrief {
  outcome: FlightOutcome
  altitudeCash: number
  orbitBonus: number
  contractsDone: { id: ContractId; title: string; payout: number }[]
  totalCash: number
  recovered: Partial<Record<PartId, number>>
  lost: Partial<Record<PartId, number>>
  granted: Partial<Record<PartId, number>>
  scrapPile: Partial<Record<PartId, number>>
  newBest: boolean
}

export const ORBIT_BONUS = 2000

export function altitudeCash(maxAltitude: number): number {
  return Math.round(4 * Math.sqrt(Math.max(0, maxAltitude)))
}

function countBy(uids: number[], bp: Blueprint): Partial<Record<PartId, number>> {
  const out: Partial<Record<PartId, number>> = {}
  for (const uid of uids) {
    const p = bp.parts.find((q) => q.uid === uid)
    if (p) out[p.partId] = (out[p.partId] ?? 0) + 1
  }
  return out
}

// `save.inventory` must already have had the launched parts removed.
export function settleFlight(save: SaveData, bp: Blueprint, outcome: FlightOutcome): { save: SaveData; debrief: Debrief } {
  const scrubbed = outcome.kind === 'scrubbed'
  const alt = scrubbed ? 0 : altitudeCash(outcome.stats.maxAltitude)
  const orbitBonus = outcome.stats.orbitAchieved ? ORBIT_BONUS : 0

  const contractsDone: Debrief['contractsDone'] = []
  const completed = [...save.completed]
  const granted: Partial<Record<PartId, number>> = {}
  for (const c of CONTRACTS) {
    // CONTRACTS is dependency-ordered, so one big flight can chain several.
    if (completed.includes(c.id) || !contractVisible(c, completed) || !c.check(outcome)) continue
    completed.push(c.id)
    contractsDone.push({ id: c.id, title: c.title, payout: c.payout })
    for (const g of c.grants ?? []) granted[g] = (granted[g] ?? 0) + 1
  }
  const contractCash = contractsDone.reduce((s, c) => s + c.payout, 0)
  const totalCash = alt + orbitBonus + contractCash

  const recovered = countBy(outcome.recovered, bp)
  const lost = countBy(outcome.lost, bp)
  const inventory = { ...save.inventory }
  for (const [id, n] of Object.entries(recovered) as [PartId, number][]) inventory[id] = (inventory[id] ?? 0) + n
  for (const [id, n] of Object.entries(granted) as [PartId, number][]) inventory[id] = (inventory[id] ?? 0) + n
  const scrapPile = topUpMinimumKit(inventory)

  const newBest = outcome.stats.maxAltitude > save.bestAltitude
  const next: SaveData = {
    ...save,
    cash: save.cash + totalCash,
    inventory,
    completed,
    bestAltitude: Math.max(save.bestAltitude, outcome.stats.maxAltitude),
    flights: save.flights + (scrubbed ? 0 : 1),
    blueprint: bp,
  }
  return {
    save: next,
    debrief: { outcome, altitudeCash: alt, orbitBonus, contractsDone, totalCash, recovered, lost, granted, scrapPile, newBest },
  }
}
