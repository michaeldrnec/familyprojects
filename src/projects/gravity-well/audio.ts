// Sound effects for Gravity Well, synthesized with the Web Audio API -- no
// audio files to source or bundle. A rocket engine that roars for the whole
// flight (startEngine/updateEngine/stopEngine), a boost surge, a stardust
// chime, an impact boom on crash, a triumphant arpeggio on landing, and a
// soft UI blip for buttons.
//
// The site-wide AudioContext (shared/audio.ts) is first used in init(), which
// callers must invoke from a real user-gesture handler (launch() only ever
// runs as a direct result of a pointerup, key press or button click, so
// that's the natural place).
import { createChannel, getAudioContext } from '../../shared/audio'

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
// Engine noise sources, built once per context.
let roarBuffer: AudioBuffer | null = null
let crackleBuffer: AudioBuffer | null = null

function makeNoiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

// Brown noise: white noise run through a leaky integrator, so its energy
// piles up in the low end -- the deep, pitchless roar of a rocket exhaust,
// where plain white noise would just hiss.
function makeBrownNoiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
    data[i] = last * 3.5
  }
  return buffer
}

// Sparse random pops of varying size: the crackle of a solid-fuel motor.
function makeCrackleBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate)
  const data = buffer.getChannelData(0)
  let i = 0
  while (i < data.length) {
    i += Math.floor(context.sampleRate * (0.004 + Math.random() * 0.03))
    const size = 0.3 + Math.random() * 0.7
    const length = Math.floor(context.sampleRate * (0.001 + Math.random() * 0.003))
    for (let j = 0; j < length && i + j < data.length; j++) {
      data[i + j] = size * (Math.random() * 2 - 1) * (1 - j / length)
    }
  }
  return buffer
}

// A soft-clipping curve: adds grit and density to the roar.
function makeDriveCurve(amount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(1024)
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1
    curve[i] = Math.tanh(amount * x) / Math.tanh(amount)
  }
  return curve
}

export function init() {
  if (ctx) {
    getAudioContext() // resumes it if the browser suspended it
    return
  }
  const shared = getAudioContext()
  const out = createChannel(1)
  if (!shared || !out) return
  ctx = shared
  masterGain = out
  roarBuffer = makeBrownNoiseBuffer(shared, 3)
  crackleBuffer = makeCrackleBuffer(shared, 2)
}

function envGain(context: AudioContext, destination: AudioNode, peak: number, attack: number, release: number) {
  const gain = context.createGain()
  gain.gain.setValueAtTime(0, context.currentTime)
  gain.gain.linearRampToValueAtTime(peak, context.currentTime + attack)
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + attack + release)
  gain.connect(destination)
  return gain
}

// A deep, fast-falling thud -- the "whump" of ignition or a boost.
function thump(context: AudioContext, destination: AudioNode, peak: number, from: number, to: number) {
  const now = context.currentTime
  const osc = context.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(from, now)
  osc.frequency.exponentialRampToValueAtTime(to, now + 0.25)
  const gain = envGain(context, destination, peak, 0.005, 0.35)
  osc.connect(gain)
  osc.start(now)
  osc.stop(now + 0.4)
}

// A burst of band-passed noise sweeping upward: the blast of exhaust.
function blast(context: AudioContext, destination: AudioNode, peak: number, duration: number) {
  const now = context.currentTime
  const noise = context.createBufferSource()
  noise.buffer = makeNoiseBuffer(context, duration)
  const filter = context.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 0.6
  filter.frequency.setValueAtTime(400, now)
  filter.frequency.exponentialRampToValueAtTime(2200, now + duration)
  const gain = envGain(context, destination, peak, 0.01, duration)
  noise.connect(filter)
  filter.connect(gain)
  noise.start(now)
  noise.stop(now + duration)
}

interface Engine {
  out: GainNode
  roarGain: GainNode
  roarFilter: BiquadFilterNode
  crackleGain: GainNode
  sources: AudioScheduledSourceNode[]
}

let engine: Engine | null = null

