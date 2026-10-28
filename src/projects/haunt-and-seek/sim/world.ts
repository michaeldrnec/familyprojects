// A round of Haunt & Seek: newWorld() sets one up, stepWorld() advances it
// (in fixed steps of at most 1/60 s) and returns what happened, and
// roundResult() scores it. Pure and seeded: no DOM, no three.js, no
// Math.random, so tests can replay any round exactly.
import { makeRng } from '../../../shared/rng'
import { castSlot, tickAbilities } from './abilities'
import { MANORS, TUNING, difficultyDef, type DifficultyId, type GhostId } from './config'
import { decayFear } from './fear'
import { moveGhost, tickGhost, tickWisps } from './ghosts'
import { tickHazards } from './hazards'
import { helperCommand, helperCooldown, type GhostCommand } from './helpers'
import { stepIntruder } from './intruder'
import { parseManor, tileX, tileY, type Maze } from './maze'
import type { WorldEvent } from './events'
import type { Ghost, Intruder, World } from './types'

// What the player does this frame. Movement is in grid directions (+x east,
// +y south), already turned from camera-relative by the caller.
export interface PlayerInput {
  mx: number
  my: number
  face: number | null // the camera's heading, or null to face the way you move
  cast: number | null // ability slot pressed this frame
  swap: number | null // ghost index pressed this frame
}

const mazes = new Map<number, Maze>()

export function manorMaze(index: number): Maze {
  let m = mazes.get(index)
  if (!m) {
    m = parseManor(MANORS[index].map)
    mazes.set(index, m)
  }
  return m
}

function newGhost(id: GhostId, x: number, y: number): Ghost {
  return {
    id,
    x,
    y,
    facing: -Math.PI / 2,
    moved: false,
    cd: {},
    hidden: 0,
    hideDir: { x: 0, y: -1 },
    invisible: 0,
    noclip: 0,
    intangible: 0,
    dash: null,
    boost: 0,
    respawn: 0,
    seen: 0,
    spotted: false,
    ai: { path: [], goal: -1, replan: 0, think: 0, wait: 0 },
  }
}

export function newWorld(manorIndex: number, difficulty: DifficultyId, seed: number): World {
  const manor = MANORS[manorIndex]
  const maze = manorMaze(manorIndex)
  const n = maze.w * maze.h
  const sweets = new Uint8Array(n)
  for (const i of maze.sweets) sweets[i] = 1
  const gumballs = new Uint8Array(n)
  for (const i of maze.gumballs) gumballs[i] = 1
  // Ghosts start along the middle row of the Ghost House.
  const row = maze.house.filter((i) => tileY(maze, i) === tileY(maze, maze.house[Math.floor(maze.house.length / 2)]))
  const order = [0, row.length - 1, 1, row.length - 2]
  const ghosts = manor.ghosts.map((id, k) => {
    const i = row[order[k] ?? 0]
    return newGhost(id, tileX(maze, i), tileY(maze, i))
  })
  const sx = tileX(maze, maze.start)
  const sy = tileY(maze, maze.start)
  const intruder: Intruder = {
    cur: maze.start,
    next: maze.start,
    p: 0,
    x: sx,
    y: sy,
    dirX: 0,
    dirY: -1,
    look: -Math.PI / 2,
    state: 'forage',
    stateT: 0,
    from: { x: sx, y: sy },
    alert: 0,
    alertAt: { x: sx, y: sy },
    status: { stumble: 0, frozen: 0, confused: 0, stuck: 0, treadmill: 0, blind: 0, munch: 0, noEat: 0, skid: false },
    munchTile: -1,
    goal: -1,
    path: [],
    rush: 0,
    trail: [maze.start],
    lastSnuff: -1,
    wait: 1, // a beat on the doormat before he starts
  }
  const diff = difficultyDef(difficulty)
  return {
    maze,
    manorIndex,
    manor,
    diff,
    rng: makeRng(seed),
    time: 0,
    sweets,
    sweetsLeft: maze.sweets.length,
    sweetsTotal: maze.sweets.length,
    gumballs,
    ghosts,
    active: 0,
    swapCd: 0,
    intruder,
    fear: 0,
    fearFloor: 0,
    lastScareAt: 0,
    lastScare: null,
    ecto: TUNING.ectoStart,
    hazards: [],
    nextId: 1,
    snuff: new Float32Array(n),
    snuffId: new Int32Array(n).fill(-1),
    danger: new Float32Array(n),
    wisps: [],
    wispT: diff.wispEvery,
    footT: 0,
    habit: {},
    chain: 0,
    bestCombo: 0,
    scares: 0,
    fleeLeft: 0,
    helpers: true,
    over: null,
    events: [],
  }
}

