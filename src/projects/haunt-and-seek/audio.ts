// Web Audio for Haunt & Seek, all synthesized (no audio files): a music-box
// waltz in a minor key that speeds up as Snaxley fills up, a quick bright
// jingle during a Sugar Rush, and cartoon effects. Effects can be panned left
// or right of the camera.
//
// The site-wide AudioContext (shared/audio.ts) is first used in init(), which
// callers must invoke from a real user-gesture handler -- browsers block
// autoplay otherwise.
import { createChannel, getAudioContext } from '../../shared/audio'

// A minor: Am, F, C, E, one bar of three beats each.
const BARS = [
  [220, 261.63, 329.63],
  [174.61, 220, 261.63],
  [261.63, 329.63, 392],
  [164.81, 207.65, 246.94],
]
const MELODY = [659.25, 523.25, 587.33, 659.25, 698.46, 659.25, 587.33, 523.25, 493.88, 523.25, 440, 493.88]

let ctx: AudioContext | null = null
let out: GainNode | null = null
let music: GainNode | null = null
let sfx: GainNode | null = null
let noise: AudioBuffer | null = null

let scheduler = 0
let nextBeat = 0
let beat = 0
let tempo = 1
let rush = false

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
  music = ctx.createGain()
  music.gain.value = 0.32
  music.connect(out)
  sfx = ctx.createGain()
  sfx.gain.value = 0.85
  sfx.connect(out)
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
}

// --- Building blocks ------------------------------------------------------

function panned(pan: number): AudioNode | null {
  if (!ctx || !sfx) return null
  if (!pan) return sfx
  const p = ctx.createStereoPanner()
  p.pan.value = Math.max(-1, Math.min(1, pan))
  p.connect(sfx)
  return p
}

function tone(dest: AudioNode | null, type: OscillatorType, freq: number, start: number, peak: number, length: number, endFreq?: number, attack = 0.005) {
  if (!ctx || !dest) return
  const osc = ctx.createOscillator()
  osc.type = type
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

// --- Music -----------------------------------------------------------------

function scheduleBeat(at: number, len: number) {
  const bar = BARS[Math.floor(beat / 3) % BARS.length]
  const inBar = beat % 3
  if (rush) {
    // Sugar Rush: bouncy square-wave arpeggio, twice as busy.
    tone(music, 'square', bar[inBar] * 2, at, 0.04, len * 0.45)
    tone(music, 'square', bar[(inBar + 1) % 3] * 2, at + len / 2, 0.035, len * 0.4)
    if (inBar === 0) tone(music, 'triangle', bar[0] / 2, at, 0.18, len * 0.9)
  } else {
    if (inBar === 0) tone(music, 'sine', bar[0] / 2, at, 0.2, len * 2.6, undefined, 0.02)
    else tone(music, 'triangle', bar[1 + (inBar % 2)], at, 0.06, len * 0.9)
    // The music box plinks the tune.
    tone(music, 'sine', MELODY[beat % MELODY.length], at, 0.09, len * 1.4)
    tone(music, 'sine', MELODY[beat % MELODY.length] * 2, at, 0.025, len * 0.6)
  }
  beat++
}

function pump() {
  if (!ctx) return
  const len = (rush ? 0.22 : 0.42) / tempo
  const horizon = ctx.currentTime + 0.3
  while (nextBeat < horizon) {
    scheduleBeat(nextBeat, len)
    nextBeat += len
  }
}

export function startMusic() {
  if (!ctx || scheduler) return
  nextBeat = ctx.currentTime + 0.1
  scheduler = window.setInterval(pump, 100)
  pump()
}

export function stopMusic() {
  if (scheduler) window.clearInterval(scheduler)
  scheduler = 0
}

// Hunger 0..1 speeds the waltz up a little; a Sugar Rush swaps the tune.
export function setMood(hunger: number, sugarRush: boolean) {
  tempo = 1 + hunger * 0.35
  rush = sugarRush
}

// --- Effects ---------------------------------------------------------------

export function crunch(pan = 0) {
  const d = panned(pan)
  hiss(d, now(), 0.12, 0.05, 'bandpass', 2600 + Math.random() * 800)
}

// The cartoon "BOO!": a spring boing plus a whoosh. Bigger scares, bigger boing.
export function boo(amount: number, pan = 0) {
  const d = panned(pan)
  const t = now()
  const big = Math.min(1, amount / 15)
  tone(d, 'sawtooth', 180, t, 0.08 + big * 0.06, 0.35, 90)
  tone(d, 'triangle', 520, t, 0.12, 0.3, 1400)
  hiss(d, t, 0.15 + big * 0.1, 0.3, 'bandpass', 800, 2400)
}

export function combo() {
  const t = now()
  ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(sfx, 'triangle', f, t + i * 0.06, 0.12, 0.25))
}

