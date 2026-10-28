// The shape of a round in progress. Kept in its own module so the rules
// modules (fear, hazards, intruder, ghosts, abilities, helpers) can share it
// without importing each other in a circle.
import type { Rng } from '../../../shared/rng'
import type { AbilityId, DifficultyDef, GhostId, ManorDef } from './config'
import type { WorldEvent } from './events'
import type { Maze } from './maze'

export interface Vec {
  x: number
  y: number
}

// What the helper AI remembers between steps.
export interface HelperState {
  path: number[]
  goal: number
  replan: number
  think: number // seconds before it picks a new goal
  wait: number // seconds before it may use another ability
}

export interface Ghost {
  id: GhostId
  x: number
  y: number
  facing: number // radians; 0 = east, π/2 = south
  moved: boolean
  cd: Partial<Record<AbilityId, number>>
  hidden: number // Wallflower: seconds left in the wall
  hideDir: Vec // which way the wall she's in lies
  invisible: number // Right Behind You
  noclip: number
  intangible: number
  dash: { vx: number; vy: number; t: number; scared: boolean } | null
  boost: number // Desperation Dash
  respawn: number // > 0 while bonked
  seen: number // recent seconds in his headlamp
  spotted: boolean
  ai: HelperState
}

export type HazardKind = 'slime' | 'mirror' | 'trick' | 'goo' | 'party' | 'wail' | 'decoy'

export interface Hazard {
  id: number
  kind: HazardKind
  tile: number
  x: number
  y: number
  t: number // seconds left
  life: number
  seen: boolean // he has noticed it (slime)
  ghost: GhostId
}

export type IntruderState = 'forage' | 'spooked' | 'flee' | 'rush'

// Timers in seconds; skid lasts until he hits a wall.
export interface Status {
  stumble: number
  frozen: number
  confused: number
  stuck: number
  treadmill: number
  blind: number
  munch: number
  noEat: number
  skid: boolean
}

export interface Intruder {
  cur: number // the tile he's at or leaving
  next: number // the tile he's heading to (== cur when standing)
  p: number // 0..1 along cur → next
  x: number
  y: number
  dirX: number
  dirY: number
  look: number // headlamp angle
  state: IntruderState
  stateT: number
  from: Vec // what spooked him
  alert: number
  alertAt: Vec
  status: Status
  munchTile: number
  goal: number
  path: number[] // his planned route, read by the helper AI
  rush: number
  trail: number[] // the last few tiles he stood on
  lastSnuff: number
  wait: number
}

export interface World {
  maze: Maze
  manorIndex: number
  manor: ManorDef
  diff: DifficultyDef
  rng: Rng
  time: number
  sweets: Uint8Array
  sweetsLeft: number
  sweetsTotal: number
  gumballs: Uint8Array
  ghosts: Ghost[]
  active: number // index of the ghost the player flies
  swapCd: number
  intruder: Intruder
  fear: number
  fearFloor: number
  lastScareAt: number
  lastScare: { ghost: GhostId; t: number } | null
  ecto: number
  hazards: Hazard[]
  nextId: number
  snuff: Float32Array // seconds of darkness left per tile
  snuffId: Int32Array
  danger: Float32Array
  wisps: Vec[]
  wispT: number
  footT: number
  habit: Partial<Record<AbilityId, number[]>>
  chain: number
  bestCombo: number
  scares: number
  fleeLeft: number
  helpers: boolean // false: ghosts nobody controls just float (tests)
  over: 'won' | 'lost' | null
  events: WorldEvent[]
}
