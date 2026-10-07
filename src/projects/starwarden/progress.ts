// Persistent bests across sessions, following ion-perimeter/progress.ts:
// a narrow localStorage record (best score, longest survival, highest
// escalation level reached), tolerant of storage being unavailable.
const STORAGE_KEY = 'starwarden:progress'

export interface Progress {
  bestScore: number
  bestTime: number // seconds survived
  bestLevel: number // displayed level (1-based)
}

const DEFAULT_PROGRESS: Progress = { bestScore: 0, bestTime: 0, bestLevel: 0 }

export function loadProgress(): Progress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PROGRESS }
    const parsed = JSON.parse(raw)
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
    return { bestScore: num(parsed.bestScore), bestTime: num(parsed.bestTime), bestLevel: num(parsed.bestLevel) }
  } catch {
    return { ...DEFAULT_PROGRESS }
  }
}

// Returns the updated record and whether the score is a new best.
export function recordRun(score: number, time: number, level: number): { progress: Progress; isNewBest: boolean } {
  const current = loadProgress()
  const next: Progress = {
    bestScore: Math.max(current.bestScore, score),
    bestTime: Math.max(current.bestTime, time),
    bestLevel: Math.max(current.bestLevel, level),
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Private browsing / storage disabled -- the run still counted, just not saved.
  }
  return { progress: next, isNewBest: score > current.bestScore }
}

export function formatTime(seconds: number): string {
  const s = Math.floor(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
