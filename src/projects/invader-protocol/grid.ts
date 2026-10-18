// The invader formation: a 5x11 lattice that marches one step per beat,
// drops and reverses at the screen bounds, snaps inward when a column is
// cleared, and sends a column into frenzy when its Command Core dies.
import {
  BOUND_LEFT,
  BOUND_RIGHT,
  COLS,
  COL_SPACING,
  FIRE_INTERVAL_MAX,
  FIRE_INTERVAL_MIN,
  FRENZY_AIM_SPREAD,
  FRENZY_FIRE_RATE,
  FRENZY_JITTER,
  FRENZY_TIME,
  GRID_START_X,
  GRID_START_Y,
  INVADER_HALF_H,
  INVADER_HALF_W,
  INVADER_HP,
  ROWS,
  ROW_SPACING,
  ROW_TYPES,
  SNAP_DX,
  SNAP_STUN,
  SNAP_TWEEN,
  STEP_DX,
  STEP_DY,
  type InvaderType,
} from './constants'
import type { Rng } from '../../shared/rng'

export interface Invader {
  id: number
  row: number
  col: number
  type: InvaderType
  hp: number
  maxHp: number
  alive: boolean
  frenzy: number // seconds of frenzy left
  jx: number // frenzy drift away from the lattice position
  flash: number // hit-flash timer
}

export interface Grid {
  invaders: Invader[]
  originX: number
  originY: number
  dir: 1 | -1
  dropPending: boolean
  colOffset: number[] // current snap offset (tweened)
  colTarget: number[] // where the snap tween is heading
  colCleared: boolean[] // so each column only snaps once
  stun: number
  fireTimers: number[]
  fireScale: number // enemy cadence multiplier, shrinks each wave
}

export function newGrid(rng: Rng, yOffset: number, fireScale: number, nextId: () => number): Grid {
  const invaders: Invader[] = []
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const type = ROW_TYPES[row]
      invaders.push({ id: nextId(), row, col, type, hp: INVADER_HP[type], maxHp: INVADER_HP[type], alive: true, frenzy: 0, jx: 0, flash: 0 })
    }
  }
  return {
    invaders,
    originX: GRID_START_X,
    originY: GRID_START_Y + yOffset,
    dir: 1,
    dropPending: false,
    colOffset: new Array(COLS).fill(0),
    colTarget: new Array(COLS).fill(0),
    colCleared: new Array(COLS).fill(false),
    stun: 0,
    // An extra second of grace so the first volley doesn't land the instant
    // the wave appears.
    fireTimers: Array.from({ length: COLS }, () => (1 + rng.range(FIRE_INTERVAL_MIN, FIRE_INTERVAL_MAX)) * fireScale),
    fireScale,
  }
}

// A formation with nobody in it, for boss waves: every grid rule (march,
// fire, snaps) then has nothing to act on.
export function emptyGrid(rng: Rng, fireScale: number, nextId: () => number): Grid {
  const grid = newGrid(rng, 0, fireScale, nextId)
  for (const inv of grid.invaders) inv.alive = false
  grid.colCleared.fill(true)
  return grid
}

export function invaderX(grid: Grid, inv: Invader): number {
  return grid.originX + inv.col * COL_SPACING + grid.colOffset[inv.col] + inv.jx
}

export function invaderY(grid: Grid, inv: Invader): number {
  return grid.originY + inv.row * ROW_SPACING
}

export function livingCount(grid: Grid): number {
  let n = 0
  for (const inv of grid.invaders) if (inv.alive) n++
  return n
}

function at(grid: Grid, row: number, col: number): Invader {
  return grid.invaders[row * COLS + col]
}

// A living Barrier Drone shields the living Heavy Grunt directly below it.
export function hasBarrier(grid: Grid, col: number): boolean {
  return at(grid, 1, col).alive && at(grid, 2, col).alive
}

// One march step, called on each beat. While stunned the grid holds still
// (the music keeps going).
export function marchStep(grid: Grid, rng: Rng) {
  if (grid.stun > 0) return
  if (grid.dropPending) {
    grid.originY += STEP_DY
    grid.dir = grid.dir === 1 ? -1 : 1
    grid.dropPending = false
    return
  }
  grid.originX += grid.dir * STEP_DX
  for (const inv of grid.invaders) {
    if (inv.alive && inv.frenzy > 0) inv.jx += STEP_DX * rng.range(-FRENZY_JITTER, FRENZY_JITTER)
  }
  // Bounds check against the outermost living invaders, so a thinned-out
  // formation travels further before turning.
  let minX = Infinity
  let maxX = -Infinity
  for (const inv of grid.invaders) {
    if (!inv.alive) continue
    const x = invaderX(grid, inv)
    minX = Math.min(minX, x - INVADER_HALF_W)
    maxX = Math.max(maxX, x + INVADER_HALF_W)
  }
  if ((grid.dir < 0 && minX <= BOUND_LEFT) || (grid.dir > 0 && maxX >= BOUND_RIGHT)) grid.dropPending = true
}

