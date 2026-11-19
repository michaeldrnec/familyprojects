// Web Audio for 10 Centimeters, all synthesized (no audio files): the soft
// whoosh of the fetal monitor for the selected bay, the alarm while a baby is
// in trouble, chimes for arrivals and babies, and the clicks, pops and snips
// of the mini-games.
//
// The site-wide AudioContext (shared/audio.ts) is first used in init(), which
// callers must invoke from a real user gesture -- browsers block autoplay
// otherwise. Every sound is a no-op until then.
import { createChannel, getAudioContext } from '../../shared/audio'

let ctx: AudioContext | null = null
let out: GainNode | null = null
let noise: AudioBuffer | null = null

export function init() {
  if (ctx) {
    getAudioContext() // resumes it if the browser suspended it
    return
  }
  const shared = getAudioContext()
  const channel = createChannel(0.6)
  if (!shared || !channel) return
  ctx = shared
  out = channel
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
}

// --- Building blocks ------------------------------------------------------------

function tone(type: OscillatorType, freq: number, start: number, peak: number, length: number, endFreq?: number, attack = 0.005) {
  if (!ctx || !out) return
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + length)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, start)
  g.gain.linearRampToValueAtTime(peak, start + attack)
  g.gain.exponentialRampToValueAtTime(0.0008, start + length)
  osc.connect(g)
  g.connect(out)
  osc.start(start)
  osc.stop(start + length + 0.05)
}

function hiss(start: number, peak: number, length: number, filter: BiquadFilterType, freq: number, endFreq?: number, attack = 0.003) {
  if (!ctx || !out || !noise) return
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
  g.connect(out)
  src.start(start, Math.random() * 0.5)
  src.stop(start + length + 0.05)
}

const now = () => ctx?.currentTime ?? 0

// --- The floor ------------------------------------------------------------------

// One heartbeat on the fetal monitor: a soft Doppler whoosh-thump.
export function heartbeat(critical: boolean) {
  const t = now()
  tone('sine', critical ? 95 : 130, t, 0.16, 0.12, critical ? 70 : 90, 0.01)
  hiss(t, 0.035, 0.1, 'bandpass', critical ? 500 : 700, undefined, 0.02)
}

// The monitor alarm while a baby is critical: a gentle two-tone chirp.
export function alarm() {
  const t = now()
  tone('triangle', 988, t, 0.07, 0.16)
  tone('triangle', 784, t + 0.18, 0.07, 0.2)
}

export function arrival() {
  const t = now()
  tone('sine', 784, t, 0.12, 0.5)
  tone('sine', 587, t + 0.16, 0.12, 0.7)
}

export function complication() {
  const t = now()
  tone('triangle', 660, t, 0.1, 0.18)
  tone('triangle', 523, t + 0.14, 0.1, 0.3)
}

export function critical() {
  const t = now()
  for (let i = 0; i < 3; i++) tone('square', 880, t + i * 0.13, 0.035, 0.09)
}

export function pickup() {
  const t = now()
  tone('sine', 520, t, 0.12, 0.08, 780)
}

export function treat() {
  const t = now()
  hiss(t, 0.06, 0.25, 'bandpass', 900, 2400, 0.04)
  tone('sine', 660, t + 0.05, 0.07, 0.25, 990)
}

export function denied() {
  const t = now()
  tone('square', 150, t, 0.05, 0.16, 120)
}

export function scrubbed() {
  const t = now()
  hiss(t, 0.05, 0.4, 'highpass', 3000, undefined, 0.05)
  ;[1047, 1319, 1568].forEach((f, i) => tone('sine', f, t + 0.12 + i * 0.07, 0.07, 0.3))
}

export function procedure(csection: boolean) {
  const t = now()
  if (csection) for (let i = 0; i < 2; i++) tone('triangle', 740, t + i * 0.22, 0.08, 0.18, 990)
  else tone('sine', 392, t, 0.1, 0.5, 784, 0.05)
}

// A cartoon newborn cry ("waah!") and a happy chime.
export function delivered() {
  if (!ctx || !out) return
  const t = now()
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(420, t)
  osc.frequency.linearRampToValueAtTime(560, t + 0.12)
  osc.frequency.linearRampToValueAtTime(470, t + 0.55)
  const vib = ctx.createOscillator()
  vib.frequency.value = 7
  const vibDepth = ctx.createGain()
  vibDepth.gain.value = 14
  vib.connect(vibDepth)
  vibDepth.connect(osc.frequency)
  const formant = ctx.createBiquadFilter()
  formant.type = 'bandpass'
  formant.frequency.setValueAtTime(900, t)
  formant.frequency.linearRampToValueAtTime(1400, t + 0.15)
  formant.Q.value = 3
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.16, t + 0.06)
  g.gain.setValueAtTime(0.16, t + 0.4)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
  osc.connect(formant)
  formant.connect(g)
  g.connect(out)
  osc.start(t)
  vib.start(t)
  osc.stop(t + 0.65)
  vib.stop(t + 0.65)
  ;[523, 659, 784, 1047].forEach((f, i) => tone('sine', f, t + 0.7 + i * 0.09, 0.09, 0.45))
}

export function midwife() {
  const t = now()
  ;[659, 523].forEach((f, i) => tone('sine', f, t + i * 0.14, 0.09, 0.45))
}

// The specialist team on its way: a soft, quick two-tone.
export function transfer() {
  const t = now()
  for (let i = 0; i < 2; i++) {
    tone('triangle', 740, t + i * 0.5, 0.07, 0.24)
    tone('triangle', 587, t + i * 0.5 + 0.25, 0.07, 0.24)
  }
}

export function shiftOver(good: boolean) {
  const t = now()
  const notes = good ? [523, 659, 784, 1047, 1319] : [523, 494, 440, 392]
  notes.forEach((f, i) => tone('sine', f, t + i * 0.12, 0.1, 0.5))
}

// --- Mini-games -----------------------------------------------------------------

export function pushResult(rating: 'perfect' | 'good' | 'miss') {
  const t = now()
  if (rating === 'miss') {
    tone('sine', 180, t, 0.14, 0.25, 110)
    return
  }
  tone('sine', rating === 'perfect' ? 880 : 660, t, 0.12, 0.3)
  if (rating === 'perfect') tone('sine', 1320, t + 0.06, 0.08, 0.35)
}

export function scalpel() {
  hiss(now(), 0.025, 0.08, 'highpass', 5000)
}

export function bubblePop() {
  const t = now()
  tone('sine', 300, t, 0.14, 0.09, 900)
  hiss(t, 0.04, 0.06, 'bandpass', 2500)
}

export function clamp() {
  const t = now()
  tone('square', 1800, t, 0.05, 0.03)
  tone('square', 1200, t + 0.04, 0.05, 0.04)
}

export function snip() {
  const t = now()
  hiss(t, 0.09, 0.07, 'highpass', 4000)
  tone('triangle', 2200, t, 0.05, 0.05)
}

export function stitch() {
  const t = now()
  tone('sine', 1200 + Math.random() * 200, t, 0.06, 0.08)
}

export function stepDone() {
  const t = now()
  tone('sine', 784, t, 0.09, 0.2)
  tone('sine', 1175, t + 0.08, 0.09, 0.3)
}

export function oops() {
  const t = now()
  tone('triangle', 300, t, 0.08, 0.18, 220)
}
