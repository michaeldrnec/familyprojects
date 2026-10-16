// Synthesized SFX via the Web Audio API only -- no audio files, following
// scrapyard-ballistics/audio.ts: a lazy AudioContext created from a real
// user gesture (init()) and a master gain node for mute.
import type { EventKind } from './sim'

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let muted = false
let noise: AudioBuffer | null = null

export function init() {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume()
    return
  }
  try {
    ctx = new AudioContext()
  } catch {
    return
  }
  masterGain = ctx.createGain()
  masterGain.gain.value = muted ? 0 : 0.6
  masterGain.connect(ctx.destination)
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
}

export function setMuted(next: boolean) {
  muted = next
  if (masterGain && ctx) masterGain.gain.setTargetAtTime(muted ? 0 : 0.6, ctx.currentTime, 0.05)
}

export function isMuted() {
  return muted
}

function tone(freq: number, type: OscillatorType, peak: number, attack: number, release: number, sweepTo?: number, delay = 0) {
  if (!ctx || !masterGain) return
  const osc = ctx.createOscillator()
  osc.type = type
  const gain = ctx.createGain()
  const t0 = ctx.currentTime + delay
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(peak, t0 + attack)
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + attack + release)
  gain.connect(masterGain)
  osc.frequency.setValueAtTime(freq, t0)
  if (sweepTo !== undefined) osc.frequency.exponentialRampToValueAtTime(sweepTo, t0 + attack + release)
  osc.connect(gain)
  osc.start(t0)
  osc.stop(t0 + attack + release + 0.05)
}

function hiss(duration: number, filterType: BiquadFilterType, freq: number, peak: number, sweepTo?: number) {
  if (!ctx || !masterGain || !noise) return
  const src = ctx.createBufferSource()
  src.buffer = noise
  const filter = ctx.createBiquadFilter()
  filter.type = filterType
  filter.frequency.value = freq
  if (sweepTo !== undefined) filter.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + duration)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(peak, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(masterGain)
  src.start()
  src.stop(ctx.currentTime + duration)
}

function chime(notes: number[], gap: number, type: OscillatorType, peak: number) {
  notes.forEach((f, i) => tone(f, type, peak, 0.01, gap * 1.6, undefined, i * gap))
}

export type Cue = 'launch' | 'beam' | 'intercept' | 'shield' | 'emp' | 'down' | 'charge' | 'win' | 'lose' | 'click' | 'denied'

export function play(cue: Cue) {
  switch (cue) {
    case 'launch':
      hiss(0.35, 'bandpass', 900, 0.25, 300)
      return
    case 'beam':
      tone(1400, 'sawtooth', 0.08, 0.005, 0.25, 500)
      return
    case 'intercept':
      hiss(0.12, 'highpass', 2500, 0.3)
      tone(220, 'square', 0.1, 0.002, 0.1, 90)
      return
    case 'shield':
      tone(330, 'sine', 0.2, 0.01, 0.4, 660)
      return
    case 'emp':
      tone(80, 'sine', 0.3, 0.01, 0.6, 40)
      hiss(0.4, 'lowpass', 600, 0.2, 100)
      return
    case 'down':
      hiss(0.6, 'lowpass', 1400, 0.45, 80)
      tone(70, 'sine', 0.3, 0.01, 0.5, 35)
      return
    case 'charge':
      tone(200, 'square', 0.08, 0.3, 0.2, 900)
      return
    case 'win':
      chime([523, 659, 784, 1047], 0.11, 'triangle', 0.2)
      return
    case 'lose':
      tone(440, 'square', 0.1, 0.01, 0.2)
      tone(330, 'square', 0.1, 0.01, 0.2, undefined, 0.22)
      tone(220, 'square', 0.1, 0.01, 0.4, undefined, 0.44)
      return
    case 'click':
      tone(900, 'square', 0.05, 0.002, 0.05, 600)
      return
    case 'denied':
      tone(140, 'square', 0.1, 0.005, 0.15, 110)
      return
  }
}

export function cueFor(kind: EventKind): Cue | null {
  switch (kind) {
    case 'launch':
    case 'stutter':
      return 'launch'
    case 'intercept':
    case 'dust':
      return 'intercept'
    case 'drain':
    case 'shatter':
    case 'blocked':
    case 'absorb':
    case 'refract':
      return 'shield'
    case 'emp':
    case 'overload':
      return 'emp'
    case 'destroy':
    case 'collateral':
    case 'damage':
      return 'down'
    case 'battery-fire':
      return 'charge'
    case 'win':
      return 'win'
    case 'lose':
      return 'lose'
    default:
      return null
  }
}
