// Progress through the manors and the player's settings, saved through the
// site's shared storage helper (per player profile, versioned, never throws).
import { createStore } from '../../shared/storage'
import type { CameraMode } from './render/camera'
import { DIFFICULTIES, MANORS, type DifficultyId } from './sim/config'
import type { RoundResult } from './sim/world'

export interface Progress {
  unlocked: number // manors 0..unlocked are playable
  bestStars: number[]
  difficulty: DifficultyId
  camera: CameraMode | null // null: pick for the device
  sensitivity: number
  fov: number
}

const CAMERAS: CameraMode[] = ['shoulder', 'overhead', 'first']

function fresh(): Progress {
  return { unlocked: 0, bestStars: MANORS.map(() => 0), difficulty: 'spooky', camera: null, sensitivity: 1, fov: 70 }
}

const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

const store = createStore<Progress>({
  key: 'haunt-and-seek:progress',
  version: 1,
  defaults: fresh,
  parse: (p) => ({
    unlocked: clamp(Math.floor(num(p.unlocked)), 0, MANORS.length - 1),
    bestStars: MANORS.map((_, i) => clamp(Math.floor(num(Array.isArray(p.bestStars) ? p.bestStars[i] : 0)), 0, 3)),
    difficulty: DIFFICULTIES.some((d) => d.id === p.difficulty) ? p.difficulty : 'spooky',
    camera: CAMERAS.includes(p.camera) ? p.camera : null,
    sensitivity: clamp(num(p.sensitivity, 1), 0.3, 3),
    fov: clamp(num(p.fov, 70), 55, 95),
  }),
  summary: {
    slug: 'haunt-and-seek',
    describe(p) {
      const cleared = p.bestStars.filter((s) => s > 0).length
      if (!cleared) return null
      const stars = p.bestStars.reduce((a, s) => a + s, 0)
      return cleared === MANORS.length ? `Every manor haunted · ${stars}★` : `Manor ${cleared}/${MANORS.length} · ${stars}★`
    },
  },
})

export const loadProgress = store.load

export function recordRound(p: Progress, manor: number, result: RoundResult): Progress {
  const won = result.outcome === 'won'
  const next: Progress = {
    ...p,
    unlocked: won ? Math.max(p.unlocked, Math.min(MANORS.length - 1, manor + 1)) : p.unlocked,
    bestStars: p.bestStars.map((s, i) => (i === manor ? Math.max(s, result.stars) : s)),
  }
  store.save(next)
  return next
}

export function saveSettings(p: Progress, change: Partial<Pick<Progress, 'difficulty' | 'camera' | 'sensitivity' | 'fov'>>): Progress {
  const next = { ...p, ...change }
  store.save(next)
  return next
}
