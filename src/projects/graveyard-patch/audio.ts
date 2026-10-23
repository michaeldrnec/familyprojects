// Web Audio for Graveyard Patch, all synthesized (no audio files): a lo-fi
// loop that goes muffled and woozy as you nod off, a desk clock that ticks
// louder with the sleep meter, clicks that turn mushy, and the
// alerts of a long night shift.
//
// The site-wide AudioContext (shared/audio.ts) is first used in init(), which
// callers must invoke from a real user-gesture handler -- browsers block
// autoplay otherwise.
import { createChannel, getAudioContext } from '../../shared/audio'

const BPM = 78
const BEAT = 60 / BPM
// Fmaj7, Em7, Dm7, Cmaj7: one bar each.
const CHORDS = [
  [174.61, 220, 261.63, 329.63],
  [164.81, 196, 246.94, 293.66],
  [146.83, 174.61, 220, 261.63],
  [130.81, 164.81, 196, 246.94],
]

let ctx: AudioContext | null = null
let out: GainNode | null = null
let music: GainNode | null = null
let muffle: BiquadFilterNode | null = null
let sfx: GainNode | null = null
let tickGain: GainNode | null = null
let noise: AudioBuffer | null = null

let scheduler = 0
let nextBeat = 0
let beatIndex = 0
let nextTick = 0
let tired = 0

export function init() {
  if (ctx) {
    getAudioContext() // resumes it if the browser suspended it
    return
  }
  const shared = getAudioContext()
  const channel = createChannel(0.7)
  if (!shared || !channel) return
  ctx = shared
  out = channel
  muffle = ctx.createBiquadFilter()
  muffle.type = 'lowpass'
  muffle.frequency.value = 9000
  muffle.Q.value = 0.7
  muffle.connect(out)
  music = ctx.createGain()
  music.gain.value = 0.55
  music.connect(muffle)
  sfx = ctx.createGain()
  sfx.gain.value = 0.8
  sfx.connect(out)
  tickGain = ctx.createGain()
  tickGain.gain.value = 0.04
  tickGain.connect(out)

  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
}

// --- Building blocks ------------------------------------------------------

function tone(dest: AudioNode | null, type: OscillatorType, freq: number, start: number, peak: number, length: number, endFreq?: number, attack = 0.005, detune = 0) {
  if (!ctx || !dest) return
  const osc = ctx.createOscillator()
  osc.type = type
  osc.detune.value = detune
  osc.frequency.setValueAtTime(freq, start)
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + length)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, start)
  g.gain.linearRampToValueAtTime(peak, start + attack)
  g.gain.exponentialRampToValueAtTime(0.0008, start + length)
  osc.connect(g)
  g.connect(dest)
  osc.start(start)
  osc.stop(start + length + 0.05)
}

function hiss(dest: AudioNode | null, start: number, peak: number, length: number, filter: BiquadFilterType, freq: number, endFreq?: number, attack = 0.003) {
  if (!ctx || !dest || !noise) return
  const src = ctx.createBufferSource()
  src.buffer = noise
  src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = filter
  f.frequency.setValueAtTime(freq, start)
  if (endFreq) f.frequency.exponentialRampToValueAtTime(endFreq, start + length)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, start)
  g.gain.linearRampToValueAtTime(peak, start + attack)
  g.gain.exponentialRampToValueAtTime(0.0008, start + length)
  src.connect(f)
  f.connect(g)
  g.connect(dest)
  src.start(start, Math.random() * 0.5)
  src.stop(start + length + 0.05)
}

const now = () => ctx?.currentTime ?? 0

// --- Music and the desk clock --------------------------------------------

function scheduleBeat(at: number) {
  const bar = Math.floor(beatIndex / 4) % CHORDS.length
  const beat = beatIndex % 4
  // Sleepy music sags flat and smears.
  const sag = -tired * 35
  if (beat === 0) {
    for (const f of CHORDS[bar]) tone(music, 'triangle', f, at, 0.05, BEAT * 4, undefined, 0.4, sag + (Math.random() - 0.5) * 8)
    tone(music, 'sine', CHORDS[bar][0] / 2, at, 0.22, BEAT * 1.8, undefined, 0.02, sag)
  }
  if (beat === 2) tone(music, 'sine', CHORDS[bar][0] / 2, at, 0.16, BEAT * 1.6, undefined, 0.02, sag)
  if (beat === 0 || beat === 2) tone(music, 'sine', 110, at, 0.35, 0.22, 42)
  if (beat === 1 || beat === 3) hiss(music, at, 0.12, 0.12, 'bandpass', 1800, undefined, 0.002)
  hiss(music, at + BEAT / 2, 0.05, 0.05, 'highpass', 7000)
  beatIndex++
}

function pump() {
  if (!ctx) return
  const horizon = ctx.currentTime + 0.3
  while (nextBeat < horizon) {
    scheduleBeat(nextBeat)
    nextBeat += BEAT
  }
  while (nextTick < horizon) {
    tone(tickGain, 'square', 2400, nextTick, 0.6, 0.025)
    hiss(tickGain, nextTick, 0.5, 0.02, 'highpass', 3000)
    nextTick += 1
  }
}

