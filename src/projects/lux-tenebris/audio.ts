// Synthesized sound, following starwarden/audio.ts: a lazily created
// AudioContext (init() must run from a user gesture), a master gain for
// mute, oscillators and filtered noise bursts. Sound is part of the puzzle
// here -- footsteps change with terrain, so you can tell plank from water
// from stone in the dark.

let ctx: AudioContext | null = null
let master: GainNode | null = null
let humGain: GainNode | null = null
let humOsc: OscillatorNode | null = null
let muted = false

function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return b
}

export function init() {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume()
    return
  }
  ctx = new AudioContext()
  master = ctx.createGain()
  master.gain.value = muted ? 0 : 1
  master.connect(ctx.destination)

  // The flashlight filament: a quiet buzzing tone whose level is set by
  // setHum() -- it grows louder and rougher as the battery dies.
  humOsc = ctx.createOscillator()
  humOsc.type = 'sawtooth'
  humOsc.frequency.value = 120
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 500
  humGain = ctx.createGain()
  humGain.gain.value = 0
  humOsc.connect(filter)
  filter.connect(humGain)
  humGain.connect(master)
  humOsc.start()
}

export function isMuted() {
  return muted
}

export function setMuted(next: boolean) {
  muted = next
  if (ctx && master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05)
}

// on: whether the beam is lit at all; batteryFrac: charge left (1 = full).
export function setHum(on: boolean, batteryFrac: number) {
  if (!ctx || !humGain || !humOsc) return
  const weak = 1 - batteryFrac
  humGain.gain.setTargetAtTime(on ? 0.006 + 0.03 * weak * weak : 0, ctx.currentTime, 0.1)
  humOsc.frequency.setTargetAtTime(120 + Math.random() * 25 * weak, ctx.currentTime, 0.05)
}

function env(peak: number, attack: number, release: number, start = 0): GainNode {
  const g = ctx!.createGain()
  const t = ctx!.currentTime + start
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.001, t + attack + release)
  g.connect(master!)
  return g
}

function noise(duration: number, type: BiquadFilterType, freq: number, peak: number, q = 1, start = 0) {
  if (!ctx || !master) return
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx, duration)
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  src.connect(f)
  f.connect(env(peak, 0.004, duration, start))
  src.start(ctx.currentTime + start)
  src.stop(ctx.currentTime + start + duration + 0.05)
}

function tone(type: OscillatorType, from: number, to: number, duration: number, peak: number, start = 0) {
  if (!ctx || !master) return
  const o = ctx.createOscillator()
  o.type = type
  const t = ctx.currentTime + start
  o.frequency.setValueAtTime(from, t)
  o.frequency.exponentialRampToValueAtTime(to, t + duration)
  o.connect(env(peak, 0.005, duration, start))
  o.start(t)
  o.stop(t + duration + 0.05)
}

// Footsteps: a dull tap on stone, a hollow knock on planks, a splash in water.
export function footstep(kind: 'stone' | 'plank' | 'water') {
  if (kind === 'stone') noise(0.07, 'lowpass', 700, 0.25)
  else if (kind === 'plank') {
    tone('triangle', 190, 120, 0.12, 0.25)
    noise(0.05, 'bandpass', 900, 0.12, 3)
  } else noise(0.22, 'bandpass', 1800, 0.22, 0.8)
}

export function bump() {
  tone('sine', 90, 55, 0.12, 0.3)
}

export function echo() {
  tone('sine', 1500, 700, 0.5, 0.18)
  tone('sine', 1500, 700, 0.5, 0.07, 0.22)
  tone('sine', 1500, 700, 0.5, 0.03, 0.44)
}

export function cell() {
  tone('triangle', 520, 1040, 0.18, 0.2)
  tone('triangle', 780, 1560, 0.2, 0.15, 0.08)
}

export function key() {
  ;[988, 1319, 1568].forEach((f, i) => tone('triangle', f, f, 0.15, 0.15, i * 0.06))
}

export function toggle() {
  noise(0.35, 'lowpass', 300, 0.35)
  tone('square', 70, 55, 0.3, 0.06)
}

export function fall() {
  tone('sine', 600, 60, 0.9, 0.25)
  noise(0.9, 'lowpass', 400, 0.15)
}

export function timeout() {
  tone('sawtooth', 220, 110, 0.6, 0.12)
}

export function win() {
  ;[523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.5, 0.15, i * 0.09))
}

export function heartbeat() {
  tone('sine', 70, 45, 0.12, 0.45)
  tone('sine', 65, 42, 0.12, 0.3, 0.16)
}
