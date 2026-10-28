// A manor's grid: parsing the ASCII maps, tile queries, straight corridor
// runs and line of sight. Tile (x, y) has its center at (x, y) and covers
// [x − ½, x + ½] × [y − ½, y + ½]; y grows downward (south).

export const WALL = 0
export const FLOOR = 1
export const HOUSE = 2
export const HOUSE_DOOR = 3
export const PROP = 4
export const DOOR = 5

export interface Maze {
  w: number
  h: number
  cells: Uint8Array
  sweets: number[] // tiles that start with a sweet
  gumballs: number[]
  lanterns: number[] // wall tiles with a lantern
  props: number[]
  door: number
  start: number
  house: number[] // Ghost House floor
  houseDoor: number
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const

export function parseManor(rows: readonly string[]): Maze {
  const h = rows.length
  const w = rows[0]?.length ?? 0
  if (!h || !w || rows.some((r) => r.length !== w)) throw new Error('manor rows must all be the same length')
  const cells = new Uint8Array(w * h)
  const m: Maze = { w, h, cells, sweets: [], gumballs: [], lanterns: [], props: [], door: -1, start: -1, house: [], houseDoor: -1 }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const ch = rows[y][x]
      switch (ch) {
        case '#':
          cells[i] = WALL
          break
        case 'L':
          cells[i] = WALL
          m.lanterns.push(i)
          break
        case '.':
          cells[i] = FLOOR
          m.sweets.push(i)
          break
        case 'o':
          cells[i] = FLOOR
          m.gumballs.push(i)
          break
        case ' ':
          cells[i] = FLOOR
          break
        case 'S':
          cells[i] = FLOOR
          m.start = i
          break
        case 'f':
          cells[i] = PROP
          m.props.push(i)
          break
        case 'G':
          cells[i] = HOUSE
          m.house.push(i)
          break
        case '=':
          cells[i] = HOUSE_DOOR
          m.houseDoor = i
          break
        case 'D':
          cells[i] = DOOR
          m.door = i
          break
        default:
          throw new Error(`unknown manor tile "${ch}" at ${x},${y}`)
      }
    }
  }
  if (m.door < 0 || m.start < 0 || m.houseDoor < 0 || !m.house.length) throw new Error('a manor needs a door, a start, a Ghost House and its door')
  return m
}

export const tileX = (m: Maze, i: number) => i % m.w
export const tileY = (m: Maze, i: number) => Math.floor(i / m.w)
export const inBounds = (m: Maze, x: number, y: number) => x >= 0 && y >= 0 && x < m.w && y < m.h

export function tileAt(m: Maze, x: number, y: number): number {
  const tx = Math.round(x)
  const ty = Math.round(y)
  return inBounds(m, tx, ty) ? ty * m.w + tx : -1
}

export function cellAt(m: Maze, x: number, y: number): number {
  return inBounds(m, x, y) ? m.cells[y * m.w + x] : WALL
}

// Ghosts float through furniture and the Ghost House door, but not stone.
export function ghostBlocked(m: Maze, x: number, y: number): boolean {
  return cellAt(m, x, y) === WALL
}

export function neighbors(m: Maze, i: number): number[] {
  const x = tileX(m, i)
  const y = tileY(m, i)
  const out: number[] = []
  for (const [dx, dy] of DIRS) if (inBounds(m, x + dx, y + dy)) out.push((y + dy) * m.w + x + dx)
  return out
}

// Floor Snaxley can walk on (ignoring hazards and the front door).
export function isFloor(m: Maze, i: number): boolean {
  return i >= 0 && m.cells[i] === FLOOR
}

export function isIntersection(m: Maze, i: number): boolean {
  return isFloor(m, i) && neighbors(m, i).filter((n) => isFloor(m, n)).length >= 3
}

// The straight run of non-wall tiles through `i`, up to `reach` each way,
// along whichever axis is longer.
export function corridorRun(m: Maze, i: number, reach = 6): number[] {
  const x = tileX(m, i)
  const y = tileY(m, i)
  const run = (dx: number, dy: number) => {
    const out = [i]
    for (const s of [1, -1]) {
      for (let k = 1; k <= reach; k++) {
        const nx = x + dx * k * s
        const ny = y + dy * k * s
        if (ghostBlocked(m, nx, ny)) break
        out.push(ny * m.w + nx)
      }
    }
    return out
  }
  const h = run(1, 0)
  const v = run(0, 1)
  return h.length >= v.length ? h : v
}

// True when nothing but open air lies between the two points. Walls block
// sight; furniture, the Ghost House door and the ghosts themselves don't.
export function lineOfSight(m: Maze, ax: number, ay: number, bx: number, by: number): boolean {
  const dx = bx - ax
  const dy = by - ay
  const steps = Math.ceil(Math.hypot(dx, dy) / 0.15)
  for (let s = 1; s < steps; s++) {
    const t = s / steps
    if (ghostBlocked(m, Math.round(ax + dx * t), Math.round(ay + dy * t))) return false
  }
  return true
}
