// Persistent bests across sessions (best score, longest survival, highest
// escalation level reached), saved through the site's shared storage helper.
import { createStore } from '../../shared/storage'

export interface Progress {
  bestScore: number
  bestTime: number // seconds survived
  bestLevel: number // displayed level (1-based)
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

const store = createStore<Progress>({
  key: 'starwarden:progress',
  version: 1,
  defaults: () => ({ bestScore: 0, bestTime: 0, bestLevel: 0 }),
  parse: (p) => ({ bestScore: num(p.bestScore), bestTime: num(p.bestTime), bestLevel: num(p.bestLevel) }),
  summary: {
    slug: 'starwarden',
    describe: (p) => (p.bestScore > 0 ? `Best ${p.bestScore.toLocaleString()}` : null),
  },
})

export const loadProgress = store.load

// Returns the updated record and whether the score is a new best.
export function recordRun(score: number, time: number, level: number): { progress: Progress; isNewBest: boolean } {
  const current = loadProgress()
  const next: Progress = {
    bestScore: Math.max(current.bestScore, score),
    bestTime: Math.max(current.bestTime, time),
    bestLevel: Math.max(current.bestLevel, level),
  }
  store.save(next)
  return { progress: next, isNewBest: score > current.bestScore }
}

export function formatTime(seconds: number): string {
  const s = Math.floor(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