// Ignition plus a sustained engine for the whole flight: a low thud and an
// exhaust blast, then a driven brown-noise roar with solid-fuel crackle on
// top. The roar starts at full burn and settles; updateEngine() then rides
// it on the rocket's speed until stopEngine().
export function startEngine() {
  if (!ctx || !masterGain || !roarBuffer || !crackleBuffer) return
  stopEngine(true)
  const now = ctx.currentTime

  thump(ctx, masterGain, 0.55, 110, 32)
  blast(ctx, masterGain, 0.3, 0.35)

  const out = ctx.createGain()
  out.gain.setValueAtTime(0, now)
  out.gain.linearRampToValueAtTime(1, now + 0.03)
  out.connect(masterGain)

  // Ignition burn: louder for the first moments, then eases to cruise.
  const burn = ctx.createGain()
  burn.gain.setValueAtTime(1.8, now)
  burn.gain.setTargetAtTime(1, now + 0.15, 0.35)
  burn.connect(out)

  const roar = ctx.createBufferSource()
  roar.buffer = roarBuffer
  roar.loop = true
  const drive = ctx.createWaveShaper()
  drive.curve = makeDriveCurve(2.5)
  const roarFilter = ctx.createBiquadFilter()
  roarFilter.type = 'lowpass'
  roarFilter.Q.value = 0.7
  roarFilter.frequency.setValueAtTime(1400, now)
  roarFilter.frequency.setTargetAtTime(700, now + 0.1, 0.4)
  const roarGain = ctx.createGain()
  roarGain.gain.value = 0.32
  roar.connect(drive)
  drive.connect(roarFilter)
  roarFilter.connect(roarGain)
  roarGain.connect(burn)

  // Sub layer: the same roar, low-passed hard, for chest-rattling weight.
  const subFilter = ctx.createBiquadFilter()
  subFilter.type = 'lowpass'
  subFilter.frequency.value = 110
  const subGain = ctx.createGain()
  subGain.gain.value = 0.9
  roar.connect(subFilter)
  subFilter.connect(subGain)
  subGain.connect(burn)

  const crackle = ctx.createBufferSource()
  crackle.buffer = crackleBuffer
  crackle.loop = true
  const crackleFilter = ctx.createBiquadFilter()
  crackleFilter.type = 'highpass'
  crackleFilter.frequency.value = 900
  const crackleGain = ctx.createGain()
  crackleGain.gain.value = 0.12
  crackle.connect(crackleFilter)
  crackleFilter.connect(crackleGain)
  crackleGain.connect(burn)

  // Two slow, unrelated wobbles on the roar's level, so it churns like
  // turbulent exhaust instead of sitting perfectly still.
  const wobbles = [7.3, 12.9].map((freq, i) => {
    const lfo = ctx!.createOscillator()
    lfo.frequency.value = freq
    const depth = ctx!.createGain()
    depth.gain.value = i === 0 ? 0.06 : 0.04
    lfo.connect(depth)
    depth.connect(roarGain.gain)
    return lfo
  })

  const offset = Math.random() * roarBuffer.duration
  roar.start(now, offset)
  crackle.start(now, Math.random() * crackleBuffer.duration)
  wobbles.forEach((lfo) => lfo.start(now))
  engine = { out, roarGain, roarFilter, crackleGain, sources: [roar, crackle, ...wobbles] }
}

// Rides the engine on the flight: louder and brighter as the rocket speeds
// up (`speed01`, 0..1), and a full-throttle surge while `boosting`.
export function updateEngine(speed01: number, boosting: boolean) {
  if (!ctx || !engine) return
  const now = ctx.currentTime
  const s = Math.max(0, Math.min(1, speed01))
  engine.roarGain.gain.setTargetAtTime(0.22 + 0.22 * s + (boosting ? 0.3 : 0), now, 0.08)
  engine.roarFilter.frequency.setTargetAtTime(450 + 900 * s + (boosting ? 1400 : 0), now, 0.08)
  engine.crackleGain.gain.setTargetAtTime(0.06 + 0.1 * s + (boosting ? 0.22 : 0), now, 0.08)
}

// Cuts the engine: a quick choke on a crash, a short wind-down on landing.
export function stopEngine(quick = false) {
  if (!ctx || !engine) return
  const now = ctx.currentTime
  const { out, sources } = engine
  engine = null
  out.gain.cancelScheduledValues(now)
  out.gain.setValueAtTime(out.gain.value, now)
  out.gain.setTargetAtTime(0, now, quick ? 0.02 : 0.15)
  const end = now + (quick ? 0.2 : 0.9)
  sources.forEach((src) => src.stop(end))
  setTimeout(() => out.disconnect(), (end - now) * 1000 + 100)
}

// The mid-flight boost kicking in: a thud and an exhaust blast on top of
// the engine's own surge (updateEngine with `boosting`).
export function playBoost() {
  if (!ctx || !masterGain) return
  thump(ctx, masterGain, 0.4, 90, 40)
  blast(ctx, masterGain, 0.35, 0.45)
}

// A bright two-note sparkle for collecting stardust.
export function playStardust() {
  if (!ctx || !masterGain) return
  ;[1318.5, 1975.5].forEach((freq, i) => {
    const osc = ctx!.createOscillator()
    osc.type = 'triangle'
    const start = ctx!.currentTime + i * 0.06
    const gain = ctx!.createGain()
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.16, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25)
    osc.frequency.value = freq
    osc.connect(gain)
    gain.connect(masterGain!)
    osc.start(start)
    osc.stop(start + 0.27)
  })
}

// A filtered noise boom for a crash -- bigger and lower than a UI blip so
// it always reads as "something went wrong."
export function playCrash() {
  if (!ctx || !masterGain) return
  const duration = 0.5
  const noise = ctx.createBufferSource()
  noise.buffer = makeNoiseBuffer(ctx, duration)
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(1600, ctx.currentTime)
  filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + duration)
  const gain = envGain(ctx, filter, 0.5, 0.005, duration)
  noise.connect(gain)
  gain.connect(filter)
  filter.connect(masterGain)
  noise.start()
  noise.stop(ctx.currentTime + duration)
}

// A short triumphant arpeggio for a successful landing.
export function playWin() {
  if (!ctx || !masterGain) return
  const notes = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    const osc = ctx!.createOscillator()
    osc.type = 'triangle'
    const start = ctx!.currentTime + i * 0.09
    const gain = ctx!.createGain()
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.22, start + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3)
    osc.frequency.value = freq
    osc.connect(gain)
    gain.connect(masterGain!)
    osc.start(start)
    osc.stop(start + 0.32)
  })
}

// A soft two-tone blip for UI buttons (Launch, Next Level, Retry, Restart).
export function playClick() {
  if (!ctx || !masterGain) return
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  const gain = envGain(ctx, masterGain, 0.12, 0.005, 0.08)
  osc.frequency.setValueAtTime(660, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.06)
  osc.connect(gain)
  osc.start()
  osc.stop(ctx.currentTime + 0.1)
}
