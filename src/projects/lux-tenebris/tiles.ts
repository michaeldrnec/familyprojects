// Tile types and the ASCII level format (see SPEC.md). A level map is a
// list of equal-length strings, one character per tile; parseLevel() turns
// it into a flat tile array plus the positions of pickups and toggles.

export type Tile =
  | 'wall'
  | 'floor'
  | 'chasm'
  | 'plank'
  | 'water'
  | 'mirrorF' // '/'
  | 'mirrorB' // '\'
  | 'door'
  | 'plate'
  | 'gate'
  | 'bridge' // hinged bridge: a chasm while raised, a plank while lowered
  | 'exit'

export interface Point {
  x: number
  y: number
}

export interface Grid {
  w: number
  h: number
  tiles: Tile[]
  start: Point
  exit: Point
  cells: number[] // tile indices holding a spare cell
  keys: number[]
  moss: number[]
  // Gates: open at start? Bridges: lowered at start? Every plate flips all of them.
  toggledAtStart: boolean[]
}

const CHAR_TILES: Record<string, Tile> = {
  '#': 'wall',
  ' ': 'wall',
  '.': 'floor',
  S: 'floor',
  B: 'floor',
  M: 'floor',
  k: 'floor',
  E: 'exit',
  C: 'chasm',
  '=': 'plank',
  '~': 'water',
  '/': 'mirrorF',
  '\\': 'mirrorB',
  D: 'door',
  p: 'plate',
  g: 'gate',
  G: 'gate',
  h: 'bridge',
  H: 'bridge',
}

export function parseLevel(map: string[]): Grid {
  const h = map.length
  const w = Math.max(...map.map((row) => row.length))
  const tiles: Tile[] = []
  const toggledAtStart: boolean[] = []
  const cells: number[] = []
  const keys: number[] = []
  const moss: number[] = []
  let start: Point = { x: 1, y: 1 }
  let exit: Point = { x: 1, y: 1 }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = map[y][x] ?? '#'
      const tile = CHAR_TILES[ch]
      if (!tile) throw new Error(`Unknown tile '${ch}' at ${x},${y}`)
      const i = y * w + x
      tiles.push(tile)
      toggledAtStart.push(ch === 'g' || ch === 'H')
      if (ch === 'S') start = { x, y }
      if (ch === 'E') exit = { x, y }
      if (ch === 'B') cells.push(i)
      if (ch === 'k') keys.push(i)
      if (ch === 'M') moss.push(i)
    }
  }
  return { w, h, tiles, start, exit, cells, keys, moss, toggledAtStart }
}

export function tileAt(grid: Grid, x: number, y: number): Tile {
  if (x < 0 || y < 0 || x >= grid.w || y >= grid.h) return 'wall'
  return grid.tiles[y * grid.w + x]
}

// Gates are open, and bridges lowered, when their start state differs from
// whether the plates have been flipped an odd number of times.
export function isToggledOn(grid: Grid, i: number, flipped: boolean): boolean {
  return grid.toggledAtStart[i] !== flipped
}

export function blocksMove(grid: Grid, x: number, y: number, haveKey: boolean, flipped: boolean): boolean {
  const t = tileAt(grid, x, y)
  if (t === 'wall' || t === 'mirrorF' || t === 'mirrorB') return true
  if (t === 'door') return !haveKey
  if (t === 'gate') return !isToggledOn(grid, y * grid.w + x, flipped)
  return false
}

export function blocksLight(grid: Grid, x: number, y: number, haveKey: boolean, flipped: boolean): boolean {
  const t = tileAt(grid, x, y)
  if (t === 'wall') return true
  if (t === 'door') return !haveKey
  if (t === 'gate') return !isToggledOn(grid, y * grid.w + x, flipped)
  return false
}

export function isDeadly(grid: Grid, x: number, y: number, flipped: boolean): boolean {
  const t = tileAt(grid, x, y)
  if (t === 'chasm') return true
  if (t === 'bridge') return !isToggledOn(grid, y * grid.w + x, flipped)
  return false
}
