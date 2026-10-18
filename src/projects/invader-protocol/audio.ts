// Web Audio for Invader Protocol, all synthesized (no audio files). The
// bassline is the game's clock made audible: onBeat() is called on every grid
// step and plays the next note of the descending B2 -> A#2 -> A2 -> G#2
// figure, layering more instruments as the formation thins out.
//
// The site-wide AudioContext (shared/audio.ts) is first used in init(), which
// callers must invoke from a real user-gesture handler -- browsers block
// autoplay otherwise.
import { createChannel, getAudioContext } from '../../shared/audio'
import type { WeaponId } from './constants'

const BASS_NOTES = [123.47, 116.54, 110, 103.83] // B2, A#2, A2, G#2

let ctx: AudioContext | null = null
let master: GainNode | null = null
let music: GainNode | null = null
let sfx: GainNode | null = null
let noiseBuffer: AudioBuffer | null = null
let distortion: WaveShaperNode | null = null
let lastNote = BASS_NOTES[0]
let ufoNodes: { osc: OscillatorNode; lfo: OscillatorNode; gain: GainNode } | null = null

export function init() {
  if (ctx) {
    getAudioContext() // resumes it if the browser suspended it
    return
  }
  const shared = getAudioContext()
  const out = createChannel(0.8)
  if (!shared || !out) return
  ctx = shared
  master = out
  music = ctx.createGain()
  music.gain.value = 0.9
  music.connect(master)
  sfx = ctx.createGain()
  sfx.gain.value = 0.7
  sfx.connect(master)

  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1

  // Soft-clipping curve for the tier-4 lead.
  distortion = ctx.createWaveShaper()
  const curve = new Float32Array(1024)
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1
    curve[i] = Math.tanh(x * 6)
  }
  distortion.curve = curve
  const leadGain = ctx.createGain()
  leadGain.gain.value = 0.5
  distortion.connect(leadGain)
  leadGain.connect(music)
}

// --- Building blocks ------------------------------------------------------

function tone(
  dest: AudioNode,
  type: OscillatorType,
  freq: number,
  start: number,
  peak: number,
  release: number,
  endFreq?: number,
  attack = 0.005,
) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + attack + release)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, start)
  g.gain.linearRampToValueAtTime(peak, start + attack)
  g.gain.exponentialRampToValueAtTime(0.0008, start + attack + release)
  osc.connect(g)
  g.connect(dest)
  osc.start(start)
  osc.stop(start + attack + release + 0.02)
}

function noise(
  dest: AudioNode,
  start: number,
  duration: number,
  peak: number,
  filterType: BiquadFilterType,
  freq: number,
  q = 1,
  endFreq?: number,
) {
  if (!ctx || !noiseBuffer) return
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer
  const f = ctx.createBiquadFilter()
  f.type = filterType
  f.frequency.setValueAtTime(freq, start)
  if (endFreq) f.frequency.exponentialRampToValueAtTime(endFreq, start + duration)
  f.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(peak, start)
  g.gain.exponentialRampToValueAtTime(0.0008, start + duration)
  src.connect(f)
  f.connect(g)
  g.connect(dest)
  src.start(start, Math.random() * 1.5)
  src.stop(start + duration + 0.02)
}

// --- The beat-locked score ------------------------------------------------

export function tierFor(n: number): 1 | 2 | 3 | 4 {
  if (n >= 45) return 1
  if (n >= 20) return 2
  if (n >= 6) return 3
  return 4
}

// One grid step. `period` is the current seconds-per-beat, used to space
// the sub-beat layers (off-beat hats, snare roll, arpeggio).
export function onBeat(beatIndex: number, n: number, period: number) {
  if (!ctx || !music || !distortion) return
  const t = ctx.currentTime + 0.005
  const tier = tierFor(n)
  const base = BASS_NOTES[beatIndex % 4] * (tier === 4 ? 2 : 1)
  lastNote = base

  // Sub-bass through a 300 Hz lowpass, always present.
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 300
  lp.connect(music)
  const bassLen = Math.min(0.7, period * 0.85)
  tone(lp, 'sawtooth', base, t, 0.32, bassLen, undefined, 0.01)
  tone(lp, 'sine', base / 2, t, 0.45, bassLen, undefined, 0.01)

  if (tier >= 2) {
    // 808-style kick on the beat, industrial clank and hat on the off-beat.
    tone(music, 'sine', 150, t, 0.7, 0.28, 42, 0.003)
    noise(music, t + period / 2, 0.05, 0.12, 'highpass', 7000)
    noise(music, t + period / 2, 0.09, 0.1, 'bandpass', 1800, 9)
  }
  if (tier >= 3) {
    // Snare roll on the sixteenths, building through the beat, plus an
    // arpeggiated square ostinato on the bass note's harmonics.
    const harmonics = [4, 5, 6, 8]
    for (let i = 0; i < 4; i++) {
      const st = t + (period / 4) * i
      noise(music, st, 0.06, 0.05 + 0.03 * i, 'bandpass', 1600, 1.2)
      tone(music, 'square', base * harmonics[i], st, 0.035, Math.min(0.12, period / 4), undefined, 0.003)
    }
  }
  if (tier === 4) {
    tone(distortion, 'sawtooth', base * 2, t, 0.25, period * 0.8, undefined, 0.01)
    tone(distortion, 'sawtooth', base * 3, t + period / 2, 0.18, period * 0.4, undefined, 0.01)
  }
}

