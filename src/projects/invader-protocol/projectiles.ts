// Projectile movement and every collision rule: swept player shots against
// invaders (pierce, Drone armor, Grunt barriers, Siege splash) and the UFO;
// enemy shots against bunker cells, vent beams, and the cannon.
import {
  BONUS_LIFE_EVERY,
  DRONE_ARMOR_MULT,
  INVADER_HALF_H,
  INVADER_HALF_W,
  PLAYER_HALF_H,
  PLAYER_HALF_W,
  PLAYER_Y,
  SIEGE_CEILING_Y,
  SIEGE_SPLASH_DAMAGE,
  SIEGE_SPLASH_RADIUS,
  UFO_HALF_H,
  UFO_HALF_W,
  UFO_RESTORE,
  VIEW_H,
  WEAPONS,
} from './constants'
import { cellAt, damageCell, mostDamaged, restore } from './bunkers'
import { hasBarrier, invaderX, invaderY, type Invader } from './grid'
import { isVulnerable, killPlayer } from './player'
import { moveEnemyShot } from './fragments'
import { nextUfoDelay, ufoReward } from './ufo'
import { burst, floater, ring, shake } from './effects'
import type { PlayerShot } from './weapons'
import type { GameState } from './game'
import * as audio from './audio'

const SHOT_RADIUS = 5

// Liang-Barsky: the fraction along the segment (x0,y0)->(x1,y1) where it
// first enters the box centered at (cx,cy), or null if it misses.
function segmentHitsBox(x0: number, y0: number, x1: number, y1: number, cx: number, cy: number, hw: number, hh: number): number | null {
  const dx = x1 - x0
  const dy = y1 - y0
  let t0 = 0
  let t1 = 1
  const p = [-dx, dx, -dy, dy]
  const q = [x0 - (cx - hw), cx + hw - x0, y0 - (cy - hh), cy + hh - y0]
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null
      continue
    }
    const r = q[i] / p[i]
    if (p[i] < 0) t0 = Math.max(t0, r)
    else t1 = Math.min(t1, r)
    if (t0 > t1) return null
  }
  return t0
}

export function addScore(gs: GameState, points: number) {
  gs.score += points
  while (gs.score >= gs.nextBonus) {
    gs.nextBonus += BONUS_LIFE_EVERY
    gs.player.lives++
    floater(gs.fx, gs.player.x, PLAYER_Y - 60, '+1 LIFE', '#4ade80', 30)
    audio.playExtraLife()
  }
}

export function damageInvader(gs: GameState, inv: Invader, amount: number, perfect: boolean) {
  if (!inv.alive) return
  inv.hp -= amount
  inv.flash = 0.08
  if (inv.hp <= 0) {
    inv.alive = false
    gs.kills.push({ inv, perfect })
  }
}

export function damageUfo(gs: GameState, amount: number) {
  const ufo = gs.ufo
  if (!ufo) return
  ufo.hp -= amount
  ufo.flash = 0.08
  if (ufo.hp > 0) return
  const reward = ufoReward(ufo.x, gs.player.x)
  addScore(gs, reward)
  floater(gs.fx, ufo.x, ufo.y + 40, `+${reward.toLocaleString()}`, '#fde047', 40)
  burst(gs.fx, gs.rng, ufo.x, ufo.y, ['#f0abfc', '#fde047', '#ffffff', '#e879f9'], 40, 500, 0.9)
  ring(gs.fx, ufo.x, ufo.y, 160, '#f0abfc', 0.6, 6)
  shake(gs.fx, 0.3, 10)
  const target = mostDamaged(gs.bunkers)
  if (target) {
    restore(target, UFO_RESTORE)
    floater(gs.fx, target.x, target.y - 90, 'SHIELD RESTORED', '#67e8f9', 24)
    ring(gs.fx, target.x, target.y, 140, '#67e8f9', 0.7, 5)
  }
  audio.stopUfoHum()
  audio.playUfoDown()
  gs.ufo = null
  gs.ufoTimer = nextUfoDelay(gs.rng)
}

export function hitPlayer(gs: GameState) {
  const p = gs.player
  if (!isVulnerable(p)) return
  burst(gs.fx, gs.rng, p.x, PLAYER_Y, ['#67e8f9', '#ffffff', '#e879f9', '#fbbf24'], 50, 600, 1.0)
  ring(gs.fx, p.x, PLAYER_Y, 180, '#f87171', 0.6, 6)
  shake(gs.fx, 0.45, 16)
  gs.fx.damage = 0.5
  audio.playPlayerDeath()
  if (killPlayer(p)) gs.over = 'destroyed'
}

function detonate(gs: GameState, x: number, y: number, direct: Invader | null, shot: PlayerShot) {
  if (direct) damageInvader(gs, direct, shot.damage, shot.perfect)
  for (const inv of gs.grid.invaders) {
    if (!inv.alive) continue
    const dx = invaderX(gs.grid, inv) - x
    const dy = invaderY(gs.grid, inv) - y
    const d = Math.max(0, Math.hypot(dx, dy) - INVADER_HALF_W * 0.6)
    if (d > SIEGE_SPLASH_RADIUS) continue
    damageInvader(gs, inv, SIEGE_SPLASH_DAMAGE * (1 - 0.5 * (d / SIEGE_SPLASH_RADIUS)), shot.perfect)
  }
  if (gs.ufo && Math.hypot(gs.ufo.x - x, gs.ufo.y - y) <= SIEGE_SPLASH_RADIUS + UFO_HALF_W * 0.5) damageUfo(gs, SIEGE_SPLASH_DAMAGE)
  ring(gs.fx, x, y, SIEGE_SPLASH_RADIUS, '#fb923c', 0.35, 5)
  burst(gs.fx, gs.rng, x, y, ['#fb923c', '#fde047', '#f87171'], 22, 380, 0.5)
  shake(gs.fx, 0.15, 6)
  audio.playExplosion('small')
}

