// Credit awards, sell refunds, and scoring -- see SPEC.md section 7.
import type { EnemyDef } from './enemies'
import type { Difficulty } from './difficulty'

export const CORE_INTEGRITY_MAX = 100

// Selling a tower refunds a fraction of everything spent on it (its cost
// plus every upgrade), so respeccing a pad is a real option, not a trap.
export const SELL_REFUND_RATIO = 0.6

export function sellRefund(totalSpent: number): number {
  return Math.round(totalSpent * SELL_REFUND_RATIO)
}

export function killCredit(def: EnemyDef, difficulty: Difficulty): number {
  return Math.max(1, Math.round(def.credit * difficulty.bounty))
}

export function killScore(def: EnemyDef, difficulty: Difficulty): number {
  return Math.round(def.scoreValue * difficulty.scoreMultiplier)
}

// End-of-wave bonus scaled to how much Core Integrity remains, rewarding a
// clean wave over a scraped-through one. Bosses (waves 10 and 20) pay out
// extra given the much bigger threat just cleared.
export function waveClearBonus(coreIntegrity: number, waveIndex: number, wasBossWave: boolean, difficulty: Difficulty): number {
  const base = 20 + waveIndex * 8
  const integrityFactor = coreIntegrity / CORE_INTEGRITY_MAX
  const bonus = Math.round(base * (0.4 + 0.6 * integrityFactor) * difficulty.bounty)
  return wasBossWave ? bonus * 2 : bonus
}