// --- SFX ------------------------------------------------------------------

export function playShot(weapon: WeaponId) {
  if (!ctx || !sfx) return
  const t = ctx.currentTime
  if (weapon === 'disruptor') tone(sfx, 'square', 1000, t, 0.08, 0.08, 320)
  else if (weapon === 'needle') {
    tone(sfx, 'sawtooth', 2600, t, 0.1, 0.16, 500)
    noise(sfx, t, 0.12, 0.08, 'highpass', 4000)
  } else if (weapon === 'spread') {
    tone(sfx, 'triangle', 700, t, 0.12, 0.1, 260)
    tone(sfx, 'triangle', 900, t, 0.08, 0.1, 340)
  } else {
    tone(sfx, 'sine', 220, t, 0.4, 0.22, 55)
    noise(sfx, t, 0.15, 0.12, 'lowpass', 900)
  }
}

// On-beat fire: a chime tuned to the current bass note's harmonics.
export function playChime() {
  if (!ctx || !sfx) return
  const t = ctx.currentTime
  tone(sfx, 'triangle', lastNote * 8, t, 0.13, 0.35)
  tone(sfx, 'sine', lastNote * 12, t + 0.03, 0.08, 0.4)
}

export function playHit() {
  if (!ctx || !sfx) return
  tone(sfx, 'square', 420, ctx.currentTime, 0.05, 0.04, 260)
}

export function playDeflect() {
  if (!ctx || !sfx) return
  const t = ctx.currentTime
  tone(sfx, 'triangle', 2200, t, 0.08, 0.07, 1500)
}

export function playExplosion(size: 'small' | 'large' = 'small') {
  if (!ctx || !sfx) return
  const t = ctx.currentTime
  const d = size === 'large' ? 0.6 : 0.25
  noise(sfx, t, d, size === 'large' ? 0.5 : 0.25, 'lowpass', size === 'large' ? 2000 : 1400, 1, 100)
  if (size === 'large') tone(sfx, 'sine', 120, t, 0.4, 0.5, 35)
}

// Column snap: a low metallic strike with a sharp high-passed transient.
export function playSnap() {
  if (!ctx || !sfx) return
  const t = ctx.currentTime
  noise(sfx, t, 0.08, 0.5, 'highpass', 3000)
  tone(sfx, 'triangle', 196, t, 0.3, 0.8)
  tone(sfx, 'triangle', 196 * 2.76, t, 0.18, 0.6)
  tone(sfx, 'triangle', 196 * 5.4, t, 0.1, 0.4)
  tone(sfx, 'sine', 70, t, 0.6, 0.5, 40)
}

// Vent: a white-noise swell crossfading into a sustained resonant hum.
export function playVent(duration: number) {
  if (!ctx || !sfx || !noiseBuffer) return
  const t = ctx.currentTime
  const swell = 0.35
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer
  const nf = ctx.createBiquadFilter()
  nf.type = 'bandpass'
  nf.frequency.setValueAtTime(400, t)
  nf.frequency.exponentialRampToValueAtTime(5000, t + swell)
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(0.0008, t)
  ng.gain.exponentialRampToValueAtTime(0.4, t + swell)
  ng.gain.exponentialRampToValueAtTime(0.0008, t + swell + 0.4)
  src.connect(nf)
  nf.connect(ng)
  ng.connect(sfx)
  src.start(t)
  src.stop(t + swell + 0.45)

  const hum = ctx.createOscillator()
  hum.type = 'sawtooth'
  hum.frequency.value = 110
  const hf = ctx.createBiquadFilter()
  hf.type = 'bandpass'
  hf.frequency.value = 440
  hf.Q.value = 12
  const hg = ctx.createGain()
  hg.gain.setValueAtTime(0.0008, t)
  hg.gain.exponentialRampToValueAtTime(0.5, t + swell)
  hg.gain.setValueAtTime(0.5, t + duration - 0.2)
  hg.gain.exponentialRampToValueAtTime(0.0008, t + duration)
  hum.connect(hf)
  hf.connect(hg)
  hg.connect(sfx)
  hum.start(t)
  hum.stop(t + duration + 0.05)
}

