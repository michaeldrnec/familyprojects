// Persistent progress across sessions (see SPEC.md section 8), saved
// through the site's shared storage helper. Deliberately narrow: just a
// best-wave/high-score record and the two unlock gates it feeds (the
// Railgun tower, and the Ion Disruptor's Chain Reactor branch).
import { createStore } from '../../shared/storage'
import type { BranchId, TowerDef, TowerBranch } from './towers'

export interface Progress {
  bestWave: number
  highScore: number
}

const store = createStore<Progress>({
  key: 'ion-perimeter:progress',
  version: 1,
  defaults: () => ({ bestWave: 0, highScore: 0 }),
  parse: (p) => ({
    bestWave: typeof p.bestWave === 'number' ? p.bestWave : 0,
    highScore: typeof p.highScore === 'number' ? p.highScore : 0,
  }),
  summary: {
    slug: 'ion-perimeter',
    describe: (p) => (p.bestWave > 0 ? `Best: wave ${p.bestWave}` : null),
  },
})

export const loadProgress = store.load

// Returns the updated record and whether either figure improved, so the
// end screen can show a "new best" callout.
export function recordRun(waveReached: number, score: number): { progress: Progress; isNewBest: boolean } {
  const current = loadProgress()
  const isNewBest = waveReached > current.bestWave || score > current.highScore
  const next: Progress = {
    bestWave: Math.max(current.bestWave, waveReached),
    highScore: Math.max(current.highScore, score),
  }
  store.save(next)
  return { progress: next, isNewBest }
}

export function isTowerUnlocked(def: TowerDef, progress: Progress): boolean {
  return def.unlockWave === undefined || progress.bestWave >= def.unlockWave
}

export function isBranchUnlocked(branch: TowerBranch, progress: Progress): boolean {
  return branch.unlockWave === undefined || progress.bestWave >= branch.unlockWave
}

export type { BranchId }
