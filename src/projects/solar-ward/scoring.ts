// Scoring (spec.md section 7): points per kill, a combo multiplier that
// climbs with consecutive intercepts and resets on any segment hit, an
// Overcharge multi-kill bonus, and an end-of-wave bonus scaled to how much
// Core Integrity survived.
import { SEGMENT_HEALTH } from './segments'

export const BEAM_POINTS = 15
export const FIGHTER_POINTS = 40

export const COMBO_STEP = 0.1
export const COMBO_MAX = 3.0
export const COMBO_START = 1.0

export function nextCombo(combo: number): number {
  return Math.min(COMBO_MAX, combo + COMBO_STEP)
}

// Points beyond the first target in one Overcharge Pulse burst get a bonus
// multiplier, rewarding a well-timed multi-kill over a panic trigger.
export const OVERCHARGE_BONUS_MULT = 1.5

export const END_OF_WAVE_POINTS_PER_HEALTH = 10

export function endOfWaveBonus(remainingHealth: number): number {
  return remainingHealth * END_OF_WAVE_POINTS_PER_HEALTH
}

export function maxPossibleWaveBonus(segmentCount: number): number {
  return segmentCount * SEGMENT_HEALTH * END_OF_WAVE_POINTS_PER_HEALTH
}
