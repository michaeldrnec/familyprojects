// The current run (so a reload or a later visit picks up where the player
// left off) and the best run total, saved per profile through the site's
// shared storage helper.
import { createStore } from '../../shared/storage'
import { TIERS } from './levels'

export interface SavedScore {
  total: number
  stars: number
}

export interface SavedRun {
  seed: number
  levelIndex: number
  /** Which layout of the current level: bumps each time the player runs out
   * of launches, so the level is regenerated with a fresh layout. */
  layout: number
  launchesUsed: number
  /** Best result per level this run (null = not landed yet). */
  scores: (SavedScore | null)[]
}

export interface Progress {
  run: SavedRun | null
  bestTotal: number
}

const int = (v: unknown, min = 0) => (typeof v === 'number' && Number.isInteger(v) && v >= min ? v : min)

function parseScore(v: unknown): SavedScore | null {
  if (!v || typeof v !== 'object') return null
  const s = v as Record<string, unknown>
  return { total: int(s.total), stars: Math.min(3, int(s.stars, 1)) }
}

function parseRun(v: unknown): SavedRun | null {
  if (!v || typeof v !== 'object') return null
  const r = v as Record<string, unknown>
  if (typeof r.seed !== 'number' || !Array.isArray(r.scores)) return null
  const scores: unknown[] = r.scores
  return {
    seed: r.seed,
    levelIndex: Math.min(TIERS.length, int(r.levelIndex)),
    layout: int(r.layout),
    launchesUsed: int(r.launchesUsed),
    scores: TIERS.map((_, i) => parseScore(scores[i])),
  }
}

export const runTotal = (scores: (SavedScore | null)[]) => scores.reduce((sum, s) => sum + (s?.total ?? 0), 0)

const store = createStore<Progress>({
  key: 'gravity-well:progress',
  version: 1,
  defaults: () => ({ run: null, bestTotal: 0 }),
  parse: (p) => ({ run: parseRun(p.run), bestTotal: int(p.bestTotal) }),
  summary: {
    slug: 'gravity-well',
    describe: (p) => {
      const parts: string[] = []
      if (p.run && p.run.levelIndex >= TIERS.length) parts.push(`All ${TIERS.length} levels`)
      else if (p.run && (p.run.levelIndex > 0 || p.run.scores.some(Boolean))) parts.push(`Level ${p.run.levelIndex + 1}`)
      if (p.bestTotal > 0) parts.push(`best ${p.bestTotal.toLocaleString()}`)
      if (parts.length === 0) return null
      const text = parts.join(' · ')
      return text[0].toUpperCase() + text.slice(1)
    },
  },
})

export const loadProgress = store.load

/** Saves the run, raising the best total if this run has beaten it. */
export function saveRun(run: SavedRun): Progress {
  const next: Progress = { run, bestTotal: Math.max(loadProgress().bestTotal, runTotal(run.scores)) }
  store.save(next)
  return next
}
