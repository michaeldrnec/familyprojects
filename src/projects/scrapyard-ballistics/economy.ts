// Turning a finished flight into cash, salvage and contract completions
// (SPEC.md section 7). Pure: takes the save + outcome, returns the new save
// and a debrief summary for the screen.
import { CONTRACTS, contractVisible } from './contracts'
import type { FlightOutcome } from './flight'
import { flightHints } from './hints'
import { jobDone, jobTitle, refillJobs } from './jobs'
import type { ContractId, PartId } from './parts'
import { topUpMinimumKit, type SaveData, type TrackPoint } from './progress'
import { partCounts, type Blueprint } from './workshop'

export interface Debrief {
  outcome: FlightOutcome
  altitudeCash: number
  orbitBonus: number
  contractsDone: { id: ContractId; title: string; payout: number }[]
  jobsDone: { id: string; title: string; payout: number }[]
  wornOut: Partial<Record<PartId, number>> // came back worn this flight
  totalCash: number
  recovered: Partial<Record<PartId, number>>
  lost: Partial<Record<PartId, number>>
  granted: Partial<Record<PartId, number>>
  scrapPile: Partial<Record<PartId, number>>
  newBest: boolean
  hints: string[]
  prevBest: TrackPoint[] // the record flight before this one, for the chart
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

// `save` is the pre-launch save; `worn` is which launched uids were worn.
export function settleFlight(
  save: SaveData,
  bp: Blueprint,
  outcome: FlightOutcome,
  worn: Set<number>,
): { save: SaveData; debrief: Debrief } {
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
  const jobsDone = save.jobs.filter((j) => jobDone(j, outcome, bp)).map((j) => ({ id: j.id, title: jobTitle(j), payout: j.payout }))
  const jobCash = jobsDone.reduce((s, j) => s + j.payout, 0)
  const totalCash = alt + orbitBonus + contractCash + jobCash

  const recovered = countBy(outcome.recovered, bp)
  const lost = countBy(outcome.lost, bp)
  // Launched parts leave the inventory (worn ones first); survivors come
  // back, worn if they were already or if they landed hard.
  const inventory = { ...save.inventory }
  const wornInv = { ...save.worn }
  for (const [id, n] of Object.entries(partCounts(bp)) as [PartId, number][]) inventory[id] = Math.max(0, (inventory[id] ?? 0) - n)
  for (const uid of worn) {
    const p = bp.parts.find((q) => q.uid === uid)
    if (p) wornInv[p.partId] = Math.max(0, (wornInv[p.partId] ?? 0) - 1)
  }
  const hard = new Set(outcome.wornOut)
  const wornBack = countBy(outcome.recovered.filter((u) => worn.has(u) || hard.has(u)), bp)
  const wornOut = countBy(outcome.recovered.filter((u) => !worn.has(u) && hard.has(u)), bp)
  for (const [id, n] of Object.entries(wornBack) as [PartId, number][]) wornInv[id] = (wornInv[id] ?? 0) + n
  for (const [id, n] of Object.entries(recovered) as [PartId, number][]) inventory[id] = (inventory[id] ?? 0) + n
  for (const [id, n] of Object.entries(granted) as [PartId, number][]) inventory[id] = (inventory[id] ?? 0) + n
  const scrapPile = topUpMinimumKit(inventory)

  const newBest = !scrubbed && outcome.stats.maxAltitude > save.bestAltitude
  const bestAltitude = Math.max(save.bestAltitude, scrubbed ? 0 : outcome.stats.maxAltitude)
  const flights = save.flights + (scrubbed ? 0 : 1)
  const doneIds = new Set(jobsDone.map((j) => j.id))
  const next: SaveData = {
    ...save,
    cash: save.cash + totalCash,
    inventory,
    worn: wornInv,
    completed,
    bestAltitude,
    flights,
    blueprint: bp,
    jobs: refillJobs(
      save.jobs.filter((j) => !doneIds.has(j.id)),
      bestAltitude,
      bp,
      (flights * 2654435761 + Math.round(outcome.flightTime * 1000)) >>> 0,
    ),
    bestTrack: newBest ? outcome.track : save.bestTrack,
  }
  return {
    save: next,
    debrief: {
      outcome,
      altitudeCash: alt,
      orbitBonus,
      contractsDone,
      jobsDone,
      wornOut,
      totalCash,
      recovered,
      lost,
      granted,
      scrapPile,
      newBest,
      hints: flightHints(outcome, bp, completed),
      prevBest: save.bestTrack,
    },
  }
}
