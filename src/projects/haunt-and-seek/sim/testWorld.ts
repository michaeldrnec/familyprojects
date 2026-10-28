// Shared set-up for the rules tests: a quiet round in a known manor with
// Snaxley and the ghosts placed by hand.
import type { DifficultyId, GhostId } from './config'
import type { World } from './types'
import { newWorld } from './world'

export const IDLE = { mx: 0, my: 0, face: null, cast: null, swap: null }

export function quietWorld(manor = 2, difficulty: DifficultyId = 'spooky', seed = 7): World {
  const w = newWorld(manor, difficulty, seed)
  w.helpers = false
  return w
}

export function placeIntruder(w: World, x: number, y: number, dirX = 1, dirY = 0) {
  const it = w.intruder
  const i = y * w.maze.w + x
  it.cur = i
  it.next = i
  it.p = 0
  it.x = x
  it.y = y
  it.dirX = dirX
  it.dirY = dirY
  it.look = Math.atan2(dirY, dirX)
  it.wait = 0
}

// Holds him in place (for tests about the ghosts, not his walking).
export function freeze(w: World) {
  w.intruder.status.frozen = 1000
}

export function placeGhost(w: World, id: GhostId, x: number, y: number, facing = 0) {
  const g = w.ghosts.find((gh) => gh.id === id)!
  g.x = x
  g.y = y
  g.facing = facing
  w.active = w.ghosts.indexOf(g)
  return g
}