export function startMusic() {
  if (!ctx || scheduler) return
  nextBeat = ctx.currentTime + 0.1
  nextTick = ctx.currentTime + 0.5
  scheduler = window.setInterval(pump, 100)
  pump()
}

export function stopMusic() {
  if (scheduler) window.clearInterval(scheduler)
  scheduler = 0
}

// How tired you are (0..1): closes the music filter and turns up the clock.
export function setTired(sleep: number) {
  tired = sleep
  if (!ctx || !muffle || !tickGain) return
  const cutoff = 350 + 9000 * Math.pow(1 - sleep, 2.2)
  muffle.frequency.setTargetAtTime(cutoff, ctx.currentTime, 0.25)
  tickGain.gain.setTargetAtTime(0.03 + 0.3 * sleep * sleep, ctx.currentTime, 0.25)
}

// --- Sound effects ---------------------------------------------------------

// A mouse click or key: crisp when awake, low and mushy when tired.
export function thock(sleep = tired) {
  const t = now()
  hiss(sfx, t, 0.35, 0.04 + sleep * 0.08, 'bandpass', 2600 - sleep * 1900)
  tone(sfx, 'sine', 180 - sleep * 60, t, 0.25, 0.05 + sleep * 0.06)
}

export function hit() {
  tone(sfx, 'triangle', 880, now(), 0.08, 0.08)
}

export function miss() {
  tone(sfx, 'sawtooth', 140, now(), 0.06, 0.12, 110)
}

export function report() {
  const t = now()
  tone(sfx, 'sine', 1320, t, 0.1, 0.08)
  tone(sfx, 'sine', 1760, t + 0.07, 0.08, 0.1)
}

// The chat-app ping, real or imagined.
export function ping() {
  const t = now()
  tone(sfx, 'sine', 988, t, 0.16, 0.18)
  tone(sfx, 'sine', 1319, t + 0.09, 0.14, 0.25)
}

export function siren() {
  const t = now()
  for (let i = 0; i < 3; i++) {
    tone(sfx, 'triangle', 660, t + i * 0.5, 0.12, 0.25, 880, 0.02)
    tone(sfx, 'triangle', 880, t + i * 0.5 + 0.25, 0.12, 0.25, 660, 0.02)
  }
}

export function fixed() {
  const t = now()
  ;[523.25, 659.25, 783.99].forEach((f, i) => tone(sfx, 'triangle', f, t + i * 0.06, 0.12, 0.2))
}

export function fail() {
  const t = now()
  tone(sfx, 'sawtooth', 220, t, 0.08, 0.2, 160)
  tone(sfx, 'sawtooth', 165, t + 0.18, 0.08, 0.3, 110)
}

export function quickPatch() {
  const t = now()
  hiss(sfx, t, 0.2, 0.25, 'bandpass', 900, 3000)
  tone(sfx, 'square', 400, t + 0.2, 0.05, 0.1, 800)
}

export function deployStart() {
  tone(sfx, 'sawtooth', 200, now(), 0.06, 0.5, 600, 0.05)
}

export function deployDone() {
  const t = now()
  ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(sfx, 'triangle', f, t + i * 0.08, 0.14, 0.4))
}

export function broken() {
  const t = now()
  tone(sfx, 'sawtooth', 300, t, 0.12, 0.6, 70, 0.01)
  hiss(sfx, t, 0.15, 0.4, 'lowpass', 800)
}

export function coffee() {
  const t = now()
  hiss(sfx, t, 0.25, 0.35, 'bandpass', 500, 1400, 0.05)
  tone(sfx, 'sine', 300, t + 0.4, 0.12, 0.12, 200)
}

export function crash() {
  tone(sfx, 'sine', 600, now(), 0.16, 0.9, 120, 0.02)
}

export function water() {
  const t = now()
  hiss(sfx, t, 0.4, 0.6, 'lowpass', 4000, 400, 0.01)
  hiss(sfx, t + 0.15, 0.2, 0.5, 'bandpass', 1200, 300)
}

export function shake() {
  hiss(sfx, now(), 0.12, 0.12, 'bandpass', 600, 1600, 0.01)
}

export function bomb() {
  const t = now()
  for (let i = 0; i < 6; i++) tone(sfx, 'sine', 1200 + i * 90, t + i * 0.08, 0.1, 0.1)
}

export function conflict() {
  const t = now()
  tone(sfx, 'square', 440, t, 0.06, 0.3)
  tone(sfx, 'square', 466, t, 0.06, 0.3)
}

export function crashZone() {
  tone(sfx, 'sine', 220, now(), 0.2, 1.4, 55, 0.2)
}

export function meow() {
  const t = now()
  tone(sfx, 'sawtooth', 700, t, 0.05, 0.12, 950, 0.03)
  tone(sfx, 'sawtooth', 950, t + 0.12, 0.05, 0.25, 600)
}

export function purr() {
  if (!ctx || !sfx) return
  const t = now()
  for (let i = 0; i < 8; i++) hiss(sfx, t + i * 0.12, 0.18, 0.1, 'lowpass', 220, undefined, 0.03)
}

export function pick() {
  tone(sfx, 'triangle', 520, now(), 0.05, 0.05)
}

export function drop() {
  tone(sfx, 'triangle', 390, now(), 0.05, 0.06)
}
