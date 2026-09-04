// Ship movement model (spec.md section 4): up/down move the ship directly,
// left/right set facing (not velocity), and a separate thrust key
// accelerates the ship along its current facing direction with inertia --
// releasing thrust decays velocity via drag rather than stopping instantly.

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

// A collision-imminent shield: arms automatically when a hazard gets this
// close and absorbs the very next hit for free. Once used (or once its
// window expires unused) it starts "charging": a clean streak with no
// damage taken recharges it, but any hit taken while charging resets the
// streak back to zero -- so getting the shield back means surviving
// SHIELD_REGEN_TIME seconds completely unscathed, not just waiting it out.
export const SHIELD_TRIGGER_RANGE = 70
export const SHIELD_ACTIVE_DURATION = 0.6
export const SHIELD_REGEN_TIME = 60
// How long the "shield fully charged" flourish plays once regen completes.
export const SHIELD_FLASH_DURATION = 0.5

export type ShieldState = 'ready' | 'active' | 'charging'

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
  // While 'active': seconds remaining in the absorb window (counts down).
  // While 'charging': seconds of clean streak accumulated so far (counts
  // up toward SHIELD_REGEN_TIME).
  shieldTimer: number
  // Seconds remaining on the "just finished charging" visual flourish.
  shieldFlash: number
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
