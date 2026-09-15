// Credit awards, sell refunds, and scoring -- see SPEC.md section 7.
import type { EnemyDef } from './enemies'

export const STARTING_CREDITS = 150
export const CORE_INTEGRITY_MAX = 100

// Selling a tower refunds a fraction of everything spent on it (its cost
// plus every upgrade), so respeccing a pad is a real option, not a trap.
export const SELL_REFUND_RATIO = 0.6

export function sellRefund(totalSpent: number): number {
  return Math.round(totalSpent * SELL_REFUND_RATIO)
}

export function killCredit(def: EnemyDef): number {
  return def.credit
}

export function killScore(def: EnemyDef): number {
  return def.scoreValue
}

// End-of-wave bonus scaled to how much Core Integrity remains, rewarding a
// clean wave over a scraped-through one. Bosses (waves 10 and 20) pay out
// extra given the much bigger threat just cleared.
export function waveClearBonus(coreIntegrity: number, waveIndex: number, wasBossWave: boolean): number {
  const base = 20 + waveIndex * 8
  const integrityFactor = coreIntegrity / CORE_INTEGRITY_MAX
  const bonus = Math.round(base * (0.4 + 0.6 * integrityFactor))
  return wasBossWave ? bonus * 2 : bonus
}
