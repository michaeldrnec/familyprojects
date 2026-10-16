// Enemy projectiles: plasma bolts from the formation, and the erratic
// explosive shards a Heavy Grunt drops when its power supply ruptures.
import { BOLT_DAMAGE, BOLT_SPEED, FRAGMENT_COUNT, FRAGMENT_DAMAGE, FRAGMENT_SPEED } from './constants'
import type { Rng } from '../../shared/rng'

export interface EnemyShot {
  kind: 'bolt' | 'fragment'
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  // Fragments wobble side to side around a drifting center line.
  baseX: number
  wobbleAmp: number
  wobbleFreq: number
  wobblePhase: number
  age: number
}

export function makeBolt(x: number, y: number, angle: number): EnemyShot {
  const vx = Math.sin(angle) * BOLT_SPEED
  return { kind: 'bolt', x, y, vx, vy: Math.cos(angle) * BOLT_SPEED, damage: BOLT_DAMAGE, baseX: x, wobbleAmp: 0, wobbleFreq: 0, wobblePhase: 0, age: 0 }
}

export function makeFragments(rng: Rng, x: number, y: number): EnemyShot[] {
  const out: EnemyShot[] = []
  for (let i = 0; i < FRAGMENT_COUNT; i++) {
    out.push({
      kind: 'fragment',
      x,
      y,
      vx: (i - 1) * rng.range(30, 70),
      vy: FRAGMENT_SPEED * rng.range(0.85, 1.1),
      damage: FRAGMENT_DAMAGE,
      baseX: x,
      wobbleAmp: rng.range(14, 30),
      wobbleFreq: rng.range(5, 9),
      wobblePhase: rng.range(0, Math.PI * 2),
      age: 0,
    })
  }
  return out
}

export function moveEnemyShot(s: EnemyShot, dt: number) {
  s.age += dt
  s.y += s.vy * dt
  s.baseX += s.vx * dt
  s.x = s.kind === 'fragment' ? s.baseX + Math.sin(s.age * s.wobbleFreq + s.wobblePhase) * s.wobbleAmp : s.baseX
}
