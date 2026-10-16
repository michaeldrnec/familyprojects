// What the active profile has been playing, for the homepage: a "recently
// played" list (recorded by the layout on every game visit) and a one-line
// progress note per game (written by games' saves, see createStore()).
// Both are stored per profile.
import { useSyncExternalStore } from 'react'
import { readRaw, writeRaw } from './rawStorage'
import { scopedKey, subscribeProfiles } from './profiles'

const RECENT_KEY = 'familyprojects:recent'
const SUMMARIES_KEY = 'familyprojects:summaries'
const MAX_RECENT = 8

function readJSON<T>(key: string, valid: (x: unknown) => x is T, fallback: T): T {
  const raw = readRaw(scopedKey(key))
  if (!raw) return fallback
  try {
    const parsed: unknown = JSON.parse(raw)
    return valid(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

const isStringArray = (x: unknown): x is string[] => Array.isArray(x) && x.every((s) => typeof s === 'string')
const isStringRecord = (x: unknown): x is Record<string, string> =>
  !!x && typeof x === 'object' && !Array.isArray(x) && Object.values(x).every((s) => typeof s === 'string')

// Slugs, most recent first.
export function recentlyPlayed(): string[] {
  return readJSON(RECENT_KEY, isStringArray, [])
}

export function markPlayed(slug: string) {
  const next = [slug, ...recentlyPlayed().filter((s) => s !== slug)].slice(0, MAX_RECENT)
  writeRaw(scopedKey(RECENT_KEY), JSON.stringify(next))
  notify()
}

export function summaries(): Record<string, string> {
  return readJSON(SUMMARIES_KEY, isStringRecord, {})
}

export function setSummary(slug: string, text: string | null) {
  const current = summaries()
  if ((current[slug] ?? null) === text) return
  const next = { ...current }
  if (text) next[slug] = text
  else delete next[slug]
  writeRaw(scopedKey(SUMMARIES_KEY), JSON.stringify(next))
  notify()
}

// --- React binding -----------------------------------------------------------

interface Activity {
  recent: string[]
  summaries: Record<string, string>
}

let snapshot: Activity | null = null
const listeners = new Set<() => void>()

function notify() {
  snapshot = null
  listeners.forEach((l) => l())
}

function getSnapshot(): Activity {
  if (!snapshot) snapshot = { recent: recentlyPlayed(), summaries: summaries() }
  return snapshot
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Re-read everything when the active profile changes.
subscribeProfiles(notify)

export function useActivity(): Activity {
  return useSyncExternalStore(subscribe, getSnapshot)
}
