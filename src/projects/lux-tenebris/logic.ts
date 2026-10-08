// The game rules as a pure function: step(level, grid, state, action) ->
// { state, events }. No rendering, timing or audio in here -- the
// component turns events into sounds and effects, and the level-check
// solver (solver.ts) reuses the exact same rules.
import { blocksMove, isDeadly, tileAt, type Grid } from './tiles'
import type { Level } from './levels'

export const CELL_CHARGE = 4

export type Status = 'playing' | 'fallen' | 'timeout' | 'won'

export interface PlayState {
  x: number
  y: number
  facing: number // beam direction, radians (0 = right, y down)
  battery: number
  batteryMax: number
  haveKey: boolean
  flipped: boolean // plates stepped on an odd number of times
  cellsTaken: number[] // tile indices
  keysTaken: number[]
  steps: number
  time: number // seconds of air left
  timeLimit: number
  echoes: number
  started: boolean // the clock starts on the first input
  status: Status
}

export type Action =
  | { type: 'move'; dx: number; dy: number }
  | { type: 'aim'; angle: number }
  | { type: 'echo' }
  | { type: 'tick'; dt: number }

export type GameEvent =
  | 'step-stone'
  | 'step-plank'
  | 'step-water'
  | 'bump'
  | 'cell'
  | 'key'
  | 'toggle'
  | 'echo'
  | 'fall'
  | 'win'
  | 'timeout'

export function initialState(level: Level, grid: Grid, timeScale = 1): PlayState {
  const timeLimit = Math.round(level.time * timeScale)
  return {
    x: grid.start.x,
    y: grid.start.y,
    facing: level.facing ?? 0,
    battery: level.battery,
    batteryMax: level.battery,
    haveKey: false,
    flipped: false,
    cellsTaken: [],
    keysTaken: [],
    steps: 0,
    time: timeLimit,
    timeLimit,
    echoes: level.echoes,
    started: false,
    status: 'playing',
  }
}

export function step(grid: Grid, s: PlayState, action: Action): { state: PlayState; events: GameEvent[] } {
  if (s.status !== 'playing') return { state: s, events: [] }
  const events: GameEvent[] = []

  if (action.type === 'tick') {
    if (!s.started) return { state: s, events }
    const time = Math.max(0, s.time - action.dt)
    if (time === 0) return { state: { ...s, time, status: 'timeout' }, events: ['timeout'] }
    return { state: { ...s, time }, events }
  }

  if (action.type === 'aim') return { state: { ...s, facing: action.angle, started: true }, events }

  if (action.type === 'echo') {
    if (s.echoes <= 0) return { state: s, events }
    return { state: { ...s, echoes: s.echoes - 1, started: true }, events: ['echo'] }
  }

  // move: always turns the beam that way, even if the step is blocked
  const facing = Math.atan2(action.dy, action.dx)
  const nx = s.x + action.dx
  const ny = s.y + action.dy
  if (blocksMove(grid, nx, ny, s.haveKey, s.flipped)) {
    return { state: { ...s, facing, started: true }, events: ['bump'] }
  }

  const next: PlayState = {
    ...s,
    x: nx,
    y: ny,
    facing,
    started: true,
    steps: s.steps + 1,
    battery: Math.max(0, s.battery - 1),
  }
  const i = ny * grid.w + nx
  const tile = tileAt(grid, nx, ny)

  if (isDeadly(grid, nx, ny, s.flipped)) return { state: { ...next, status: 'fallen' }, events: ['fall'] }

  events.push(tile === 'plank' || tile === 'bridge' ? 'step-plank' : tile === 'water' ? 'step-water' : 'step-stone')

  if (grid.cells.includes(i) && !next.cellsTaken.includes(i)) {
    next.cellsTaken = [...next.cellsTaken, i]
    next.battery = Math.min(next.batteryMax, next.battery + CELL_CHARGE)
    events.push('cell')
  }
  if (grid.keys.includes(i) && !next.keysTaken.includes(i)) {
    next.keysTaken = [...next.keysTaken, i]
    next.haveKey = true
    events.push('key')
  }
  if (tile === 'plate') {
    next.flipped = !next.flipped
    events.push('toggle')
  }
  if (tile === 'exit') {
    next.status = 'won'
    events.push('win')
  }
  return { state: next, events }
}

// Beam reach in tiles: full reach on a full battery, shrinking to a single
// tile on the last charge, and nothing at all once it's empty.
export function beamReach(s: PlayState, maxReach: number): number {
  if (s.battery <= 0) return 0
  return 1 + (maxReach - 1) * (s.battery / s.batteryMax)
}
