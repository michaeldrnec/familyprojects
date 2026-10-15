// The master clock. The grid's march cadence, the bassline, and the
// perfect-beat fire window all read from this one beat clock, so a grid
// step, a bass note, and the rhythm window always line up.
import { F_MAX, F_MIN, N0, PERFECT_WINDOW, TEMPO_EXPONENT } from './constants'

// Steps per second for N living invaders (SPEC.md section 2.1).
export function stepFrequency(n: number): number {
  const k = Math.max(0, Math.min(1, 1 - n / N0))
  return F_MIN + (F_MAX - F_MIN) * Math.pow(k, TEMPO_EXPONENT)
}

export interface BeatClock {
  time: number // game time, seconds
  phase: number // [0, 1) progress toward the next beat
  freq: number // current Hz
  lastBeat: number // game time of the most recent beat
  index: number // beats emitted so far
}

export function newBeatClock(): BeatClock {
  return { time: 0, phase: 0, freq: F_MIN, lastBeat: -10, index: 0 }
}

// Advances the clock; returns true if a beat landed inside this step.
// The frequency can change every step (as invaders die) without the clock
// jumping, because only the phase accumulates.
export function tickBeat(clock: BeatClock, dt: number, freq: number): boolean {
  clock.time += dt
  clock.freq = freq
  clock.phase += dt * freq
  if (clock.phase < 1) return false
  clock.phase -= 1
  clock.lastBeat = clock.time - clock.phase / freq
  clock.index++
  return true
}

export function nextBeatTime(clock: BeatClock): number {
  return clock.time + (1 - clock.phase) / clock.freq
}

// Within +/- PERFECT_WINDOW of the nearest beat (in game time, not
// AudioContext time, so it can't drift from what the grid is doing).
export function isPerfectBeat(clock: BeatClock): boolean {
  const sincePrev = clock.time - clock.lastBeat
  const untilNext = nextBeatTime(clock) - clock.time
  return Math.min(sincePrev, untilNext) <= PERFECT_WINDOW
}
