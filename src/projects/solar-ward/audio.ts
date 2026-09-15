// Retro arcade sound effects, synthesized entirely with the Web Audio API
// -- same technique as gravity-well/audio.ts and starwarden/audio.ts, no
// audio files to source or bundle.
//
// The AudioContext is created lazily via init(), which callers must invoke
// from a real user-gesture handler (the Launch button's onClick) --
// browsers block autoplay of audio created outside a gesture.

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let muted = false

let thrusterGain: GainNode | null = null

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
  masterGain.gain.value = muted ? 0 : 1
  masterGain.connect(ctx.destination)

  // Continuous looping noise source for the thruster hum, gated by a gain
  // node ramped up/down rather than starting/stopping the source itself
  // (which would click/pop every time thrust is toggled).
  const noise = ctx.createBufferSource()
  noise.buffer = makeNoiseBuffer(ctx, 2)
  noise.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 260
  filter.Q.value = 0.8
  thrusterGain = ctx.createGain()
  thrusterGain.gain.value = 0
  noise.connect(filter)
  filter.connect(thrusterGain)
  thrusterGain.connect(masterGain)
  noise.start()
}

export function setMuted(next: boolean) {
  muted = next
  if (masterGain && ctx) masterGain.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05)
}

export function isMuted() {
  return muted
}

export function setThrusterOn(on: boolean) {
  if (!ctx || !thrusterGain) return
  thrusterGain.gain.setTargetAtTime(on ? 0.08 : 0, ctx.currentTime, 0.06)
}

function envGain(context: AudioContext, destination: AudioNode, peak: number, attack: number, release: number) {
  const gain = context.createGain()
  gain.gain.setValueAtTime(0, context.currentTime)
  gain.gain.linearRampToValueAtTime(peak, context.currentTime + attack)
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + attack + release)
  gain.connect(destination)
  return gain
}

// A crisp, fast blaster pip -- distinct from Starwarden's laser (lower and
// shorter) so the two games don't sound interchangeable.
export function playFire() {
  if (!ctx || !masterGain) return
  const osc = ctx.createOscillator()
  osc.type = 'square'
  const gain = envGain(ctx, masterGain, 0.14, 0.003, 0.07)
  osc.frequency.setValueAtTime(720, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(360, ctx.currentTime + 0.07)
  osc.connect(gain)
  osc.start()
  osc.stop(ctx.currentTime + 0.09)
}

// A satisfying little pop when a beam is intercepted.
export function playIntercept() {
  if (!ctx || !masterGain) return
  const duration = 0.16
  const noise = ctx.createBufferSource()
  noise.buffer = makeNoiseBuffer(ctx, duration)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(1400, ctx.currentTime)
  filter.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + duration)
  const gain = envGain(ctx, filter, 0.3, 0.005, duration)
  noise.connect(gain)
  gain.connect(filter)
  filter.connect(masterGain)
  noise.start()
  noise.stop(ctx.currentTime + duration)
}

// A bigger crunch for a destroyed fighter -- harder target, bigger payoff.
export function playFighterKill() {
  if (!ctx || !masterGain) return
  const duration = 0.32
  const noise = ctx.createBufferSource()
  noise.buffer = makeNoiseBuffer(ctx, duration)
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(2000, ctx.currentTime)
  filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + duration)
  const gain = envGain(ctx, filter, 0.4, 0.005, duration)
  noise.connect(gain)
  gain.connect(filter)
  filter.connect(masterGain)
  noise.start()
  noise.stop(ctx.currentTime + duration)

  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  const oscGain = envGain(ctx, masterGain, 0.18, 0.005, 0.2)
  osc.frequency.setValueAtTime(500, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.2)
  osc.connect(oscGain)
  osc.start()
  osc.stop(ctx.currentTime + 0.22)
}

// A short warning chime whenever a dreadnought starts telegraphing -- a
// fair, readable warning cue, not just flavor.
export function playTelegraph() {
  if (!ctx || !masterGain) return
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  const gain = envGain(ctx, masterGain, 0.1, 0.01, 0.12)
  osc.frequency.setValueAtTime(700, ctx.currentTime)
  osc.connect(gain)
  osc.start()
  osc.stop(ctx.currentTime + 0.14)
}

// An urgent alarm buzz when a Core Integrity segment takes a hit.
export function playSegmentHit() {
  if (!ctx || !masterGain) return
  const notes = [220, 185]
  notes.forEach((freq, i) => {
    const osc = ctx!.createOscillator()
    osc.type = 'sawtooth'
    const start = ctx!.currentTime + i * 0.09
    const gain = ctx!.createGain()
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.28, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15)
    osc.frequency.value = freq
    osc.connect(gain)
    gain.connect(masterGain!)
    osc.start(start)
    osc.stop(start + 0.17)
  })
}

// The Overcharge Pulse: a big layered boom, distinct from Starwarden's Nova
// so each game's panic button has its own identity, but built the same way
// -- a noise boom under a rising sweep.
export function playOvercharge() {
  if (!ctx || !masterGain) return
  const duration = 0.7
  const noise = ctx.createBufferSource()
  noise.buffer = makeNoiseBuffer(ctx, duration)
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(2600, ctx.currentTime)
  filter.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + duration)
  const noiseGain = envGain(ctx, filter, 0.55, 0.01, duration)
  noise.connect(noiseGain)
  noiseGain.connect(filter)
  filter.connect(masterGain)
  noise.start()
  noise.stop(ctx.currentTime + duration)

  const osc = ctx.createOscillator()
  osc.type = 'sine'
  const oscGain = envGain(ctx, masterGain, 0.3, 0.02, 0.45)
  osc.frequency.setValueAtTime(200, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.4)
  osc.connect(oscGain)
  osc.start()
  osc.stop(ctx.currentTime + 0.5)
}

// A triumphant ascending run when a wave is cleared.
export function playWaveClear() {
  if (!ctx || !masterGain) return
  const notes = [392, 523.25, 659.25, 783.99, 1046.5] // G4, C5, E5, G5, C6
  notes.forEach((freq, i) => {
    const osc = ctx!.createOscillator()
    osc.type = 'triangle'
    const start = ctx!.currentTime + i * 0.07
    const gain = ctx!.createGain()
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.2, start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25)
    osc.frequency.value = freq
    osc.connect(gain)
    gain.connect(masterGain!)
    osc.start(start)
    osc.stop(start + 0.27)
  })
}

export function playGameOver() {
  if (!ctx || !masterGain) return
  const notes = [392, 311.13, 233.08] // G4, Eb4, Bb3 -- a somber descending phrase
  notes.forEach((freq, i) => {
    const osc = ctx!.createOscillator()
    osc.type = 'square'
    const start = ctx!.currentTime + i * 0.2
    const gain = ctx!.createGain()
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.2, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35)
    osc.frequency.value = freq
    osc.connect(gain)
    gain.connect(masterGain!)
    osc.start(start)
    osc.stop(start + 0.38)
  })
}
