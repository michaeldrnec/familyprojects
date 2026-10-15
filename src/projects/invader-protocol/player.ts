// The cannon on the baseline: accelerating horizontal movement, the
// micro-dash (a short lunge with i-frames), lives, and respawn.
import {
  DASH_COOLDOWN,
  DASH_DISTANCE,
  DASH_TIME,
  PLAYER_ACCEL,
  PLAYER_FRICTION,
  PLAYER_MAX_SPEED,
  PLAYER_MAX_X,
  PLAYER_MIN_X,
  RESPAWN_DELAY,
  RESPAWN_INVULN,
  START_LIVES,
  VIEW_W,
} from './constants'

export interface Player {
  x: number
  vx: number
  facing: 1 | -1 // last move direction, used for a dash with no direction held
  dashT: number // > 0 while dashing
  dashDir: 1 | -1
  dashCooldown: number
  lives: number
  respawn: number // > 0 while the cannon is destroyed and waiting to respawn
  invuln: number
}

export function newPlayer(): Player {
  return { x: VIEW_W / 2, vx: 0, facing: 1, dashT: 0, dashDir: 1, dashCooldown: 0, lives: START_LIVES, respawn: 0, invuln: 0 }
}

export function isAlive(p: Player): boolean {
  return p.respawn <= 0
}

export function isVulnerable(p: Player): boolean {
  return isAlive(p) && p.invuln <= 0 && p.dashT <= 0
}

// Returns true if a dash started this step (for its sound/effect).
export function updatePlayer(p: Player, move: number, dash: boolean, dt: number): boolean {
  p.dashCooldown = Math.max(0, p.dashCooldown - dt)
  p.invuln = Math.max(0, p.invuln - dt)
  if (p.respawn > 0) {
    p.respawn -= dt
    if (p.respawn <= 0) {
      p.respawn = 0
      p.x = VIEW_W / 2
      p.vx = 0
      p.invuln = RESPAWN_INVULN
    }
    return false
  }

  if (move !== 0) p.facing = move > 0 ? 1 : -1
  let dashed = false
  if (dash && p.dashCooldown <= 0 && p.dashT <= 0) {
    p.dashT = DASH_TIME
    p.dashDir = move !== 0 ? (move > 0 ? 1 : -1) : p.facing
    p.dashCooldown = DASH_COOLDOWN
    dashed = true
  }

  if (p.dashT > 0) {
    const step = Math.min(dt, p.dashT)
    p.x += p.dashDir * (DASH_DISTANCE / DASH_TIME) * step
    p.dashT -= dt
    if (p.dashT <= 0) {
      p.dashT = 0
      p.vx = p.dashDir * Math.min(Math.abs(p.vx), PLAYER_MAX_SPEED)
    }
  } else if (move !== 0) {
    // Reversing gets friction on top of acceleration, so turning is snappy.
    const reversing = p.vx !== 0 && Math.sign(p.vx) !== Math.sign(move)
    p.vx += move * (PLAYER_ACCEL + (reversing ? PLAYER_FRICTION : 0)) * dt
    p.vx = Math.max(-PLAYER_MAX_SPEED, Math.min(PLAYER_MAX_SPEED, p.vx))
    p.x += p.vx * dt
  } else {
    const slow = PLAYER_FRICTION * dt
    p.vx = Math.abs(p.vx) <= slow ? 0 : p.vx - Math.sign(p.vx) * slow
    p.x += p.vx * dt
  }

  if (p.x < PLAYER_MIN_X || p.x > PLAYER_MAX_X) {
    p.x = Math.max(PLAYER_MIN_X, Math.min(PLAYER_MAX_X, p.x))
    p.vx = 0
  }
  return dashed
}

// Returns true if that was the last life.
export function killPlayer(p: Player): boolean {
  p.lives--
  p.dashT = 0
  p.vx = 0
  if (p.lives <= 0) return true
  p.respawn = RESPAWN_DELAY
  return false
}
