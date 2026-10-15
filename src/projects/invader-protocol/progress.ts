// Persistent bests across sessions, following starwarden/progress.ts: a
// narrow localStorage record (best score, furthest wave), tolerant of
// storage being unavailable.
const STORAGE_KEY = 'invader-protocol:progress'

export interface Progress {
  bestScore: number
  bestWave: number
}

const DEFAULT_PROGRESS: Progress = { bestScore: 0, bestWave: 0 }

export function loadProgress(): Progress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PROGRESS }
    const parsed = JSON.parse(raw)
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
    return { bestScore: num(parsed.bestScore), bestWave: num(parsed.bestWave) }
  } catch {
    return { ...DEFAULT_PROGRESS }
  }
}

// Returns the updated record and whether the score is a new best.
export function recordRun(score: number, wave: number): { progress: Progress; isNewBest: boolean } {
  const current = loadProgress()
  const next: Progress = {
    bestScore: Math.max(current.bestScore, score),
    bestWave: Math.max(current.bestWave, wave),
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Private browsing / storage disabled -- the run still counted, just not saved.
  }
  return { progress: next, isNewBest: score > current.bestScore }
}
