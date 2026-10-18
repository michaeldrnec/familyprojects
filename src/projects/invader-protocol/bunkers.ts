// Hardlight bunkers: three clusters of hex cells that soak enemy fire and
// bank half of the damage absorbed as charge. Venting a bunker turns that
// charge into an upward beam and vaporizes the bunker for good (until the
// next wave rebuilds it).
import {
  BUNKER_COLS,
  BUNKER_ROWS,
  BUNKER_XS,
  BUNKER_Y,
  CELL_HP,
  CELL_R,
  ENERGY_MAX,
  ENERGY_PER_DAMAGE,
  VENT_DPS_BASE,
  VENT_DPS_PER_ENERGY,
  VENT_MIN_ENERGY,
  VENT_TIME,
} from './constants'

export const HEX_W = Math.sqrt(3) * CELL_R
const ROW_H = 1.5 * CELL_R
export const BUNKER_HALF_W = (BUNKER_COLS * HEX_W + HEX_W / 2) / 2
export const BUNKER_HALF_H = ((BUNKER_ROWS - 1) * ROW_H) / 2 + CELL_R

export interface Cell {
  dx: number // offset from the bunker center
  dy: number
  hp: number
  charge: number // 0..1, glows amber after absorbing a hit, then cools
}

export interface Bunker {
  x: number
  y: number
  cells: Cell[]
  energy: number
  vented: boolean
}

export interface VentBeam {
  x: number
  halfW: number
  baseY: number
  t: number // seconds remaining
  dps: number
}

export function newBunkers(): Bunker[] {
  return BUNKER_XS.map((x) => {
    const cells: Cell[] = []
    for (let r = 0; r < BUNKER_ROWS; r++) {
      for (let c = 0; c < BUNKER_COLS; c++) {
        const dx = (c - (BUNKER_COLS - 1) / 2) * HEX_W + (r % 2 ? HEX_W / 4 : -HEX_W / 4)
        const dy = (r - (BUNKER_ROWS - 1) / 2) * ROW_H
        cells.push({ dx, dy, hp: CELL_HP, charge: 0 })
      }
    }
    return { x, y: BUNKER_Y, cells, energy: 0, vented: false }
  })
}

export function integrity(b: Bunker): number {
  let sum = 0
  for (const c of b.cells) sum += c.hp
  return sum
}

export function isStanding(b: Bunker): boolean {
  return !b.vented && b.cells.some((c) => c.hp > 0)
}

// The first living cell a point (with radius r) overlaps, if any.
export function cellAt(b: Bunker, x: number, y: number, r: number): Cell | null {
  if (b.vented) return null
  if (Math.abs(x - b.x) > BUNKER_HALF_W + r || Math.abs(y - b.y) > BUNKER_HALF_H + r) return null
  const reach = CELL_R * 0.9 + r
  for (const c of b.cells) {
    if (c.hp <= 0) continue
    const dx = x - (b.x + c.dx)
    const dy = y - (b.y + c.dy)
    if (dx * dx + dy * dy <= reach * reach) return c
  }
  return null
}

export function damageCell(b: Bunker, cell: Cell, dmg: number) {
  const absorbed = Math.min(cell.hp, dmg)
  cell.hp -= absorbed
  cell.charge = Math.min(1, cell.charge + 0.6)
  b.energy = Math.min(ENERGY_MAX, b.energy + absorbed * ENERGY_PER_DAMAGE)
}

// The player's own shots: they chip the cell like enemy fire does, but bank
// no charge, so a bunker can't be farmed for vent energy.
export function chipCell(cell: Cell, dmg: number) {
  cell.hp = Math.max(0, cell.hp - dmg)
}

// Invaders plowing into a bunker erase whatever cells they overlap.
export function eraseRect(b: Bunker, x0: number, y0: number, x1: number, y1: number): boolean {
  if (b.vented) return false
  let erased = false
  for (const c of b.cells) {
    if (c.hp <= 0) continue
    const cx = b.x + c.dx
    const cy = b.y + c.dy
    if (cx >= x0 - CELL_R * 0.6 && cx <= x1 + CELL_R * 0.6 && cy >= y0 - CELL_R * 0.6 && cy <= y1 + CELL_R * 0.6) {
      c.hp = 0
      erased = true
    }
  }
  return erased
}

export function updateBunkers(bunkers: Bunker[], dt: number) {
  for (const b of bunkers) for (const c of b.cells) c.charge = Math.max(0, c.charge - 0.35 * dt)
}

export function canVent(b: Bunker, playerX: number): boolean {
  return isStanding(b) && b.energy >= VENT_MIN_ENERGY && Math.abs(playerX - b.x) <= BUNKER_HALF_W
}

export function vent(b: Bunker): VentBeam {
  const beam = { x: b.x, halfW: BUNKER_HALF_W, baseY: b.y + BUNKER_HALF_H, t: VENT_TIME, dps: VENT_DPS_BASE + VENT_DPS_PER_ENERGY * b.energy }
  b.vented = true
  b.energy = 0
  for (const c of b.cells) c.hp = 0
  return beam
}

// Rebuilds up to `amount` HP, cells nearest the center first.
export function restore(b: Bunker, amount: number) {
  const order = [...b.cells].sort((a, c) => a.dx * a.dx + a.dy * a.dy - (c.dx * c.dx + c.dy * c.dy))
  let left = amount
  for (const c of order) {
    if (left <= 0) break
    const add = Math.min(CELL_HP - c.hp, left)
    c.hp += add
    left -= add
  }
}

// The standing bunker with the least integrity (for the UFO reward).
export function mostDamaged(bunkers: Bunker[]): Bunker | null {
  let best: Bunker | null = null
  for (const b of bunkers) {
    if (b.vented) continue
    if (!best || integrity(b) < integrity(best)) best = b
  }
  return best
}
