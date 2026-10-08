// Saved progress (localStorage), following ion-perimeter/progress.ts: the
// chosen difficulty plus best stars per level, kept separately for each
// difficulty. Tolerant of storage being unavailable.
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

const STORAGE_KEY = 'lux-tenebris:progress'

export interface Progress {
  difficulty: DifficultyId
  stars: Record<DifficultyId, number[]> // best stars per level index, 0 = not cleared
}

function empty(): Progress {
  const zeros = () => LEVELS.map(() => 0)
  return { difficulty: 'torch', stars: { lantern: zeros(), torch: zeros(), ember: zeros() } }
}

export function loadProgress(): Progress {
  const base = empty()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw)
    if (DIFFICULTIES.some((d) => d.id === parsed.difficulty)) base.difficulty = parsed.difficulty
    for (const d of DIFFICULTIES) {
      const saved = parsed.stars?.[d.id]
      if (Array.isArray(saved)) base.stars[d.id] = base.stars[d.id].map((_, i) => (typeof saved[i] === 'number' ? saved[i] : 0))
    }
    return base
  } catch {
    return base
  }
}

export function saveProgress(p: Progress) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    // storage unavailable -- progress just won't persist
  }
}

export function isUnlocked(p: Progress, levelIndex: number): boolean {
  return levelIndex === 0 || p.stars[p.difficulty][levelIndex - 1] > 0
}
