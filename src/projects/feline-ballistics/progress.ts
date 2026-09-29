// Persistent progress (SPEC.md section 8), following ion-perimeter/progress.ts:
// one localStorage key, defensive reads, every write wrapped in try/catch.

const STORAGE_KEY = 'feline-ballistics:progress'

export interface Settings {
  reducedMotion: boolean
  muted: boolean
}

export interface Progress {
  stars: Record<string, number>
  best: Record<string, number>
  coachSeen: string[]
  settings: Settings
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function freshProgress(): Progress {
  return { stars: {}, best: {}, coachSeen: [], settings: { reducedMotion: prefersReducedMotion(), muted: false } }
}

function numberRecord(v: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (v && typeof v === 'object') {
    for (const [k, n] of Object.entries(v)) if (typeof n === 'number' && Number.isFinite(n)) out[k] = n
  }
  return out
}

export function loadProgress(): Progress {
  const base = freshProgress()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return base
    const p = JSON.parse(raw)
    return {
      stars: numberRecord(p.stars),
      best: numberRecord(p.best),
      coachSeen: Array.isArray(p.coachSeen) ? p.coachSeen.filter((s: unknown) => typeof s === 'string') : [],
      settings: {
        reducedMotion: typeof p.settings?.reducedMotion === 'boolean' ? p.settings.reducedMotion : base.settings.reducedMotion,
        muted: !!p.settings?.muted,
      },
    }
  } catch {
    return base
  }
}

export function saveProgress(p: Progress) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    // Storage disabled -- the session still plays, it just won't persist.
  }
}

// Record a finished level; returns the updated progress.
export function recordResult(p: Progress, levelId: string, stars: number, score: number): Progress {
  return {
    ...p,
    stars: { ...p.stars, [levelId]: Math.max(p.stars[levelId] ?? 0, stars) },
    best: { ...p.best, [levelId]: Math.max(p.best[levelId] ?? 0, score) },
  }
}
