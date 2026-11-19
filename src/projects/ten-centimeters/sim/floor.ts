// The hospital floor, in a fixed 1000×640 logical space: four labor bays
// (two above the hall, two below), Supply, the scrub sink in an alcove
// outside the OR, the OR, the nurses' station and triage.
//
// Where the doctor can stand is a union of rectangles. Paths come from A*
// over a 10 px grid of that area, then are pulled tight with line-of-sight
// checks so the doctor walks straight lines instead of a staircase.
import type { Station } from './types'

export const FLOOR_W = 1000
export const FLOOR_H = 640
export const REACH = 26 // how close counts as "at" a station

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

const HALL_TOP = 250
const HALL_BOTTOM = 390

// Rooms, for drawing and for working out what a tap meant.
export const ROOMS = {
  bay0: { x: 0, y: 0, w: 220, h: HALL_TOP },
  bay1: { x: 220, y: 0, w: 220, h: HALL_TOP },
  supply: { x: 440, y: 0, w: 160, h: HALL_TOP },
  sink: { x: 600, y: 110, w: 100, h: HALL_TOP - 110 },
  or: { x: 700, y: 0, w: 300, h: HALL_TOP },
  bay2: { x: 0, y: HALL_BOTTOM, w: 220, h: FLOOR_H - HALL_BOTTOM },
  bay3: { x: 220, y: HALL_BOTTOM, w: 220, h: FLOOR_H - HALL_BOTTOM },
  nurses: { x: 440, y: HALL_BOTTOM, w: 260, h: FLOOR_H - HALL_BOTTOM },
  triage: { x: 700, y: HALL_BOTTOM, w: 300, h: FLOOR_H - HALL_BOTTOM },
  hall: { x: 0, y: HALL_TOP, w: FLOOR_W, h: HALL_BOTTOM - HALL_TOP },
} satisfies Record<string, Rect>

// Door gaps in the hall-side walls (drawn as openings).
export const DOORS: Rect[] = [
  { x: 70, y: HALL_TOP - 8, w: 80, h: 16 },
  { x: 290, y: HALL_TOP - 8, w: 80, h: 16 },
  { x: 480, y: HALL_TOP - 8, w: 80, h: 16 },
  { x: 770, y: HALL_TOP - 8, w: 100, h: 16 },
  { x: 70, y: HALL_BOTTOM - 8, w: 80, h: 16 },
  { x: 290, y: HALL_BOTTOM - 8, w: 80, h: 16 },
]

// Beds and furniture.
export const BEDS: Rect[] = [
  { x: 70, y: 26, w: 80, h: 112 },
  { x: 290, y: 26, w: 80, h: 112 },
  { x: 70, y: FLOOR_H - 138, w: 80, h: 112 },
  { x: 290, y: FLOOR_H - 138, w: 80, h: 112 },
]
export const OR_TABLE: Rect = { x: 800, y: 30, w: 100, h: 90 }
export const SINK: Rect = { x: 620, y: 118, w: 60, h: 26 }
export const SHELVES: Rect = { x: 456, y: 18, w: 128, h: 70 }
export const DESK: Rect = { x: 470, y: 440, w: 200, h: 60 }
export const CHAIRS: Point[] = [
  { x: 770, y: 560 },
  { x: 840, y: 560 },
  { x: 910, y: 560 },
]

// Where the doctor stands to work at each station.
export const SPOTS: Record<Station, Point> = {
  bay0: { x: 110, y: 178 },
  bay1: { x: 330, y: 178 },
  bay2: { x: 110, y: FLOOR_H - 178 },
  bay3: { x: 330, y: FLOOR_H - 178 },
  supply: { x: 520, y: 150 },
  sink: { x: 650, y: 172 },
  or: { x: 850, y: 168 },
}

export const START: Point = { x: 560, y: 320 }

// The doctor's centre may be anywhere inside one of these.
export const WALKABLE: Rect[] = [
  { x: 16, y: HALL_TOP + 16, w: FLOOR_W - 32, h: HALL_BOTTOM - HALL_TOP - 32 }, // hall
  // top bays: the space in front of the bed, plus the doorway
  { x: 22, y: 150, w: 176, h: 84 },
  { x: 86, y: 220, w: 48, h: 60 },
  { x: 242, y: 150, w: 176, h: 84 },
  { x: 306, y: 220, w: 48, h: 60 },
  // supply
  { x: 462, y: 104, w: 116, h: 130 },
  { x: 496, y: 220, w: 48, h: 60 },
  // sink alcove (open to the hall)
  { x: 616, y: 158, w: 68, h: 120 },
  // OR
  { x: 722, y: 136, w: 256, h: 98 },
  { x: 790, y: 220, w: 60, h: 60 },
  // bottom bays
  { x: 22, y: 406, w: 176, h: 84 },
  { x: 86, y: 360, w: 48, h: 60 },
  { x: 242, y: 406, w: 176, h: 84 },
  { x: 306, y: 360, w: 48, h: 60 },
  // triage, open to the hall
  { x: 722, y: 360, w: 256, h: 160 },
]

