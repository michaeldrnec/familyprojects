// Synthesized SFX via the Web Audio API only -- no audio files to source or
// bundle, following gravity-well/audio.ts and starwarden/audio.ts exactly.
// The AudioContext is created lazily via init(), which must be called from
// a real user-gesture handler (the Start/Restart button) since browsers
// block autoplay of audio created outside a gesture.

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

function tone(freq: number, type: OscillatorType, peak: number, attack: number, release: number, sweepTo?: number) {
  if (!ctx || !masterGain) return
  const osc = ctx.createOscillator()
  osc.type = type
  const gain = envGain(ctx, masterGain, peak, attack, release)
  osc.frequency.setValueAtTime(freq, ctx.currentTime)
  if (sweepTo !== undefined) osc.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + attack + release)
  osc.connect(gain)
  osc.start()
  osc.stop(ctx.currentTime + attack + release + 0.05)
}

function chime(notes: number[], gap: number, type: OscillatorType, peak: number) {
  if (!ctx || !masterGain) return
  notes.forEach((freq, i) => {
    const osc = ctx!.createOscillator()
    osc.type = type
    const start = ctx!.currentTime + i * gap
    const gain = ctx!.createGain()
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(peak, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, start + gap * 1.4)
    osc.frequency.value = freq
    osc.connect(gain)
    gain.connect(masterGain!)
    osc.start(start)
    osc.stop(start + gap * 1.6)
  })
}

// --- Tower firing cues, one per weapon so the shop's arsenal reads
// distinctly even with several towers firing at once. ---

export function playFireCannon() {
  tone(680, 'square', 0.1, 0.004, 0.06, 320)
}

export function playFireLaser() {
  tone(1400, 'sawtooth', 0.09, 0.005, 0.1, 500)
}

export function playFireFlak() {
  if (!ctx || !masterGain) return
  const duration = 0.14
  const noise = ctx.createBufferSource()
  noise.buffer = makeNoiseBuffer(ctx, duration)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 900
  const gain = envGain(ctx, filter, 0.22, 0.005, duration)
  noise.connect(gain)
  gain.connect(filter)
  filter.connect(masterGain)
  noise.start()
  noise.stop(ctx.currentTime + duration)
}

export function playFireDisruptor() {
  tone(220, 'sine', 0.08, 0.01, 0.14, 340)
}

export function playFireRailgun() {
  if (!ctx || !masterGain) return
  tone(180, 'sawtooth', 0.28, 0.005, 0.22, 60)
}

// --- Explosions, scaled by cause. ---

export function playExplosion(scale: 'hit' | 'kill' | 'leak' = 'kill') {
  if (!ctx || !masterGain) return
  const duration = scale === 'hit' ? 0.1 : scale === 'leak' ? 0.5 : 0.3
  const noise = ctx.createBufferSource()
  noise.buffer = makeNoiseBuffer(ctx, duration)
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(scale === 'leak' ? 2000 : 1400, ctx.currentTime)
  filter.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + duration)
  const gain = envGain(ctx, filter, scale === 'hit' ? 0.12 : scale === 'leak' ? 0.5 : 0.32, 0.005, duration)
  noise.connect(gain)
  gain.connect(filter)
  filter.connect(masterGain)
  noise.start()
  noise.stop(ctx.currentTime + duration)
}

// --- Build/economy cues. ---

export function playPlace() {
  tone(500, 'triangle', 0.16, 0.005, 0.09, 700)
}

export function playUpgrade() {
  chime([523.25, 659.25, 783.99], 0.06, 'triangle', 0.16)
}

export function playSell() {
  tone(400, 'triangle', 0.14, 0.005, 0.12, 220)
}

export function playDenied() {
  tone(140, 'square', 0.12, 0.005, 0.12)
}

// --- Wave/run structure cues. ---

export function playWaveStart() {
  chime([440, 440], 0.14, 'square', 0.14)
}

export function playWaveClear() {
  chime([523.25, 659.25, 783.99, 1046.5], 0.09, 'triangle', 0.2)
}

export function playBossIncoming() {
  chime([220, 165, 220, 165], 0.16, 'sawtooth', 0.22)
}

export function playLeak() {
  tone(150, 'sawtooth', 0.24, 0.005, 0.18, 70)
}

export function playVictory() {
  chime([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.12, 'triangle', 0.24)
}

export function playGameOver() {
  chime([392, 329.63, 261.63, 196], 0.2, 'square', 0.22)
}
