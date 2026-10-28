// The helper AI that flies the ghosts the player isn't controlling. Each
// ghost has its own style, from the spec: Ember tails Snaxley and Swoops when
// he looks away, Blush waits in a wall on his route, Drizzle slimes the
// hallway ahead, Marm lurks behind a wall close enough to thump through it.
// In a Sugar Rush they all run. Helpers wait a few seconds between abilities
// and keep some ecto back for the player, so they help without stealing the
// show.
import { ABILITIES } from './config'
import { canCast, slotAbility } from './abilities'
import { ghostTile, houseHome } from './ghosts'
import { FLOOR, HOUSE, HOUSE_DOOR, corridorRun, ghostBlocked, isIntersection, lineOfSight, neighbors, tileX, tileY } from './maze'
import { dijkstra, pathTo, type CostFn } from './path'
import type { Ghost, World } from './types'

export interface GhostCommand {
  mx: number
  my: number
  slot: number | null
  aim?: number
  face?: number
}

// Ecto helpers leave in the pool for the player's own ghost.
const RESERVE = 40
const AIM_RANGE = 3
const THINK = 0.4

function ghostCost(w: World): CostFn {
  const m = w.maze
  return (i) => (ghostBlocked(m, tileX(m, i), tileY(m, i)) ? Infinity : 1)
}

// Follows a path to `goal`, replanning every half second.
function steer(w: World, g: Ghost, goal: number, dt: number): { mx: number; my: number } {
  const m = w.maze
  g.ai.replan -= dt
  if (goal !== g.ai.goal || g.ai.replan <= 0) {
    g.ai.goal = goal
    g.ai.replan = 0.5
    const start = ghostTile(w, g)
    g.ai.path = start >= 0 && goal >= 0 ? pathTo(dijkstra(m.w, m.h, start, ghostCost(w)), start, goal) : []
  }
  const path = g.ai.path
  while (path.length && Math.hypot(tileX(m, path[0]) - g.x, tileY(m, path[0]) - g.y) < 0.25) path.shift()
  const to = path[0] ?? goal
  if (to < 0) return { mx: 0, my: 0 }
  const dx = tileX(m, to) - g.x
  const dy = tileY(m, to) - g.y
  const d = Math.hypot(dx, dy)
  return d < 0.08 ? { mx: 0, my: 0 } : { mx: dx / d, my: dy / d }
}

// Re-picks the goal every THINK seconds; otherwise keeps the last one.
function goalEvery(g: Ghost, pick: () => number): number {
  if (g.ai.think <= 0 || g.ai.goal < 0) {
    g.ai.think = THINK
    return pick()
  }
  return g.ai.goal
}

function afford(w: World, g: Ghost, slot: number, asPlayer: boolean): boolean {
  if (canCast(w, g, slot)) return false
  const id = slotAbility(w, g, slot)
  return !!id && w.ecto >= ABILITIES[id].cost + (asPlayer ? 0 : RESERVE)
}

function near(w: World, g: Ghost, tile: number, range = AIM_RANGE) {
  return Math.hypot(tileX(w.maze, tile) - g.x, tileY(w.maze, tile) - g.y) <= range
}

// Somewhere well away from him, preferring the Ghost House.
function escapeGoal(w: World, g: Ghost): number {
  const m = w.maze
  const it = w.intruder
  const start = ghostTile(w, g)
  if (start < 0) return -1
  const field = dijkstra(m.w, m.h, start, ghostCost(w))
  let best = start
  let bestScore = -Infinity
  for (let i = 0; i < m.cells.length; i++) {
    const d = field.dist[i]
    if (d === Infinity || d > 7) continue
    const safe = m.cells[i] === HOUSE || m.cells[i] === HOUSE_DOOR ? 4 : 0
    const s = Math.hypot(tileX(m, i) - it.x, tileY(m, i) - it.y) + safe - 0.2 * d
    if (s > bestScore) {
      bestScore = s
      best = i
    }
  }
  return best
}

// A tile within thumping range of him that he can't see from where he is.
function lurkGoal(w: World, g: Ghost): number {
  const m = w.maze
  const it = w.intruder
  let best = -1
  let bestScore = Infinity
  for (let y = Math.floor(it.y - 3); y <= Math.ceil(it.y + 3); y++) {
    for (let x = Math.floor(it.x - 3); x <= Math.ceil(it.x + 3); x++) {
      if (ghostBlocked(m, x, y)) continue
      const d = Math.hypot(x - it.x, y - it.y)
      if (d < 1.2 || d > 2.3) continue
      const hidden = !lineOfSight(m, it.x, it.y, x, y)
      const s = Math.hypot(x - g.x, y - g.y) + (hidden ? 0 : 6)
      if (s < bestScore) {
        bestScore = s
        best = y * m.w + x
      }
    }
  }
  return best >= 0 ? best : it.cur
}

// The nearest wisp worth a detour when ecto is low.
function wispGoal(w: World, g: Ghost): number {
  if (w.ecto >= 60) return -1
  let best = -1
  let bestD = 6
  for (const p of w.wisps) {
    const d = Math.hypot(p.x - g.x, p.y - g.y)
    if (d < bestD) {
      bestD = d
      best = p.y * w.maze.w + p.x
    }
  }
  return best
}

