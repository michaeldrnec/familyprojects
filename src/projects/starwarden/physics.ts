// Ship movement model (spec.md section 4): up/down move the ship directly,
// left/right set facing (not velocity), and a separate thrust key
// accelerates the ship along its current facing direction with inertia --
// releasing thrust decays velocity via drag rather than stopping instantly.
import type { Rng } from './rng'

export const WORLD_WIDTH = 4000
export const VIEW_WIDTH = 900
export const VIEW_HEIGHT = 500
// Vertical travel is clamped inside this margin so the ship never overlaps
// the HUD drawn at the very top/bottom of the canvas.
export const Y_MARGIN = 46

export const THRUST_ACCEL = 320 // px/s^2 along facing while thrust is held
export const MAX_SPEED = 260 // px/s, horizontal
// Fraction of velocity retained per second with no thrust -- high on
// purpose, so the ship coasts a long way on momentum after the engine cuts
// out instead of gliding to a stop in a second or two.
export const DRAG_PER_SEC = 0.94
export const VERTICAL_SPEED = 220 // px/s, direct up/down control

export const FUEL_MAX = 220
export const FUEL_BURN_PER_SEC = 5
export const CRYSTAL_MAX = 50
export const HEALTH_MAX = 3

export const SHIP_RADIUS = 15

// A passive shield: while 'ready' it sits around the ship as a visible
// bubble and absorbs the next hit, whenever that hit comes. Once spent it
// recharges over SHIELD_REGEN_TIME seconds; taking a hit while charging
// pauses the recharge for that moment rather than wiping the progress.
export const SHIELD_REGEN_TIME = 30
// How long the "shield fully charged" flourish plays once regen completes.
export const SHIELD_FLASH_DURATION = 0.5
// How long the shatter ring plays when the shield absorbs a hit.
export const SHIELD_BREAK_DURATION = 0.5

export type ShieldState = 'ready' | 'charging'

export interface ShipState {
  worldX: number // position along the wraparound world, 0..WORLD_WIDTH
  y: number
  vx: number
  facing: 1 | -1
  thrusting: boolean
  fuel: number
  crystals: number
  health: number
  shieldState: ShieldState
  // While 'charging': seconds of recharge accumulated so far (counts up
  // toward SHIELD_REGEN_TIME). Unused while 'ready'.
  shieldTimer: number
  // Seconds remaining on the "just finished charging" visual flourish.
  shieldFlash: number
  // Seconds remaining on the "shield just absorbed a hit" shatter ring.
  shieldBreak: number
}

export interface ShipInput {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  thrust: boolean
}

export function initialShip(): ShipState {
  return {
    worldX: WORLD_WIDTH / 2,
    y: VIEW_HEIGHT / 2,
    vx: 0,
    facing: 1,
    thrusting: false,
    fuel: FUEL_MAX,
    crystals: CRYSTAL_MAX,
    health: HEALTH_MAX,
    shieldState: 'ready',
    shieldTimer: 0,
    shieldFlash: 0,
    shieldBreak: 0,
  }
}

export function wrap(x: number, width: number): number {
  return ((x % width) + width) % width
}

// Shortest signed offset from a to b around a wraparound world of `width`,
// e.g. so an enemy just past the seam still reads as "a little ahead"
// instead of "almost all the way around".
export function wrapDelta(b: number, a: number, width: number): number {
  let d = (b - a) % width
  if (d > width / 2) d -= width
  if (d < -width / 2) d += width
  return d
}

// A random world x at least `minGap` px around the loop from `centerX`
// (the camera's center), so the spawn is guaranteed to be off-screen.
export function offscreenSpawnX(rng: Rng, centerX: number, worldWidth: number, minGap = 600): number {
  return wrap(centerX + rng.range(minGap, worldWidth - minGap), worldWidth)
}

export function stepShip(ship: ShipState, input: ShipInput, dt: number): ShipState {
  const facing: 1 | -1 = input.left && !input.right ? -1 : input.right && !input.left ? 1 : ship.facing

  const canThrust = input.thrust && ship.fuel > 0
  let vx = ship.vx
  if (canThrust) {
    vx += facing * THRUST_ACCEL * dt
    vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, vx))
  } else {
    // Exponential drag so momentum decays smoothly rather than snapping to
    // zero the instant thrust is released.
    vx *= Math.pow(DRAG_PER_SEC, dt)
    if (Math.abs(vx) < 0.5) vx = 0
  }

  let y = ship.y
  if (input.up) y -= VERTICAL_SPEED * dt
  if (input.down) y += VERTICAL_SPEED * dt
  y = Math.max(Y_MARGIN, Math.min(VIEW_HEIGHT - Y_MARGIN, y))

  const fuel = canThrust ? Math.max(0, ship.fuel - FUEL_BURN_PER_SEC * dt) : ship.fuel
  const worldX = wrap(ship.worldX + vx * dt, WORLD_WIDTH)

  return {
    ...ship,
    worldX,
    y,
    vx,
    facing,
    thrusting: canThrust,
    fuel,
  }
}