// Advances the round by dt seconds. `input` null hands the player's ghost to
// the helper AI too, played like a person would (the balance bot).
export function stepWorld(w: World, input: PlayerInput | null, dt: number): WorldEvent[] {
  w.events = []
  if (w.over || dt <= 0) return w.events
  const n = Math.max(1, Math.ceil(dt / TUNING.step - 1e-6))
  const h = dt / n
  for (let k = 0; k < n && !w.over; k++) substep(w, k === 0 || !input ? input : { ...input, cast: null, swap: null }, h)
  return w.events
}

function substep(w: World, input: PlayerInput | null, h: number) {
  w.time += h
  w.swapCd = Math.max(0, w.swapCd - h)
  if (input?.swap != null && input.swap !== w.active && input.swap >= 0 && input.swap < w.ghosts.length && w.swapCd <= 0) {
    w.active = input.swap
    w.swapCd = TUNING.swapCooldown
    w.events.push({ type: 'swap', ghost: w.ghosts[w.active].id })
  }

  w.ghosts.forEach((g, gi) => {
    tickGhost(w, g, h)
    if (g.respawn > 0) return
    const player = !!input && gi === w.active
    const cmd: GhostCommand = player
      ? { mx: input.mx, my: input.my, slot: input.cast, face: input.face ?? undefined }
      : w.helpers
        ? helperCommand(w, g, h, !input && gi === w.active)
        : { mx: 0, my: 0, slot: null }
    if (cmd.face !== undefined && g.hidden <= 0 && g.invisible <= 0) g.facing = cmd.face
    if (cmd.slot !== null && castSlot(w, g, cmd.slot, cmd.aim) && !player) helperCooldown(w, g, !input && gi === w.active)
    if (tickAbilities(w, g, h)) return
    moveGhost(w, g, cmd.mx, cmd.my, h)
    if (g.moved && (!player || input.face === null)) g.facing = Math.atan2(cmd.my, cmd.mx)
  })

  tickHazards(w, h)
  stepIntruder(w, h)
  decayFear(w, h)
  const cool = Math.pow(0.5, h / TUNING.dangerHalfLife)
  for (let i = 0; i < w.danger.length; i++) if (w.danger[i] > 0) w.danger[i] = w.danger[i] < 0.01 ? 0 : w.danger[i] * cool
  w.ecto = Math.min(TUNING.ectoMax, w.ecto + TUNING.ectoRegen * w.diff.ectoMul * h)
  tickWisps(w, h)
}

export interface RoundResult {
  outcome: 'won' | 'lost'
  stars: number
  sweetsLeft: number // fraction of the manor's sweets
  scares: number
  bestCombo: number
  time: number
}

export function starsFor(leftFraction: number): number {
  return leftFraction >= 0.5 ? 3 : leftFraction >= 0.25 ? 2 : 1
}

export function roundResult(w: World): RoundResult {
  const won = w.over === 'won'
  const left = (won ? w.fleeLeft : w.sweetsLeft) / Math.max(1, w.sweetsTotal)
  return { outcome: won ? 'won' : 'lost', stars: won ? starsFor(left) : 0, sweetsLeft: left, scares: w.scares, bestCombo: w.bestCombo, time: w.time }
}