function inside(r: Rect, x: number, y: number) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
}

export function isWalkable(x: number, y: number): boolean {
  return WALKABLE.some((r) => inside(r, x, y))
}

// Which station (if any) a tap on the floor means.
export function stationAt(x: number, y: number): Station | null {
  for (const id of ['bay0', 'bay1', 'bay2', 'bay3', 'supply', 'sink', 'or'] as const) {
    if (inside(ROOMS[id], x, y)) return id
  }
  return null
}

export function nearStation(x: number, y: number): Station | null {
  for (const [id, p] of Object.entries(SPOTS) as [Station, Point][]) {
    if (Math.hypot(p.x - x, p.y - y) <= REACH) return id
  }
  return null
}

// --- Pathfinding --------------------------------------------------------------

const CELL = 10
const COLS = FLOOR_W / CELL
const ROWS = FLOOR_H / CELL

const grid = new Uint8Array(COLS * ROWS)
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) grid[r * COLS + c] = isWalkable(c * CELL + CELL / 2, r * CELL + CELL / 2) ? 1 : 0
}

function cellOf(p: Point) {
  const c = Math.min(COLS - 1, Math.max(0, Math.floor(p.x / CELL)))
  const r = Math.min(ROWS - 1, Math.max(0, Math.floor(p.y / CELL)))
  return r * COLS + c
}

function centre(cell: number): Point {
  return { x: (cell % COLS) * CELL + CELL / 2, y: Math.floor(cell / COLS) * CELL + CELL / 2 }
}

// The walkable cell nearest to p.
function nearestOpen(p: Point): number {
  const start = cellOf(p)
  if (grid[start]) return start
  let best = -1
  let bestD = Infinity
  for (let i = 0; i < grid.length; i++) {
    if (!grid[i]) continue
    const q = centre(i)
    const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

// The walkable point nearest to p (p itself if it's walkable).
export function clampToFloor(p: Point): Point {
  return isWalkable(p.x, p.y) ? p : centre(nearestOpen(p))
}

export function lineOfSight(a: Point, b: Point): boolean {
  const d = Math.hypot(b.x - a.x, b.y - a.y)
  const steps = Math.max(1, Math.ceil(d / 4))
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    if (!isWalkable(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false
  }
  return true
}

const NEIGHBOURS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
] as const

// Waypoints from `from` to `to` (both snapped onto the floor), not
// including `from`. Empty if there's no way through.
export function findPath(from: Point, to: Point): Point[] {
  const goalPoint = clampToFloor(to)
  if (lineOfSight(from, goalPoint)) return [goalPoint]
  const start = nearestOpen(from)
  const goal = nearestOpen(goalPoint)
  const g = new Float32Array(grid.length).fill(Infinity)
  const prev = new Int32Array(grid.length).fill(-1)
  const closed = new Uint8Array(grid.length)
  const gc = centre(goal)
  const h = (cell: number) => {
    const p = centre(cell)
    return Math.hypot(p.x - gc.x, p.y - gc.y) / CELL
  }
  // The grid is small (6,400 cells), so a linear scan of the open list is fine.
  const open = new Set<number>([start])
  const f = new Float32Array(grid.length).fill(Infinity)
  g[start] = 0
  f[start] = h(start)
  while (open.size) {
    let cur = -1
    let best = Infinity
    for (const c of open) {
      if (f[c] < best) {
        best = f[c]
        cur = c
      }
    }
    if (cur === goal) break
    open.delete(cur)
    closed[cur] = 1
    const cc = cur % COLS
    const cr = Math.floor(cur / COLS)
    for (const [dc, dr, cost] of NEIGHBOURS) {
      const nc = cc + dc
      const nr = cr + dr
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue
      const n = nr * COLS + nc
      if (!grid[n] || closed[n]) continue
      // No cutting corners past a wall.
      if (dc && dr && (!grid[cr * COLS + nc] || !grid[nr * COLS + cc])) continue
      const ng = g[cur] + cost
      if (ng < g[n]) {
        g[n] = ng
        f[n] = ng + h(n)
        prev[n] = cur
        open.add(n)
      }
    }
  }
  if (start !== goal && prev[goal] < 0) return []
  const cells: Point[] = []
  for (let c = goal; c !== start && c >= 0; c = prev[c]) cells.push(centre(c))
  cells.reverse()
  cells.push(goalPoint)
  // Pull the path tight: skip every waypoint the doctor can see past.
  const out: Point[] = []
  let anchor = from
  let i = 0
  while (i < cells.length) {
    let j = cells.length - 1
    while (j > i && !lineOfSight(anchor, cells[j])) j--
    out.push(cells[j])
    anchor = cells[j]
    i = j + 1
  }
  return out
}