// A Grunt's barrier stops vertical, non-piercing shots: the Disruptor, the
// center Spread pellet, and a direct Siege hit (whose splash still lands).
function barrierBlocks(shot: PlayerShot): boolean {
  return shot.weapon !== 'needle' && Math.abs(shot.vx) < 1
}

function armorApplies(shot: PlayerShot): boolean {
  return shot.weapon === 'disruptor' || (shot.weapon === 'spread' && Math.abs(shot.vx) < 1)
}

export function stepPlayerShots(gs: GameState, dt: number) {
  const grid = gs.grid
  const keep: PlayerShot[] = []
  for (const shot of gs.shots) {
    const x0 = shot.x
    const y0 = shot.y
    shot.x += shot.vx * dt
    shot.y += shot.vy * dt
    shot.age += dt
    let alive = true

    // Earliest invader along this step's path.
    let best: Invader | null = null
    let bestT = Infinity
    for (const inv of grid.invaders) {
      if (!inv.alive || shot.hitIds.includes(inv.id)) continue
      const t = segmentHitsBox(x0, y0, shot.x, shot.y, invaderX(grid, inv), invaderY(grid, inv), INVADER_HALF_W + SHOT_RADIUS, INVADER_HALF_H + SHOT_RADIUS)
      if (t !== null && t < bestT) {
        bestT = t
        best = inv
      }
    }

    if (best) {
      const hx = x0 + (shot.x - x0) * bestT
      const hy = y0 + (shot.y - y0) * bestT
      if (best.type === 'grunt' && hasBarrier(grid, best.col) && barrierBlocks(shot)) {
        if (shot.weapon === 'siege') detonate(gs, hx, hy, null, shot)
        else {
          burst(gs.fx, gs.rng, hx, hy, ['#93c5fd', '#e0f2fe'], 6, 200, 0.25)
          audio.playDeflect()
        }
        gs.barrierBlocks++
        alive = false
      } else if (shot.weapon === 'siege') {
        detonate(gs, hx, hy, best, shot)
        alive = false
      } else {
        const armored = best.type === 'drone' && armorApplies(shot)
        damageInvader(gs, best, shot.damage * (armored ? DRONE_ARMOR_MULT : 1), shot.perfect)
        burst(gs.fx, gs.rng, hx, hy, armored ? ['#94a3b8', '#e2e8f0'] : [WEAPONS[shot.weapon].color, '#ffffff'], 5, 180, 0.25)
        if (best.alive) audio.playHit()
        shot.hitIds.push(best.id)
        shot.pierceLeft--
        if (shot.pierceLeft <= 0) alive = false
      }
    }

    if (alive && gs.ufo) {
      const t = segmentHitsBox(x0, y0, shot.x, shot.y, gs.ufo.x, gs.ufo.y, UFO_HALF_W + SHOT_RADIUS, UFO_HALF_H + SHOT_RADIUS)
      if (t !== null) {
        if (shot.weapon === 'siege') detonate(gs, gs.ufo.x, gs.ufo.y, null, shot)
        damageUfo(gs, shot.weapon === 'siege' ? WEAPONS.siege.damage : shot.damage)
        alive = false
      }
    }

    if (alive && shot.weapon === 'siege' && shot.y <= SIEGE_CEILING_Y) {
      detonate(gs, shot.x, SIEGE_CEILING_Y, null, shot)
      alive = false
    }
    if (alive && shot.y > -40 && shot.x > -40 && shot.x < 1960) keep.push(shot)
  }
  gs.shots = keep
}

export function stepEnemyShots(gs: GameState, dt: number) {
  const p = gs.player
  gs.enemyShots = gs.enemyShots.filter((s) => {
    moveEnemyShot(s, dt)
    if (s.y > VIEW_H + 20) return false
    for (const beam of gs.beams) {
      if (Math.abs(s.x - beam.x) <= beam.halfW && s.y < beam.baseY) {
        burst(gs.fx, gs.rng, s.x, s.y, ['#fef3c7', '#fde047'], 4, 150, 0.2)
        return false
      }
    }
    for (const b of gs.bunkers) {
      const cell = cellAt(b, s.x, s.y, 4)
      if (!cell) continue
      damageCell(b, cell, s.damage)
      burst(gs.fx, gs.rng, s.x, s.y, ['#fbbf24', '#67e8f9', '#ffffff'], s.kind === 'fragment' ? 10 : 6, 200, 0.3)
      if (cell.hp <= 0) burst(gs.fx, gs.rng, b.x + cell.dx, b.y + cell.dy, ['#38bdf8', '#93c5fd'], 8, 160, 0.4)
      audio.playCellHit()
      return false
    }
    if (isVulnerable(p) && Math.abs(s.x - p.x) < PLAYER_HALF_W && Math.abs(s.y - PLAYER_Y) < PLAYER_HALF_H + 6) {
      hitPlayer(gs)
      return false
    }
    return true
  })
}
