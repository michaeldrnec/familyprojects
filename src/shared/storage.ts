// Every localStorage read and write on the site goes through here, so:
//  - storage being unavailable (private browsing, disabled, quota) never
//    throws -- the game still plays, it just doesn't persist;
//  - saves are kept separately for each player profile (see profiles.ts);
//  - saves carry a schema version, so a game can migrate old data instead
//    of silently dropping it when its save format changes.
import { readRaw, removeRaw, writeRaw } from './rawStorage'
import { scopedKey } from './profiles'
import { setSummary } from './activity'

// --- Profile-scoped access ---------------------------------------------------

export function readScoped(key: string): string | null {
  return readRaw(scopedKey(key))
}

export function writeScoped(key: string, value: string) {
  writeRaw(scopedKey(key), value)
}

export function removeScoped(key: string) {
  removeRaw(scopedKey(key))
}

// --- Versioned game saves ----------------------------------------------------

interface Envelope {
  __v: number
  data: unknown
}

function isEnvelope(x: unknown): x is Envelope {
  return !!x && typeof x === 'object' && typeof (x as Envelope).__v === 'number' && 'data' in x
}

export interface StoreOptions<T> {
  key: string
  // Bump when the save format changes, and teach parse() to read the old one.
  version: number
  defaults: () => T
  // Validates (and, for an older `fromVersion`, migrates) stored data.
  // `fromVersion` is 0 for saves written before versioning existed. Return
  // null to fall back to defaults(). Throwing is fine too.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parse: (data: any, fromVersion: number) => T | null
  // A one-line progress note for this game's homepage tile ("12/24 levels").
  summary?: { slug: string; describe: (data: T) => string | null }
}

export interface Store<T> {
  load(): T
  save(data: T): void
  clear(): void
}

export function createStore<T>(opts: StoreOptions<T>): Store<T> {
  const note = (data: T) => {
    if (opts.summary) setSummary(opts.summary.slug, opts.summary.describe(data))
  }
  return {
    load() {
      let result = opts.defaults()
      const raw = readScoped(opts.key)
      if (raw !== null) {
        try {
          const stored: unknown = JSON.parse(raw)
          const parsed = isEnvelope(stored) ? opts.parse(stored.data, stored.__v) : opts.parse(stored, 0)
          if (parsed !== null) result = parsed
        } catch {
          // Corrupt save -- start fresh rather than crash the game.
        }
      }
      // Refreshes the homepage note, including for saves made before notes existed.
      note(result)
      return result
    },
    save(data: T) {
      const envelope: Envelope = { __v: opts.version, data }
      writeScoped(opts.key, JSON.stringify(envelope))
      note(data)
    },
    clear() {
      removeScoped(opts.key)
      if (opts.summary) setSummary(opts.summary.slug, null)
    },
  }
}
