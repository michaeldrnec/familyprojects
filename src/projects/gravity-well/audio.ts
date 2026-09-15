// Retro-flavored sound effects for Gravity Well, synthesized with the Web
// Audio API (same approach as starwarden/audio.ts) -- no audio files to
// source or bundle. A launch whoosh, an impact boom on crash, a triumphant
// arpeggio on landing, and a soft UI blip for buttons.
//
// The AudioContext is created lazily via init(), which callers must invoke
// from a real user-gesture handler (launch() only ever runs as a direct
// result of a pointerup or button click, so that's the natural place).

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let muted = false

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

function envGain(context: AudioContext, destination: AudioNode, peak: number, attack: number, release: number) {
  const gain = context.createGain()
  gain.gain.setValueAtTime(0, context.currentTime)
  gain.gain.linearRampToValueAtTime(peak, context.currentTime + attack)
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + attack + release)
  gain.connect(destination)
  return gain
}

// A layered rocket launch: a percussive ignition crackle, a sustained
// tremolo-roughened engine rumble with a sub-bass thrust layer underneath,
// and a rising whoosh sweep riding on top as it pulls away -- reads as an
// actual engine igniting and climbing, not just a single quick zap.
export function playLaunch() {
  if (!ctx || !masterGain) return
  const now = ctx.currentTime
  const rumbleDuration = 1.0

  // Ignition crackle: a brief, bright noise pop right at t=0.
  const crackle = ctx.createBufferSource()
  crackle.buffer = makeNoiseBuffer(ctx, 0.18)
  const crackleFilter = ctx.createBiquadFilter()
  crackleFilter.type = 'highpass'
  crackleFilter.frequency.setValueAtTime(600, now)
  const crackleGain = envGain(ctx, masterGain, 0.35, 0.002, 0.16)
  crackle.connect(crackleFilter)
  crackleFilter.connect(crackleGain)
  crackle.start(now)
  crackle.stop(now + 0.18)

  // Engine rumble: lowpass-filtered noise, its gain modulated by a slow LFO
  // so it roughens like a real engine roar instead of a flat hiss. The
  // filter itself opens up gradually as the "engine" spools up.
  const rumble = ctx.createBufferSource()
  rumble.buffer = makeNoiseBuffer(ctx, rumbleDuration)
  rumble.loop = true
  const rumbleFilter = ctx.createBiquadFilter()
  rumbleFilter.type = 'lowpass'
  rumbleFilter.frequency.setValueAtTime(220, now)
  rumbleFilter.frequency.linearRampToValueAtTime(650, now + rumbleDuration)
  const rumbleGain = ctx.createGain()
  rumbleGain.gain.setValueAtTime(0, now)
  rumbleGain.gain.linearRampToValueAtTime(0.32, now + 0.05)
  rumbleGain.gain.setValueAtTime(0.32, now + rumbleDuration * 0.6)
  rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + rumbleDuration)

  const tremolo = ctx.createOscillator()
  tremolo.type = 'sine'
  tremolo.frequency.value = 17
  const tremoloDepth = ctx.createGain()
  tremoloDepth.gain.value = 0.18
  tremolo.connect(tremoloDepth)
  tremoloDepth.connect(rumbleGain.gain)

  rumble.connect(rumbleFilter)
  rumbleFilter.connect(rumbleGain)
  rumbleGain.connect(masterGain)
  rumble.start(now)
  rumble.stop(now + rumbleDuration)
  tremolo.start(now)
  tremolo.stop(now + rumbleDuration)

  // Sub-bass thrust layer: gives the launch some low-end weight/power,
  // climbing slightly as the "engine" builds up.
  const sub = ctx.createOscillator()
  sub.type = 'sawtooth'
  const subGain = ctx.createGain()
  subGain.gain.setValueAtTime(0, now)
  subGain.gain.linearRampToValueAtTime(0.22, now + 0.06)
  subGain.gain.setValueAtTime(0.22, now + rumbleDuration * 0.6)
  subGain.gain.exponentialRampToValueAtTime(0.001, now + rumbleDuration)
  sub.frequency.setValueAtTime(55, now)
  sub.frequency.linearRampToValueAtTime(95, now + rumbleDuration)
  sub.connect(subGain)
  subGain.connect(masterGain)
  sub.start(now)
  sub.stop(now + rumbleDuration)

  // Liftoff whoosh: a rising pitch sweep riding on top, starting a beat
  // after ignition, for the "pulling away" sensation.
  const whooshStart = now + 0.08
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  const oscGain = ctx.createGain()
  oscGain.gain.setValueAtTime(0, whooshStart)
  oscGain.gain.linearRampToValueAtTime(0.2, whooshStart + 0.05)
  oscGain.gain.exponentialRampToValueAtTime(0.001, whooshStart + 0.55)
  osc.frequency.setValueAtTime(140, whooshStart)
  osc.frequency.exponentialRampToValueAtTime(520, whooshStart + 0.55)
  osc.connect(oscGain)
  oscGain.connect(masterGain)
  osc.start(whooshStart)
  osc.stop(whooshStart + 0.6)
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
