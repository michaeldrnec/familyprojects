// Retro arcade sound effects, synthesized entirely with the Web Audio API
// -- no audio files to source or bundle. Everything is built from
// oscillators (laser zaps, chimes) and filtered noise bursts (explosions,
// the continuous thruster hum), each with a short gain envelope for that
// classic 8-bit "bleep/bloop" character.
//
// The AudioContext is created lazily via init(), which callers must invoke
// from a real user-gesture handler (e.g. the Launch button's onClick) --
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
  // node whose value is ramped up/down rather than starting/stopping the
  // source every time thrust is toggled (which would click/pop).
  const noise = ctx.createBufferSource()
  noise.buffer = makeNoiseBuffer(ctx, 2)
  noise.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 220
  filter.Q.value = 0.7
  thrusterGain = ctx.createGain()
  thrusterGain.gain.value = 0
  noise.connect(filter)
  filter.connect(thrusterGain)
  thrusterGain.connect(masterGain)
  noise.start()
}

export function setMuted(next: boolean) {
  muted = next
  if (masterGain && ctx) {
    masterGain.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05)
  }
}

export function isMuted() {
  return muted
}

export function setThrusterOn(on: boolean) {
  if (!ctx || !thrusterGain) return
  thrusterGain.gain.setTargetAtTime(on ? 0.11 : 0, ctx.currentTime, 0.08)
}

function envGain(context: AudioContext, destination: AudioNode, peak: number, attack: number, release: number) {
  const gain = context.createGain()
  gain.gain.setValueAtTime(0, context.currentTime)
  gain.gain.linearRampToValueAtTime(peak, context.currentTime + attack)
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + attack + release)
  gain.connect(destination)
  return gain
}

export function playLaser() {
  if (!ctx || !masterGain) return
  const osc = ctx.createOscillator()
  osc.type = 'square'
  const gain = envGain(ctx, masterGain, 0.16, 0.005, 0.11)
  osc.frequency.setValueAtTime(900, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.11)
  osc.connect(gain)
  osc.start()
  osc.stop(ctx.currentTime + 0.13)
}

export function playExplosion(size: 'small' | 'large' = 'small') {
  if (!ctx || !masterGain) return
  const duration = size === 'large' ? 0.55 : 0.28
  const noise = ctx.createBufferSource()
  noise.buffer = makeNoiseBuffer(ctx, duration)
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(size === 'large' ? 1800 : 1200, ctx.currentTime)
  filter.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + duration)
  const gain = envGain(ctx, filter, size === 'large' ? 0.55 : 0.32, 0.01, duration)
  noise.connect(gain)
  gain.connect(filter)
  filter.connect(masterGain)
  noise.start()
  noise.stop(ctx.currentTime + duration)
}

export function playPowerup() {
  if (!ctx || !masterGain) return
  const notes = [523.25, 783.99] // C5, G5 -- a short upward chime
  notes.forEach((freq, i) => {
    const osc = ctx!.createOscillator()
    osc.type = 'triangle'
    const start = ctx!.currentTime + i * 0.07
    const gain = ctx!.createGain()
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.2, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16)
    osc.frequency.value = freq
    osc.connect(gain)
    gain.connect(masterGain!)
    osc.start(start)
    osc.stop(start + 0.18)
  })
}

export function playHit() {
  if (!ctx || !masterGain) return
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  const gain = envGain(ctx, masterGain, 0.3, 0.005, 0.18)
  osc.frequency.setValueAtTime(160, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.18)
  osc.connect(gain)
  osc.start()
  osc.stop(ctx.currentTime + 0.2)
}

export function playShieldUp() {
  if (!ctx || !masterGain) return
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  const gain = envGain(ctx, masterGain, 0.22, 0.01, 0.22)
  osc.frequency.setValueAtTime(320, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2)
  osc.connect(gain)
  osc.start()
  osc.stop(ctx.currentTime + 0.24)
}

export function playGameOver() {
  if (!ctx || !masterGain) return
  const notes = [440, 349.23, 261.63] // A4, F4, C4 -- a short descending phrase
  notes.forEach((freq, i) => {
    const osc = ctx!.createOscillator()
    osc.type = 'square'
    const start = ctx!.currentTime + i * 0.16
    const gain = ctx!.createGain()
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.22, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3)
    osc.frequency.value = freq
    osc.connect(gain)
    gain.connect(masterGain!)
    osc.start(start)
    osc.stop(start + 0.32)
  })
}

// The Nova Bomb: a big, dramatic layered blast -- a noise boom underneath a
// rising oscillator sweep, distinctly bigger than a regular explosion so
// triggering the bonus weapon always reads as a special event.
export function playNova() {
  if (!ctx || !masterGain) return
  const duration = 0.8
  const noise = ctx.createBufferSource()
  noise.buffer = makeNoiseBuffer(ctx, duration)
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(2400, ctx.currentTime)
  filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + duration)
  const noiseGain = envGain(ctx, filter, 0.6, 0.01, duration)
  noise.connect(noiseGain)
  noiseGain.connect(filter)
  filter.connect(masterGain)
  noise.start()
  noise.stop(ctx.currentTime + duration)

  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  const oscGain = envGain(ctx, masterGain, 0.3, 0.02, 0.5)
  osc.frequency.setValueAtTime(80, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.4)
  osc.connect(oscGain)
  osc.start()
  osc.stop(ctx.currentTime + 0.55)
}

// A short two-tone klaxon announcing an escalation -- distinct from every
// other cue so it reads as a warning, not a reward.
export function playEscalation() {
  if (!ctx || !masterGain) return
  const pattern = [660, 440, 660, 440]
  pattern.forEach((freq, i) => {
    const osc = ctx!.createOscillator()
    osc.type = 'square'
    const start = ctx!.currentTime + i * 0.12
    const gain = ctx!.createGain()
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.18, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1)
    osc.frequency.value = freq
    osc.connect(gain)
    gain.connect(masterGain!)
    osc.start(start)
    osc.stop(start + 0.12)
  })
}

// A bright ascending sparkle for when the shield finishes its 60s clean-
// streak regeneration -- distinct from playShieldUp's proximity-triggered
// activation sweep.
export function playShieldRegen() {
  if (!ctx || !masterGain) return
  const notes = [392, 523.25, 659.25, 783.99] // G4, C5, E5, G5
  notes.forEach((freq, i) => {
    const osc = ctx!.createOscillator()
    osc.type = 'triangle'
    const start = ctx!.currentTime + i * 0.06
    const gain = ctx!.createGain()
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.18, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2)
    osc.frequency.value = freq
    osc.connect(gain)
    gain.connect(masterGain!)
    osc.start(start)
    osc.stop(start + 0.22)
  })
}

