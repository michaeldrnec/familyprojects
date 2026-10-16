// Saved progress: the chosen difficulty plus best stars per level, kept
// separately for each difficulty. Stored through the site's shared storage
// helper (per player profile, versioned, never throws).
import { createStore } from '../../shared/storage'
import { LEVELS } from './levels'

export type DifficultyId = 'lantern' | 'torch' | 'ember'

export interface Difficulty {
  id: DifficultyId
  name: string
  blurb: string
  timeScale: number
  // How long a tile you've seen stays faintly visible after the light
  // leaves it: Infinity = permanently, 0 = not at all.
  memorySeconds: number
}

export const DIFFICULTIES: Difficulty[] = [
  { id: 'lantern', name: 'Lantern', blurb: 'Seen paths stay faintly visible. Extra air.', timeScale: 1.5, memorySeconds: Infinity },
  { id: 'torch', name: 'Torch', blurb: 'What you saw fades after a few seconds.', timeScale: 1, memorySeconds: 4 },
  { id: 'ember', name: 'Ember', blurb: 'True darkness. Less air. Memory only.', timeScale: 0.85, memorySeconds: 0 },
]

export interface Progress {
  difficulty: DifficultyId
  stars: Record<DifficultyId, number[]> // best stars per level index, 0 = not cleared
}

function empty(): Progress {
  const zeros = () => LEVELS.map(() => 0)
  return { difficulty: 'torch', stars: { lantern: zeros(), torch: zeros(), ember: zeros() } }
}

const store = createStore<Progress>({
  key: 'lux-tenebris:progress',
  version: 1,
  defaults: empty,
  parse(parsed) {
    const base = empty()
    if (DIFFICULTIES.some((d) => d.id === parsed.difficulty)) base.difficulty = parsed.difficulty
    for (const d of DIFFICULTIES) {
      const saved = parsed.stars?.[d.id]
      if (Array.isArray(saved)) base.stars[d.id] = base.stars[d.id].map((_, i) => (typeof saved[i] === 'number' ? saved[i] : 0))
    }
    return base
  },
  summary: {
    slug: 'lux-tenebris',
    describe(p) {
      // Furthest progress on any difficulty.
      const cleared = Math.max(...DIFFICULTIES.map((d) => p.stars[d.id].filter((n) => n > 0).length))
      return cleared > 0 ? `${cleared}/${LEVELS.length} caverns` : null
    },
  },
})

export const loadProgress = store.load
export const saveProgress = store.save

export function isUnlocked(p: Progress, levelIndex: number): boolean {
  return levelIndex === 0 || p.stars[p.difficulty][levelIndex - 1] > 0
}
