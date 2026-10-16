// Persistent bests across sessions (best score, furthest wave), saved
// through the site's shared storage helper.
import { createStore } from '../../shared/storage'

export interface Progress {
  bestScore: number
  bestWave: number
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

const store = createStore<Progress>({
  key: 'invader-protocol:progress',
  version: 1,
  defaults: () => ({ bestScore: 0, bestWave: 0 }),
  parse: (p) => ({ bestScore: num(p.bestScore), bestWave: num(p.bestWave) }),
  summary: {
    slug: 'invader-protocol',
    describe: (p) => (p.bestScore > 0 ? `Best ${p.bestScore.toLocaleString()} · wave ${p.bestWave}` : null),
  },
})

export const loadProgress = store.load

// Returns the updated record and whether the score is a new best.
export function recordRun(score: number, wave: number): { progress: Progress; isNewBest: boolean } {
  const current = loadProgress()
  const next: Progress = {
    bestScore: Math.max(current.bestScore, score),
    bestWave: Math.max(current.bestWave, wave),
  }
  store.save(next)
  return { progress: next, isNewBest: score > current.bestScore }
}
