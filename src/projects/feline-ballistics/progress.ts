// Persistent progress (SPEC.md section 8), saved through the site's shared
// storage helper (per player profile, versioned, never throws). Sound is
// muted site-wide (shared/audio.ts), so it isn't part of this save.
import { createStore } from '../../shared/storage'
import { prefersReducedMotion } from '../../shared/motion'
import { ALL_LEVELS } from './levels'

export interface Settings {
  reducedMotion: boolean
}

export interface Progress {
  stars: Record<string, number>
  best: Record<string, number>
  coachSeen: string[]
  settings: Settings
}

export function freshProgress(): Progress {
  return { stars: {}, best: {}, coachSeen: [], settings: { reducedMotion: prefersReducedMotion() } }
}

function numberRecord(v: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (v && typeof v === 'object') {
    for (const [k, n] of Object.entries(v)) if (typeof n === 'number' && Number.isFinite(n)) out[k] = n
  }
  return out
}

const store = createStore<Progress>({
  key: 'feline-ballistics:progress',
  version: 1,
  defaults: freshProgress,
  parse(p) {
    const base = freshProgress()
    return {
      stars: numberRecord(p.stars),
      best: numberRecord(p.best),
      coachSeen: Array.isArray(p.coachSeen) ? p.coachSeen.filter((s: unknown) => typeof s === 'string') : [],
      settings: {
        reducedMotion: typeof p.settings?.reducedMotion === 'boolean' ? p.settings.reducedMotion : base.settings.reducedMotion,
      },
    }
  },
  summary: {
    slug: 'feline-ballistics',
    describe(p) {
      const cleared = ALL_LEVELS.filter((l) => (p.stars[l.id] ?? 0) > 0).length
      return cleared > 0 ? `${cleared}/${ALL_LEVELS.length} levels` : null
    },
  },
})

export const loadProgress = store.load
export const saveProgress = store.save

// Record a finished level; returns the updated progress.
export function recordResult(p: Progress, levelId: string, stars: number, score: number): Progress {
  return {
    ...p,
    stars: { ...p.stars, [levelId]: Math.max(p.stars[levelId] ?? 0, stars) },
    best: { ...p.best, [levelId]: Math.max(p.best[levelId] ?? 0, score) },
  }
}