export function swoop(pan = 0) {
  hiss(panned(pan), now(), 0.22, 0.3, 'bandpass', 400, 2600, 0.02)
}

export function snuff() {
  hiss(sfx, now(), 0.15, 0.5, 'lowpass', 1200, 200, 0.01)
}

export function wail(pan = 0) {
  const d = panned(pan)
  const t = now()
  tone(d, 'sine', 330, t, 0.12, 1.4, 220, 0.25)
  tone(d, 'sine', 335, t + 0.05, 0.08, 1.4, 215, 0.25)
}

export function thump(pan = 0) {
  const d = panned(pan)
  const t = now()
  tone(d, 'sine', 110, t, 0.45, 0.4, 40)
  hiss(d, t, 0.25, 0.2, 'lowpass', 500)
}

export function splat(pan = 0) {
  const d = panned(pan)
  tone(d, 'sine', 300, now(), 0.15, 0.2, 90)
  hiss(d, now(), 0.15, 0.15, 'lowpass', 900)
}

export function fizz(pan = 0) {
  const d = panned(pan)
  const t = now()
  for (let i = 0; i < 6; i++) hiss(d, t + i * 0.05, 0.1, 0.08, 'highpass', 4000 + i * 500)
}

export function shatter(pan = 0) {
  const d = panned(pan)
  const t = now()
  for (let i = 0; i < 5; i++) tone(d, 'triangle', 1800 + Math.random() * 1600, t + i * 0.03, 0.06, 0.25)
}

export function goo(pan = 0) {
  const d = panned(pan)
  const t = now()
  for (let i = 0; i < 3; i++) tone(d, 'sine', 140 + i * 30, t + i * 0.12, 0.15, 0.15, 260)
}

export function sparkle() {
  const t = now()
  tone(sfx, 'sine', 1568, t, 0.07, 0.15)
  tone(sfx, 'sine', 2093, t + 0.06, 0.06, 0.2)
}

export function footstep(pan = 0) {
  tone(panned(pan), 'sine', 90, now(), 0.12, 0.08, 60)
}

export function gumball() {
  const t = now()
  ;[392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(sfx, 'square', f, t + i * 0.05, 0.05, 0.12))
}

export function poof() {
  hiss(sfx, now(), 0.3, 0.35, 'lowpass', 2000, 300)
  tone(sfx, 'triangle', 600, now(), 0.08, 0.25, 200)
}

export function denied() {
  tone(sfx, 'square', 200, now(), 0.04, 0.08)
}

export function swap() {
  tone(sfx, 'triangle', 880, now(), 0.06, 0.08, 1320)
}

export function flee() {
  const t = now()
  tone(sfx, 'sawtooth', 900, t, 0.06, 0.8, 200)
  hiss(sfx, t, 0.12, 0.6, 'bandpass', 1500, 400)
}

export function win() {
  const t = now()
  ;[523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(sfx, 'triangle', f, t + i * 0.12, 0.14, 0.5))
}

export function lose() {
  const t = now()
  ;[392, 349.23, 311.13, 261.63].forEach((f, i) => tone(sfx, 'triangle', f, t + i * 0.22, 0.12, 0.45))
}