export function playOverheat() {
  if (!ctx || !sfx) return
  const t = ctx.currentTime
  noise(sfx, t, 0.7, 0.25, 'highpass', 2500)
  tone(sfx, 'square', 300, t, 0.08, 0.3, 120)
}

export function playCooled() {
  if (!ctx || !sfx) return
  tone(sfx, 'triangle', 660, ctx.currentTime, 0.08, 0.08)
}

export function playDash() {
  if (!ctx || !sfx) return
  noise(sfx, ctx.currentTime, 0.18, 0.18, 'bandpass', 600, 2, 3000)
}

export function playSwitch() {
  if (!ctx || !sfx) return
  tone(sfx, 'square', 1500, ctx.currentTime, 0.04, 0.03)
}

export function playCellHit() {
  if (!ctx || !sfx) return
  tone(sfx, 'sine', 900, ctx.currentTime, 0.05, 0.08, 600)
}

export function playPlayerDeath() {
  if (!ctx || !sfx) return
  const t = ctx.currentTime
  playExplosion('large')
  tone(sfx, 'sawtooth', 500, t, 0.2, 0.8, 50)
}

export function playMarkerArm() {
  if (!ctx || !sfx) return
  const t = ctx.currentTime
  tone(sfx, 'square', 1200, t, 0.05, 0.05)
  tone(sfx, 'square', 1200, t + 0.12, 0.05, 0.05)
}

export function playMarkerBeam() {
  if (!ctx || !sfx) return
  const t = ctx.currentTime
  tone(sfx, 'sawtooth', 90, t, 0.25, 0.45, 60)
  noise(sfx, t, 0.45, 0.15, 'bandpass', 2000, 3)
}

export function playUfoDown() {
  if (!ctx || !sfx) return
  const t = ctx.currentTime
  playExplosion('large')
  ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(sfx!, 'triangle', f, t + 0.1 + i * 0.07, 0.15, 0.2))
}

export function startUfoHum() {
  if (!ctx || !sfx || ufoNodes) return
  const osc = ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.value = 520
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 7
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 140
  lfo.connect(lfoGain)
  lfoGain.connect(osc.frequency)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 0.3)
  osc.connect(gain)
  gain.connect(sfx)
  osc.start()
  lfo.start()
  ufoNodes = { osc, lfo, gain }
}

export function stopUfoHum() {
  if (!ctx || !ufoNodes) return
  const { osc, lfo, gain } = ufoNodes
  gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05)
  osc.stop(ctx.currentTime + 0.3)
  lfo.stop(ctx.currentTime + 0.3)
  ufoNodes = null
}

export function playWaveClear() {
  if (!ctx || !sfx) return
  const t = ctx.currentTime
  ;[392, 493.88, 587.33, 783.99].forEach((f, i) => tone(sfx!, 'square', f, t + i * 0.09, 0.1, 0.18))
}

export function playExtraLife() {
  if (!ctx || !sfx) return
  const t = ctx.currentTime
  ;[659.25, 880, 1318.5].forEach((f, i) => tone(sfx!, 'triangle', f, t + i * 0.08, 0.15, 0.2))
}

export function playGameOver() {
  if (!ctx || !sfx) return
  const t = ctx.currentTime
  ;[246.94, 233.08, 220, 207.65].forEach((f, i) => tone(sfx!, 'square', f, t + i * 0.22, 0.14, 0.35))
}

// --- The Conductor (boss) -------------------------------------------------

// A two-tone klaxon as the boss descends.
export function playBossWarning() {
  if (!ctx || !sfx) return
  const t = ctx.currentTime
  for (let i = 0; i < 3; i++) {
    tone(sfx, 'sawtooth', 440, t + i * 0.5, 0.12, 0.22, undefined, 0.02)
    tone(sfx, 'sawtooth', 330, t + i * 0.5 + 0.25, 0.12, 0.22, undefined, 0.02)
  }
}

// The boss's volleys: a heavy, low zap so they read apart from the formation's.
export function playBossFire() {
  if (!ctx || !sfx) return
  const t = ctx.currentTime
  tone(sfx, 'square', 260, t, 0.07, 0.12, 90)
}

export function playOverdrive() {
  if (!ctx || !sfx) return
  const t = ctx.currentTime
  tone(sfx, 'sawtooth', 110, t, 0.25, 0.9, 440, 0.05)
  noise(sfx, t, 0.6, 0.18, 'bandpass', 800, 3, 4000)
}

export function playBossDown() {
  if (!ctx || !sfx) return
  const t = ctx.currentTime
  playExplosion('large')
  tone(sfx, 'sawtooth', 300, t, 0.2, 1.4, 40)
  ;[392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(sfx!, 'triangle', f, t + 1.4 + i * 0.09, 0.14, 0.3))
}
