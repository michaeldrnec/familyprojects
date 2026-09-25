// Synthesized SFX via the Web Audio API only -- no audio files, following
// ion-perimeter/audio.ts: a lazy singleton AudioContext created from a
// real user gesture (init()), and a masterGain node for mute. On top of
// the one-shot cues there's a continuous engine drone whose loudness and
// grit follow the live thrust.
import type { Cue } from './flight'

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let muted = false
let droneGain: GainNode | null = null
let droneFilter: BiquadFilterNode | null = null
let droneOsc: OscillatorNode | null = null

function makeNoiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

export function init() {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume()
    return
  }
  ctx = new AudioContext()
  masterGain = ctx.createGain()
  masterGain.gain.value = muted ? 0 : 0.8
  masterGain.connect(ctx.destination)
}

export function setMuted(next: boolean) {
  muted = next
  if (masterGain && ctx) masterGain.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.05)
}

export function isMuted() {
  return muted
}

function envGain(context: AudioContext, destination: AudioNode, peak: number, attack: number, release: number) {
  const gain = context.createGain()
  gain.gain.setValueAtTime(0, context.currentTime)
  gain.gain.linearRampToValueAtTime(peak, context.currentTime + attack)
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + attack + release)
  gain.connect(destination)
  return gain
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

function noiseBurst(duration: number, filterType: BiquadFilterType, freq: number, peak: number, sweepTo?: number) {
  if (!ctx || !masterGain) return
  const noise = ctx.createBufferSource()
  noise.buffer = makeNoiseBuffer(ctx, duration)
  const filter = ctx.createBiquadFilter()
  filter.type = filterType
  filter.frequency.value = freq
  if (sweepTo !== undefined) filter.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + duration)
  const gain = envGain(ctx, masterGain, peak, 0.005, duration)
  noise.connect(filter)
  filter.connect(gain)
  noise.start()
  noise.stop(ctx.currentTime + duration)
}

function chime(notes: number[], gap: number, type: OscillatorType, peak: number) {
  notes.forEach((f, i) => tone(f, type, peak, 0.01, gap * 1.4, undefined, i * gap))
}

export function playCue(cue: Cue) {
  switch (cue) {
    case 'ignite':
      noiseBurst(0.5, 'lowpass', 1800, 0.35, 200)
      tone(90, 'sawtooth', 0.12, 0.02, 0.4, 50)
      return
    case 'bolt':
      noiseBurst(0.18, 'bandpass', 1400, 0.5)
      tone(160, 'square', 0.2, 0.002, 0.12, 60)
      return
    case 'snap':
      tone(900, 'square', 0.25, 0.001, 0.08, 180)
      noiseBurst(0.25, 'highpass', 2200, 0.3)
      tone(70, 'sawtooth', 0.15, 0.01, 0.3, 40, 0.05) // groaning metal
      return
    case 'chute':
      noiseBurst(0.4, 'lowpass', 600, 0.4, 150)
      tone(220, 'sine', 0.12, 0.05, 0.3, 110)
      return
    case 'shred':
      noiseBurst(0.6, 'bandpass', 3000, 0.35, 800)
      return
    case 'explode':
    case 'crash':
      noiseBurst(cue === 'crash' ? 1.2 : 0.7, 'lowpass', 1200, 0.7, 60)
      tone(60, 'sine', 0.4, 0.01, 0.8, 30)
      return
    case 'burnup':
      noiseBurst(0.8, 'highpass', 1500, 0.3, 4000)
      return
    case 'failure':
      // two-tone klaxon
      tone(660, 'square', 0.12, 0.01, 0.16)
      tone(440, 'square', 0.12, 0.01, 0.16, undefined, 0.2)
      tone(660, 'square', 0.12, 0.01, 0.16, undefined, 0.4)
      return
    case 'orbit':
      chime([523, 659, 784, 1047, 1319], 0.12, 'triangle', 0.2)
      return
    case 'land':
      chime([392, 523, 659], 0.14, 'triangle', 0.18)
      return
    case 'ding':
      tone(1760, 'sine', 0.2, 0.002, 0.6)
      return
    case 'denied':
      tone(140, 'square', 0.12, 0.005, 0.15, 110)
      return
  }
}

export function playPlace() {
  tone(520, 'square', 0.08, 0.002, 0.06, 380)
  noiseBurst(0.05, 'highpass', 3000, 0.1)
}

export function playRemove() {
  tone(300, 'square', 0.07, 0.002, 0.08, 180)
}

export function playWire() {
  tone(1200, 'sine', 0.08, 0.002, 0.05, 1800)
}

export function playBuy() {
  chime([880, 1320], 0.07, 'square', 0.08)
}

export function playDenied() {
  playCue('denied')
}

export function playContract() {
  chime([523, 659, 784, 1047], 0.1, 'triangle', 0.2)
}

// --- Continuous engine drone ------------------------------------------------

// level 0..1 (fraction of max thrust), grit 0..1 (junkier engines rattle
// more: mower/keg high, turbopump low).
export function setEngine(level: number, grit: number) {
  if (!ctx || !masterGain) return
  if (!droneGain) {
    const noise = ctx.createBufferSource()
    noise.buffer = makeNoiseBuffer(ctx, 2)
    noise.loop = true
    droneFilter = ctx.createBiquadFilter()
    droneFilter.type = 'lowpass'
    droneFilter.frequency.value = 400
    droneGain = ctx.createGain()
    droneGain.gain.value = 0
    droneOsc = ctx.createOscillator()
    droneOsc.type = 'sawtooth'
    droneOsc.frequency.value = 45
    const oscGain = ctx.createGain()
    oscGain.gain.value = 0.25
    noise.connect(droneFilter)
    droneOsc.connect(oscGain)
    oscGain.connect(droneFilter)
    droneFilter.connect(droneGain)
    droneGain.connect(masterGain)
    noise.start()
    droneOsc.start()
  }
  const t = ctx.currentTime
  droneGain.gain.setTargetAtTime(Math.min(0.5, level * 0.45), t, 0.08)
  droneFilter!.frequency.setTargetAtTime(250 + level * 900 + grit * 400, t, 0.1)
  // A mower-y putter: the sawtooth pitch wobbles with grit.
  droneOsc!.frequency.setTargetAtTime(35 + grit * 40 + Math.random() * grit * 25, t, 0.03)
}

export function stopEngine() {
  if (droneGain && ctx) droneGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1)
}
