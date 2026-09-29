// Synthesized SFX via the Web Audio API only, following
// scrapyard-ballistics/audio.ts: a lazy singleton AudioContext created from
// a real user gesture (init()), a masterGain for mute, and small tone /
// noise helpers. handleEvent() maps GameWorld events to cues.
import type { GameEvent } from './game/world'
import type { BreedId } from './game/breeds'
import type { SoundKind } from './game/materials'

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let muted = false
let noiseCache: AudioBuffer | null = null

export function init() {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume()
    return
  }
  ctx = new AudioContext()
  masterGain = ctx.createGain()
  masterGain.gain.value = muted ? 0 : 0.7
  masterGain.connect(ctx.destination)
}

export function setMuted(next: boolean) {
  muted = next
  if (masterGain && ctx) masterGain.gain.setTargetAtTime(muted ? 0 : 0.7, ctx.currentTime, 0.05)
}

export function isMuted() {
  return muted
}

function noise(): AudioBuffer | null {
  if (!ctx) return null
  if (!noiseCache) {
    noiseCache = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = noiseCache.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noiseCache
}

function tone(freq: number, type: OscillatorType, peak: number, attack: number, release: number, sweepTo?: number, delay = 0) {
  if (!ctx || !masterGain) return
  const t0 = ctx.currentTime + delay
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (sweepTo !== undefined) osc.frequency.exponentialRampToValueAtTime(sweepTo, t0 + attack + release)
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(peak, t0 + attack)
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + attack + release)
  osc.connect(gain)
  gain.connect(masterGain)
  osc.start(t0)
  osc.stop(t0 + attack + release + 0.05)
}

function noiseBurst(duration: number, type: BiquadFilterType, freq: number, peak: number, sweepTo?: number, q = 1) {
  if (!ctx || !masterGain) return
  const buf = noise()
  if (!buf) return
  const src = ctx.createBufferSource()
  src.buffer = buf
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.setValueAtTime(freq, ctx.currentTime)
  filter.Q.value = q
  if (sweepTo !== undefined) filter.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + duration)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(peak, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(masterGain)
  src.start(ctx.currentTime, Math.random() * 1.5)
  src.stop(ctx.currentTime + duration + 0.02)
}

// A meow: FM-ish vowel sweep, pitched per breed.
const MEOW_PITCH: Record<BreedId, number> = { tabby: 520, coon: 300, siamese: 700, calico: 560 }