// `asPlayer` plays the ghost like a decent human would (the balance bot):
// no ecto reserve, and ultimates allowed.
export function helperCommand(w: World, g: Ghost, dt: number, asPlayer: boolean): GhostCommand {
  const it = w.intruder
  const m = w.maze
  const d = Math.hypot(it.x - g.x, it.y - g.y)
  const ready = g.ai.wait <= 0
  const toward = Math.atan2(it.y - g.y, it.x - g.x)
  const idle = { mx: 0, my: 0, slot: null }

  if (it.state === 'flee') return { ...steer(w, g, m.house[0], dt), slot: null }

  if (it.rush > 0) {
    if (d < 1.1 && afford(w, g, 0, asPlayer)) return { ...idle, slot: 0 }
    if (d < 3 && afford(w, g, 1, asPlayer) && !w.hazards.some((h) => h.kind === 'decoy')) return { ...idle, slot: 1 }
    if (d < 2.2 && w.fear >= 30 && afford(w, g, 2, asPlayer)) return { ...idle, slot: 2 }
    if (g.boost > 0) {
      const home = houseHome(w)
      return { ...steer(w, g, home.y * m.w + home.x, dt), slot: null }
    }
    if (d > 9) return { ...idle }
    return { ...steer(w, g, goalEvery(g, () => escapeGoal(w, g)), dt), slot: null }
  }

  const path = it.path
  const ahead = (k: number) => path[Math.min(path.length - 1, k)] ?? it.cur
  const wisp = d > 6 ? wispGoal(w, g) : -1

  switch (g.id) {
    case 'ember': {
      if (ready && d >= 1 && d <= 3 && g.seen < 0.5 && afford(w, g, 0, asPlayer)) return { ...idle, slot: 0, face: toward }
      const here = ghostTile(w, g)
      if (ready && d < 5 && afford(w, g, 1, asPlayer) && here >= 0) {
        const run = corridorRun(m, here)
        if (run.includes(it.cur) || run.includes(ahead(0))) return { ...idle, slot: 1 }
      }
      if (asPlayer && d <= 6 && afford(w, g, 2, asPlayer)) return { ...idle, slot: 2 }
      // Hang back a few tiles behind him, out of earshot.
      const back = it.trail.length >= 4 ? it.trail[it.trail.length - 4] : it.cur
      if (d < 2) return { ...idle, face: toward }
      return { ...steer(w, g, wisp >= 0 ? wisp : back, dt), slot: null }
    }
    case 'blush': {
      if (g.hidden > 0) return { ...idle, slot: d > 9 ? 0 : null }
      if (asPlayer && d <= 5 && afford(w, g, 2, asPlayer)) return { ...idle, slot: 2 }
      const spot = goalEvery(g, () => (wisp >= 0 ? wisp : ahead(4)))
      const there = Math.hypot(tileX(m, spot) - g.x, tileY(m, spot) - g.y) < 0.35
      if (there && ready && d >= 1.8 && d <= 7 && afford(w, g, 0, asPlayer)) return { ...idle, slot: 0, face: toward }
      const block = ahead(2)
      if (ready && d <= 5 && path.length > 3 && near(w, g, block) && afford(w, g, 1, asPlayer) && w.rng.next() < 0.05) return { ...idle, slot: 1, aim: block }
      return { ...steer(w, g, spot, dt), slot: null }
    }
    case 'drizzle': {
      if (asPlayer && d <= 2.5 && afford(w, g, 2, asPlayer)) return { ...idle, slot: 2 }
      if (ready && afford(w, g, 0, asPlayer)) {
        for (let k = 1; k <= 4 && k < path.length; k++) {
          const t = path[k]
          if (near(w, g, t) && Math.hypot(tileX(m, t) - it.x, tileY(m, t) - it.y) >= 1.5) return { ...idle, slot: 0, aim: t }
        }
      }
      const here = ghostTile(w, g)
      if (ready && d >= 3 && d <= 7 && afford(w, g, 1, asPlayer) && !w.hazards.some((h) => h.kind === 'trick' && h.ghost === g.id)) {
        if (here >= 0 && m.cells[here] === FLOOR) return { ...idle, slot: 1, aim: here }
      }
      return { ...steer(w, g, goalEvery(g, () => (wisp >= 0 ? wisp : ahead(3))), dt), slot: null }
    }
    case 'marm': {
      if (asPlayer && afford(w, g, 2, asPlayer)) {
        const soon = [it.cur, it.next, ...path.slice(0, 3)]
        const here = ghostTile(w, g)
        const close = here >= 0 ? [here, ...neighbors(m, here)].flatMap((i) => [i, ...neighbors(m, i)]) : []
        if (close.some((i) => isIntersection(m, i) && soon.includes(i))) return { ...idle, slot: 2 }
      }
      if (ready && d <= 2.4 && afford(w, g, 0, asPlayer)) return { ...idle, slot: 0 }
      if (ready && d >= 3 && d <= 7 && afford(w, g, 1, asPlayer) && w.rng.next() < 0.03) {
        // Wail from the side away from the other ghosts, to push him to them.
        const others = w.ghosts.filter((o) => o !== g && o.respawn <= 0)
        const cx = others.reduce((s, o) => s + o.x, 0) / Math.max(1, others.length)
        const cy = others.reduce((s, o) => s + o.y, 0) / Math.max(1, others.length)
        const len = Math.hypot(it.x - cx, it.y - cy) || 1
        const sx = it.x + ((it.x - cx) / len) * 3
        const sy = it.y + ((it.y - cy) / len) * 3
        return { ...idle, slot: 1, face: Math.atan2(sy - g.y, sx - g.x) }
      }
      return { ...steer(w, g, goalEvery(g, () => (wisp >= 0 ? wisp : lurkGoal(w, g))), dt), slot: null }
    }
  }
}

// After a helper uses an ability, it waits a little before the next.
export function helperCooldown(w: World, g: Ghost, asPlayer: boolean) {
  g.ai.wait = asPlayer ? w.rng.range(0.8, 1.6) : w.rng.range(3.5, 6)
}
