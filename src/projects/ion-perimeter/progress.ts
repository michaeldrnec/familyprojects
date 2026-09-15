// Persistent progress across sessions -- the first project in this repo to
// use localStorage (see SPEC.md section 8). Deliberately narrow: just a
// best-wave/high-score record and the two unlock gates it feeds (the
// Railgun tower, and the Ion Disruptor's Chain Reactor branch). Kept local
// to this project rather than extracted into a shared utility, matching the
// repo's per-project-duplication convention -- nothing else needs this yet.
import type { BranchId, TowerDef, TowerBranch } from './towers'

const STORAGE_KEY = 'ion-perimeter:progress'

export interface Progress {
  bestWave: number
  highScore: number
}

const DEFAULT_PROGRESS: Progress = { bestWave: 0, highScore: 0 }

export function loadProgress(): Progress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PROGRESS }
    const parsed = JSON.parse(raw)
    return {
      bestWave: typeof parsed.bestWave === 'number' ? parsed.bestWave : 0,
      highScore: typeof parsed.highScore === 'number' ? parsed.highScore : 0,
    }
  } catch {
    return { ...DEFAULT_PROGRESS }
  }
}

// Returns the updated record and whether either figure improved, so the
// end screen can show a "new best" callout.
export function recordRun(waveReached: number, score: number): { progress: Progress; isNewBest: boolean } {
  const current = loadProgress()
  const isNewBest = waveReached > current.bestWave || score > current.highScore
  const next: Progress = {
    bestWave: Math.max(current.bestWave, waveReached),
    highScore: Math.max(current.highScore, score),
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Private browsing / storage disabled -- the run still played fine
    // without persistence, so just skip saving.
  }
  return { progress: next, isNewBest }
}

export function isTowerUnlocked(def: TowerDef, progress: Progress): boolean {
  return def.unlockWave === undefined || progress.bestWave >= def.unlockWave
}

export function isBranchUnlocked(branch: TowerBranch, progress: Progress): boolean {
  return branch.unlockWave === undefined || progress.bestWave >= branch.unlockWave
}

export type { BranchId }