// Per-substep timers: stun, snap tween, frenzy, hit flash, drift recovery.
export function updateGrid(grid: Grid, dt: number) {
  grid.stun = Math.max(0, grid.stun - dt)
  const tweenRate = SNAP_DX / SNAP_TWEEN
  for (let c = 0; c < COLS; c++) {
    const d = grid.colTarget[c] - grid.colOffset[c]
    const stepAmt = tweenRate * dt
    grid.colOffset[c] = Math.abs(d) <= stepAmt ? grid.colTarget[c] : grid.colOffset[c] + Math.sign(d) * stepAmt
  }
  for (const inv of grid.invaders) {
    inv.flash = Math.max(0, inv.flash - dt)
    if (inv.frenzy > 0) {
      inv.frenzy = Math.max(0, inv.frenzy - dt)
    } else if (inv.jx !== 0) {
      // Frenzy over: drift back into the lattice.
      const back = 60 * dt
      inv.jx = Math.abs(inv.jx) <= back ? 0 : inv.jx - Math.sign(inv.jx) * back
    }
  }
}

// Each column fires from its lowest living invader, whatever its type, so
// a column stays dangerous after its Raiders are gone.
export function updateEnemyFire(
  grid: Grid,
  dt: number,
  rng: Rng,
  fire: (x: number, y: number, angle: number, inv: Invader) => void,
) {
  if (grid.stun > 0) return
  for (let c = 0; c < COLS; c++) {
    let shooter: Invader | null = null
    let frenzied = false
    for (let r = ROWS - 1; r >= 0; r--) {
      const inv = at(grid, r, c)
      if (!inv.alive) continue
      if (!shooter) shooter = inv
      if (inv.frenzy > 0) frenzied = true
    }
    if (!shooter) continue
    grid.fireTimers[c] -= dt * (frenzied ? FRENZY_FIRE_RATE : 1)
    if (grid.fireTimers[c] > 0) continue
    grid.fireTimers[c] = rng.range(FIRE_INTERVAL_MIN, FIRE_INTERVAL_MAX) * grid.fireScale
    const angle = shooter.frenzy > 0 ? rng.range(-FRENZY_AIM_SPREAD, FRENZY_AIM_SPREAD) : 0
    fire(invaderX(grid, shooter), invaderY(grid, shooter) + INVADER_HALF_H, angle, shooter)
  }
}

// A Command Core died: everything still alive beneath it frenzies.
export function triggerFrenzy(grid: Grid, col: number) {
  for (let r = 1; r < ROWS; r++) {
    const inv = at(grid, r, col)
    if (inv.alive) inv.frenzy = FRENZY_TIME
  }
}

// Finds columns that just became empty, collapses every column on each side
// SNAP_DX toward the gap, and stuns the grid. Returns the cleared columns
// (for the shockwave effect).
export function checkColumnSnaps(grid: Grid): number[] {
  const snapped: number[] = []
  for (let c = 0; c < COLS; c++) {
    if (grid.colCleared[c]) continue
    let any = false
    for (let r = 0; r < ROWS; r++) if (at(grid, r, c).alive) any = true
    if (any) continue
    grid.colCleared[c] = true
    // The last column standing has nothing left to snap toward.
    if (grid.invaders.every((inv) => !inv.alive)) continue
    snapped.push(c)
    for (let o = 0; o < COLS; o++) {
      if (o < c) grid.colTarget[o] += SNAP_DX
      else if (o > c) grid.colTarget[o] -= SNAP_DX
    }
    grid.stun = SNAP_STUN
  }
  return snapped
}

// Center x of a column (for effects), using its target snap offset.
export function columnX(grid: Grid, col: number): number {
  return grid.originX + col * COL_SPACING + grid.colOffset[col]
}

export function lowestBottom(grid: Grid): number {
  let y = -Infinity
  for (const inv of grid.invaders) if (inv.alive) y = Math.max(y, invaderY(grid, inv) + INVADER_HALF_H)
  return y
}
