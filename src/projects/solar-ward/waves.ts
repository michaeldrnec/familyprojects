// Wave escalation (spec.md section 6): discrete waves that never stop
// getting harder -- more dreadnoughts, shorter telegraphs, faster beams and
// fighters, Siege dreadnoughts unlocking from wave 4 -- with no final wave.
// A wave "ends" once its spawn quota has fired and the board is clear (see
// SolarWard.tsx's wave-clear check).
import { RIM_POST_COUNT, spawnDreadnought, type Dreadnought, type WaveTuning } from './dreadnoughts'
import { shuffle, type Rng } from './rng'

export const SIEGE_UNLOCK_WAVE = 3 // 0-indexed -- "wave 4" as shown to the player

export interface WaveConfig extends WaveTuning {
  quota: number
  beamSpeed: number
  fighterSpeed: number
}

export function waveConfig(waveIndex: number): WaveConfig {
  return {
    quota: 6 + waveIndex * 2,
    telegraphTime: Math.max(0.35, 0.75 - waveIndex * 0.04),
    fireIntervalMin: Math.max(0.6, 1.3 - waveIndex * 0.05),
    fireIntervalMax: Math.max(1.1, 2.3 - waveIndex * 0.05),
    fighterChance: Math.min(0.5, 0.15 + waveIndex * 0.04),
    beamSpeed: Math.min(220, 90 + waveIndex * 8),
    fighterSpeed: Math.min(230, 70 + waveIndex * 9),
  }
}

export function dreadnoughtCountFor(waveIndex: number): number {
  return Math.min(RIM_POST_COUNT, 3 + waveIndex)
}

// Builds this wave's dreadnought roster: picks a random subset of the rim's
// fixed posts, and once Siege dreadnoughts are unlocked, makes roughly one
// in three of them a Siege instead of a Lancer.
export function generateWaveDreadnoughts(rng: Rng, waveIndex: number, nextId: () => number): Dreadnought[] {
  const tuning = waveConfig(waveIndex)
  const count = dreadnoughtCountFor(waveIndex)
  const posts = shuffle(
    rng,
    Array.from({ length: RIM_POST_COUNT }, (_, i) => i),
  ).slice(0, count)
  const siegeUnlocked = waveIndex >= SIEGE_UNLOCK_WAVE
  return posts.map((post) => {
    const type = siegeUnlocked && rng.next() < 0.33 ? 'siege' : 'lancer'
    return spawnDreadnought(rng, nextId(), post, type, tuning)
  })
}
