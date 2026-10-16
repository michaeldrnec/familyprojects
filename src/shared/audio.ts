// One Web Audio context and one mute switch for the whole site.
//
// Browsers limit how many AudioContexts a page may hold, so instead of each
// game creating (and never closing) its own, every game's audio.ts asks for
// an output channel here. All channels feed one site master gain, which is
// what mute turns down -- so muting in any game mutes every game, and the
// choice is remembered between visits.
import { useSyncExternalStore } from 'react'
import { readRaw, writeRaw } from './rawStorage'

const MUTED_KEY = 'familyprojects:muted'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = readRaw(MUTED_KEY) === '1'
const listeners = new Set<() => void>()

// The shared context, created on first use. Call from a real user gesture
// (click, key press, tap) -- browsers keep audio created outside one
// suspended. Returns null where Web Audio is unavailable.
export function getAudioContext(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      return null
    }
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 1
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

// A gain node feeding the site master, for a game to route its sounds
// through at its own overall `volume`.
export function createChannel(volume: number): GainNode | null {
  const c = getAudioContext()
  if (!c || !master) return null
  const gain = c.createGain()
  gain.gain.value = volume
  gain.connect(master)
  return gain
}

export function setMuted(next: boolean) {
  if (next === muted) return
  muted = next
  writeRaw(MUTED_KEY, next ? '1' : '0')
  if (master && ctx) master.gain.setTargetAtTime(next ? 0 : 1, ctx.currentTime, 0.05)
  listeners.forEach((l) => l())
}

export function toggleMuted() {
  setMuted(!muted)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// The site-wide mute state, kept in sync across every mute button.
export function useMuted(): [boolean, () => void] {
  const value = useSyncExternalStore(subscribe, () => muted)
  return [value, toggleMuted]
}
