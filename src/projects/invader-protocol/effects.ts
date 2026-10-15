// Purely visual feedback: particle bursts, shockwave rings, score floaters,
// screen shake, and flashes. Nothing here affects gameplay.
import type { Rng } from './rng'

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  size: number
  color: string
}

export interface Ring {
  x: number
  y: number
  age: number
  life: number
  maxR: number
  color: string
  width: number
}

export interface Floater {
  x: number
  y: number
  text: string
  color: string
  age: number
  size: number
}

export interface Effects {
  particles: Particle[]
  rings: Ring[]
  floaters: Floater[]
  shake: number // seconds left
  shakeMag: number
  flash: number // full-screen white flash, seconds left
  flashColor: string
  damage: number // red vignette, seconds left
}

export const FLOATER_LIFE = 1.0
export const FLASH_LIFE = 0.25
export const DAMAGE_LIFE = 0.5

export function newEffects(): Effects {
  return { particles: [], rings: [], floaters: [], shake: 0, shakeMag: 0, flash: 0, flashColor: '255,255,255', damage: 0 }
}

export function burst(fx: Effects, rng: Rng, x: number, y: number, colors: string[], count: number, speed: number, life = 0.6) {
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, Math.PI * 2)
    const s = rng.range(speed * 0.25, speed)
    fx.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      age: 0,
      life: rng.range(life * 0.6, life),
      size: rng.range(2, 5),
      color: colors[Math.floor(rng.next() * colors.length)],
    })
  }
}

export function ring(fx: Effects, x: number, y: number, maxR: number, color: string, life = 0.5, width = 4) {
  fx.rings.push({ x, y, age: 0, life, maxR, color, width })
}

export function floater(fx: Effects, x: number, y: number, text: string, color: string, size = 26) {
  fx.floaters.push({ x, y, text, color, age: 0, size })
}

export function shake(fx: Effects, seconds: number, magnitude: number) {
  fx.shake = Math.max(fx.shake, seconds)
  fx.shakeMag = Math.max(fx.shakeMag, magnitude)
}

export function flash(fx: Effects, color = '255,255,255') {
  fx.flash = FLASH_LIFE
  fx.flashColor = color
}

export function updateEffects(fx: Effects, dt: number) {
  fx.particles = fx.particles.filter((p) => {
    p.age += dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vx *= 1 - 2 * dt
    p.vy *= 1 - 2 * dt
    return p.age < p.life
  })
  fx.rings = fx.rings.filter((r) => (r.age += dt) < r.life)
  fx.floaters = fx.floaters.filter((f) => (f.age += dt) < FLOATER_LIFE)
  fx.shake = Math.max(0, fx.shake - dt)
  if (fx.shake === 0) fx.shakeMag = 0
  fx.flash = Math.max(0, fx.flash - dt)
  fx.damage = Math.max(0, fx.damage - dt)
}
