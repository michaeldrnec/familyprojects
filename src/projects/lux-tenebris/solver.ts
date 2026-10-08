// Level-check solver (used by the level check script, not the game): a
// breadth-first search over (position, key held, plates flipped) using the
// real rules in logic.ts, so a level that checks out here plays the same
// in the game. Also reports how many steps of the shortest route are lit.
import { initialState, step, type PlayState } from './logic'
import { parseLevel } from './tiles'
import type { Level } from './levels'

const DIRS = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
]

export interface SolveResult {
  solvable: boolean
  steps: number
  litSteps: number // steps taken while the battery still had charge
  darkSteps: number
  path: { x: number; y: number }[] // tiles of the shortest route, start to exit
}

function key(s: PlayState): string {
  return `${s.x},${s.y},${s.haveKey ? 1 : 0},${s.flipped ? 1 : 0}`
}

export function solve(level: Level): SolveResult {
  const grid = parseLevel(level.map)
  const start = initialState(level, grid)
  const seen = new Set([key(start)])
  let frontier: { state: PlayState; path: PlayState[] }[] = [{ state: start, path: [start] }]
  while (frontier.length) {
    const next: typeof frontier = []
    for (const { state, path } of frontier) {
      for (const d of DIRS) {
        const { state: s2, events } = step(grid, state, { type: 'move', ...d })
        if (events.includes('bump') || s2.status === 'fallen') continue
        if (s2.status === 'won') {
          // Replay battery along the found path (cells picked up en route).
          const full = [...path, s2]
          let lit = 0
          for (let i = 1; i < full.length; i++) if (full[i - 1].battery > 0) lit++
          return { solvable: true, steps: s2.steps, litSteps: lit, darkSteps: s2.steps - lit, path: full.map((p) => ({ x: p.x, y: p.y })) }
        }
        const k = key(s2)
        if (seen.has(k)) continue
        seen.add(k)
        next.push({ state: s2, path: [...path, s2] })
      }
    }
    frontier = next
  }
  return { solvable: false, steps: 0, litSteps: 0, darkSteps: 0, path: [] }
}
