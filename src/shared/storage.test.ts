// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Each test gets fresh module state (the profile list is read on import).
async function load() {
  vi.resetModules()
  const profiles = await import('./profiles')
  const storage = await import('./storage')
  const activity = await import('./activity')
  return { ...profiles, ...storage, ...activity }
}

interface Save {
  best: number
}

const options = {
  key: 'test-game:save',
  version: 1,
  defaults: (): Save => ({ best: 0 }),
  parse: (p: { best?: unknown }): Save | null => (typeof p.best === 'number' ? { best: p.best } : null),
  summary: { slug: 'test-game', describe: (s: Save) => (s.best > 0 ? `Best ${s.best}` : null) },
}

beforeEach(() => {
  localStorage.clear()
})

describe('createStore', () => {
  it('returns defaults when nothing is saved', async () => {
    const { createStore } = await load()
    expect(createStore(options).load()).toEqual({ best: 0 })
  })

  it('saves a versioned envelope and reads it back', async () => {
    const { createStore } = await load()
    const store = createStore(options)
    store.save({ best: 12 })
    expect(JSON.parse(localStorage.getItem('test-game:save')!)).toEqual({ __v: 1, data: { best: 12 } })
    expect(store.load()).toEqual({ best: 12 })
  })

  it('reads saves written before versioning as version 0', async () => {
    const { createStore } = await load()
    localStorage.setItem('test-game:save', JSON.stringify({ best: 7 }))
    const parse = vi.fn(options.parse)
    expect(createStore({ ...options, parse }).load()).toEqual({ best: 7 })
    expect(parse).toHaveBeenCalledWith({ best: 7 }, 0)
  })

  it('falls back to defaults for corrupt or invalid saves', async () => {
    const { createStore } = await load()
    localStorage.setItem('test-game:save', '{not json')
    expect(createStore(options).load()).toEqual({ best: 0 })
    localStorage.setItem('test-game:save', JSON.stringify({ best: 'lots' }))
    expect(createStore(options).load()).toEqual({ best: 0 })
  })

  it('records a homepage summary on load and save, and clears it', async () => {
    const { createStore, summaries } = await load()
    const store = createStore(options)
    store.save({ best: 30 })
    expect(summaries()['test-game']).toBe('Best 30')
    store.clear()
    expect(summaries()['test-game']).toBeUndefined()
  })
})

describe('profiles', () => {
  it('keeps each profile’s saves separate, with the default profile on bare keys', async () => {
    const { createStore, addProfile, switchProfile, DEFAULT_PROFILE_ID } = await load()
    const store = createStore(options)
    store.save({ best: 5 })
    const kid = addProfile('Kid', '🦊')!
    expect(store.load()).toEqual({ best: 0 })
    store.save({ best: 99 })
    expect(localStorage.getItem(`profile:${kid.id}:test-game:save`)).not.toBeNull()
    switchProfile(DEFAULT_PROFILE_ID)
    expect(store.load()).toEqual({ best: 5 })
  })

  it('deletes a profile’s saves with it, but never the default profile', async () => {
    const { createStore, addProfile, deleteProfile, activeProfileId, DEFAULT_PROFILE_ID } = await load()
    const kid = addProfile('Kid', '🦊')!
    createStore(options).save({ best: 3 })
    deleteProfile(kid.id)
    expect(activeProfileId()).toBe(DEFAULT_PROFILE_ID)
    expect(Object.keys(localStorage).some((k) => k.startsWith(`profile:${kid.id}:`))).toBe(false)
    deleteProfile(DEFAULT_PROFILE_ID)
    expect(activeProfileId()).toBe(DEFAULT_PROFILE_ID)
  })

  it('rejects blank names and remembers the active profile across reloads', async () => {
    const first = await load()
    expect(first.addProfile('   ', '🙂')).toBeNull()
    const kid = first.addProfile('  Sam  ', '🐼')!
    expect(kid.name).toBe('Sam')
    const second = await load()
    expect(second.activeProfile().name).toBe('Sam')
  })
})

describe('activity', () => {
  it('lists recently played games newest first, without duplicates', async () => {
    const { markPlayed, recentlyPlayed } = await load()
    markPlayed('a')
    markPlayed('b')
    markPlayed('a')
    expect(recentlyPlayed()).toEqual(['a', 'b'])
  })
})
