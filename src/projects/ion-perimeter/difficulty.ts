// Difficulty presets, picked on the start screen. Rather than re-authoring
// the wave table per level, each preset is a handful of multipliers layered
// over the base campaign (waves.ts / enemies.ts / economy.ts), so the wave
// *composition* stays hand-tuned while the pressure scales. "Cadet" is the
// original v1 balance.

export type DifficultyId = 'cadet' | 'veteran' | 'commander' | 'nightmare'

export interface Difficulty {
  id: DifficultyId
  name: string
  blurb: string
  enemyHp: number // flat multiplier on every enemy's HP and shield, bosses included
  hpGrowthPerWave: number // regular enemies gain this fraction of base HP each wave
  enemySpeed: number // multiplier on enemy movement speed
  enemyCount: number // multiplier on each spawn entry's count (rounded, min 1)
  startingCredits: number
  bounty: number // multiplier on kill credits and wave-clear bonus
  coreDamage: number // multiplier on Core Integrity lost per leak
  scoreMultiplier: number
}

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  cadet: {
    id: 'cadet',
    name: 'Cadet',
    blurb: 'The original balance. A relaxed run.',
    enemyHp: 1,
    hpGrowthPerWave: 0.12,
    enemySpeed: 1,
    enemyCount: 1,
    startingCredits: 150,
    bounty: 1,
    coreDamage: 1,
    scoreMultiplier: 1,
  },
  veteran: {
    id: 'veteran',
    name: 'Veteran',
    blurb: 'Tougher, more numerous ships. Upgrades start to matter.',
    enemyHp: 1.3,
    hpGrowthPerWave: 0.16,
    enemySpeed: 1.08,
    enemyCount: 1.25,
    startingCredits: 140,
    bounty: 0.9,
    coreDamage: 1.25,
    scoreMultiplier: 1.5,
  },
  commander: {
    id: 'commander',
    name: 'Commander',
    blurb: 'Every pad and every credit counts.',
    enemyHp: 1.6,
    hpGrowthPerWave: 0.2,
    enemySpeed: 1.15,
    enemyCount: 1.45,
    startingCredits: 130,
    bounty: 0.82,
    coreDamage: 1.5,
    scoreMultiplier: 2,
  },
  nightmare: {
    id: 'nightmare',
    name: 'Nightmare',
    blurb: 'Fast, armored swarms. A few leaks end the run.',
    enemyHp: 2,
    hpGrowthPerWave: 0.24,
    enemySpeed: 1.22,
    enemyCount: 1.7,
    startingCredits: 120,
    bounty: 0.75,
    coreDamage: 2,
    scoreMultiplier: 3,
  },
}

export const DIFFICULTY_ORDER: DifficultyId[] = ['cadet', 'veteran', 'commander', 'nightmare']

const STORAGE_KEY = 'ion-perimeter:difficulty'

export function loadDifficulty(): DifficultyId {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw && raw in DIFFICULTIES) return raw as DifficultyId
  } catch {
    // storage unavailable -- fall through to the default
  }
  return 'veteran'
}

export function saveDifficulty(id: DifficultyId) {
  try {
    window.localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // ignore -- the choice just won't be remembered next visit
  }
}