export function meow(breed: BreedId, long = false) {
  if (!ctx || !masterGain) return
  const f = MEOW_PITCH[breed]
  const dur = long ? 0.9 : 0.4
  const t0 = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(f * 0.8, t0)
  osc.frequency.linearRampToValueAtTime(f * 1.35, t0 + dur * 0.35)
  osc.frequency.linearRampToValueAtTime(f * 0.7, t0 + dur)
  const formant = ctx.createBiquadFilter()
  formant.type = 'bandpass'
  formant.Q.value = 4
  formant.frequency.setValueAtTime(700, t0)
  formant.frequency.linearRampToValueAtTime(1600, t0 + dur * 0.4)
  formant.frequency.linearRampToValueAtTime(800, t0 + dur)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(long ? 0.5 : 0.35, t0 + 0.05)
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  osc.connect(formant)
  formant.connect(gain)
  gain.connect(masterGain)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

export function impact(sound: SoundKind, strength: number) {
  const s = Math.max(0.15, strength)
  switch (sound) {
    case 'glass':
      tone(2200 + Math.random() * 1200, 'sine', 0.12 * s, 0.002, 0.15)
      break
    case 'ceramic':
      tone(1200 + Math.random() * 400, 'triangle', 0.14 * s, 0.002, 0.1)
      break
    case 'wood':
      tone(180 + Math.random() * 60, 'triangle', 0.3 * s, 0.003, 0.12, 90)
      noiseBurst(0.06, 'lowpass', 900, 0.2 * s)
      break
    case 'metal':
      tone(620 + Math.random() * 200, 'square', 0.1 * s, 0.002, 0.35, 580)
      tone(1450, 'sine', 0.08 * s, 0.002, 0.4)
      break
    case 'electronics':
      tone(300, 'square', 0.08 * s, 0.002, 0.08)
      break
    case 'paper':
      noiseBurst(0.08, 'highpass', 2500, 0.12 * s)
      break
    default:
      noiseBurst(0.1, 'lowpass', 500, 0.25 * s)
  }
}

export function shatter(sound: SoundKind) {
  switch (sound) {
    case 'glass':
      noiseBurst(0.5, 'highpass', 3000, 0.45, 7000)
      for (let i = 0; i < 6; i++) tone(2500 + Math.random() * 3500, 'sine', 0.07, 0.002, 0.25, undefined, i * 0.04 + Math.random() * 0.05)
      break
    case 'ceramic':
      noiseBurst(0.3, 'bandpass', 2000, 0.45, undefined, 2)
      for (let i = 0; i < 3; i++) tone(1300 + Math.random() * 900, 'triangle', 0.1, 0.002, 0.12, undefined, i * 0.05)
      break
    case 'wood':
      noiseBurst(0.25, 'lowpass', 1200, 0.5, 200)
      tone(120, 'triangle', 0.35, 0.003, 0.2, 60)
      break
    case 'electronics':
      noiseBurst(0.6, 'bandpass', 4000, 0.3, 800, 3)
      tone(90, 'sawtooth', 0.15, 0.01, 0.5, 50)
      break
    case 'paper':
      noiseBurst(0.25, 'bandpass', 1800, 0.3)
      break
    default:
      noiseBurst(0.3, 'lowpass', 600, 0.4)
  }
}

export function ability(breed: BreedId) {
  switch (breed) {
    case 'tabby':
      tone(300, 'sawtooth', 0.12, 0.01, 0.3, 1200)
      noiseBurst(0.3, 'bandpass', 1500, 0.2, 4000)
      break
    case 'coon':
      tone(200, 'sine', 0.3, 0.01, 0.35, 45)
      noiseBurst(0.35, 'lowpass', 400, 0.4, 80)
      break
    case 'siamese':
      meow('siamese', true)
      tone(900, 'square', 0.1, 0.02, 0.6, 2400)
      break
    case 'calico':
      noiseBurst(0.12, 'bandpass', 3500, 0.35, 1200, 2)
      break
  }
}

export function swish(glide: boolean) {
  noiseBurst(glide ? 0.5 : 0.18, 'bandpass', glide ? 800 : 2400, 0.25, glide ? 300 : 1000, 1.5)
}

export function grip() {
  for (let i = 0; i < 3; i++) noiseBurst(0.05, 'highpass', 4000, 0.2)
  tone(200, 'triangle', 0.1, 0.005, 0.1)
}

export function fan() {
  noiseBurst(0.5, 'bandpass', 600, 0.35, 2000, 2)
}

export function bark() {
  if (!ctx) return
  tone(420, 'sawtooth', 0.22, 0.005, 0.14, 180)
  noiseBurst(0.12, 'bandpass', 1100, 0.3, undefined, 3)
}

export function stir() {
  tone(110, 'sine', 0.2, 0.2, 0.6, 80)
}

export function launch(breed: BreedId) {
  meow(breed)
  noiseBurst(0.2, 'bandpass', 900, 0.15, 2500)
}

export function click() {
  tone(880, 'square', 0.06, 0.002, 0.05)
}

export function win(stars: number) {
  // purr + jingle
  const notes = [523, 659, 784, 1047].slice(0, 1 + stars)
  notes.forEach((f, i) => tone(f, 'triangle', 0.2, 0.01, 0.35, undefined, i * 0.12))
  for (let i = 0; i < 8; i++) tone(55, 'sawtooth', 0.08, 0.02, 0.08, undefined, 0.5 + i * 0.09)
}

export function lose() {
  // the snooze alarm
  for (let i = 0; i < 8; i++) tone(1800, 'square', 0.1, 0.002, 0.06, undefined, i * 0.1)
  tone(300, 'sine', 0.15, 0.1, 0.8, 200, 0.9)
}

export function handleEvent(e: GameEvent) {
  switch (e.kind) {
    case 'impact':
      impact(e.sound, e.strength)
      break
    case 'break':
      shatter(e.material.sound)
      break
    case 'launch':
      launch(e.breed)
      break
    case 'ability':
      ability(e.breed)
      break
    case 'swish':
      swish(e.glide)
      break
    case 'grip':
      grip()
      break
    case 'fan':
      fan()
      break
    case 'bark':
      bark()
      break
    case 'stir':
      stir()
      break
    case 'loaf':
      tone(160, 'sine', 0.12, 0.02, 0.15, 120)
      break
    default:
      break
  }
}
