// Player profiles, so several people sharing one device each keep their own
// saves, bests and "recently played" list. The profile list itself is
// device-wide; everything a game saves is stored under the active profile
// (see scopedKey()).
import { useSyncExternalStore } from 'react'
import { allKeys, readRaw, removeRaw, writeRaw } from './rawStorage'

export interface Profile {
  id: string
  name: string
  emoji: string
}

interface ProfilesState {
  profiles: Profile[]
  activeId: string
}

export const DEFAULT_PROFILE_ID = 'default'
export const PROFILE_EMOJIS = ['🙂', '🦊', '🐼', '🐸', '🦄', '🐙', '🦖', '🐝', '🚀', '⭐', '🌈', '🎸']
export const MAX_PROFILES = 8
export const MAX_NAME_LENGTH = 16

const STORAGE_KEY = 'familyprojects:profiles'

function defaultState(): ProfilesState {
  return { profiles: [{ id: DEFAULT_PROFILE_ID, name: 'Player 1', emoji: '🙂' }], activeId: DEFAULT_PROFILE_ID }
}

function load(): ProfilesState {
  const fallback = defaultState()
  const raw = readRaw(STORAGE_KEY)
  if (!raw) return fallback
  try {
    const p = JSON.parse(raw)
    const profiles: Profile[] = Array.isArray(p.profiles)
      ? p.profiles.filter(
          (x: Partial<Profile>) => typeof x?.id === 'string' && typeof x.name === 'string' && typeof x.emoji === 'string',
        )
      : []
    // The default profile owns the pre-profiles saves, so it always exists.
    if (!profiles.some((x) => x.id === DEFAULT_PROFILE_ID)) profiles.unshift(fallback.profiles[0])
    const activeId = profiles.some((x) => x.id === p.activeId) ? p.activeId : DEFAULT_PROFILE_ID
    return { profiles, activeId }
  } catch {
    return fallback
  }
}

let state: ProfilesState = load()
const listeners = new Set<() => void>()

function commit(next: ProfilesState) {
  state = next
  writeRaw(STORAGE_KEY, JSON.stringify(next))
  listeners.forEach((l) => l())
}

export function subscribeProfiles(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// Another tab switched profile or edited the list.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return
    state = load()
    listeners.forEach((l) => l())
  })
}

/** @public (used by the storage tests) */
export function activeProfileId(): string {
  return state.activeId
}

/** @public (used by the storage tests) */
export function activeProfile(): Profile {
  return state.profiles.find((p) => p.id === state.activeId) ?? state.profiles[0]
}

export function profilePrefix(profileId: string): string {
  // The default profile uses bare keys, so saves made before profiles
  // existed belong to it with no migration step.
  return profileId === DEFAULT_PROFILE_ID ? '' : `profile:${profileId}:`
}

export function scopedKey(key: string): string {
  return profilePrefix(state.activeId) + key
}

export function useProfiles(): ProfilesState {
  return useSyncExternalStore(subscribeProfiles, () => state)
}

export function switchProfile(id: string) {
  if (id === state.activeId || !state.profiles.some((p) => p.id === id)) return
  commit({ ...state, activeId: id })
}

function cleanName(name: string): string {
  return name.trim().slice(0, MAX_NAME_LENGTH)
}

// Creates a profile and makes it active. Returns null if the name is blank
// or the profile limit is reached.
export function addProfile(name: string, emoji: string): Profile | null {
  const clean = cleanName(name)
  if (!clean || state.profiles.length >= MAX_PROFILES) return null
  const profile: Profile = { id: Math.random().toString(36).slice(2, 10), name: clean, emoji }
  commit({ profiles: [...state.profiles, profile], activeId: profile.id })
  return profile
}

export function updateProfile(id: string, name: string, emoji: string) {
  const clean = cleanName(name)
  if (!clean) return
  commit({ ...state, profiles: state.profiles.map((p) => (p.id === id ? { ...p, name: clean, emoji } : p)) })
}

// Deletes a profile and everything it saved. The default profile can be
// renamed but not deleted, since it holds the pre-profiles saves.
export function deleteProfile(id: string) {
  if (id === DEFAULT_PROFILE_ID) return
  const prefix = profilePrefix(id)
  for (const key of allKeys()) if (key.startsWith(prefix)) removeRaw(key)
  const profiles = state.profiles.filter((p) => p.id !== id)
  commit({ profiles, activeId: state.activeId === id ? DEFAULT_PROFILE_ID : state.activeId })
}
