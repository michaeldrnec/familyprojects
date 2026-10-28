// Ghost movement: floating on the plane, sliding along stone walls (with a
// nudge round corners so turning into a side passage isn't fiddly), passing
// through walls only while an ability allows it. Also the Ghost House
// respawn and the ecto wisps.
import { TUNING } from './config'
import { FLOOR, ghostBlocked, tileAt, tileX, tileY } from './maze'
import type { Ghost, World } from './types'

const R = TUNING.ghostRadius

function overlapsWall(w: World, x: number, y: number): boolean {
  for (let cy = Math.round(y - R); cy <= Math.round(y + R); cy++) {
    for (let cx = Math.round(x - R); cx <= Math.round(x + R); cx++) {
      if (!ghostBlocked(w.maze, cx, cy)) continue
      // The square collider overlaps cell (cx, cy)?
      if (Math.abs(x - cx) < 0.5 + R - 1e-6 && Math.abs(y - cy) < 0.5 + R - 1e-6) return true
    }
  }
  return false
}

// Moves along one axis, stopping flush against the first wall.
function slide(w: World, g: Ghost, dx: number, dy: number) {
  const nx = g.x + dx
  const ny = g.y + dy
  if (!overlapsWall(w, nx, ny)) {
    g.x = nx
    g.y = ny
    return true
  }
  if (dx) g.x = dx > 0 ? Math.round(nx + R) - 0.5 - R : Math.round(nx - R) + 0.5 + R
  if (dy) g.y = dy > 0 ? Math.round(ny + R) - 0.5 - R : Math.round(ny - R) + 0.5 + R
  if (overlapsWall(w, g.x, g.y)) {
    g.x = nx - dx
    g.y = ny - dy
  }
  return false
}

function clampToMap(w: World, g: Ghost) {
  g.x = Math.min(w.maze.w - 1, Math.max(0, g.x))
  g.y = Math.min(w.maze.h - 1, Math.max(0, g.y))
}

export function ghostSpeed(g: Ghost) {
  return TUNING.ghostSpeed * (g.boost > 0 ? 2 : 1)
}

// Moves a free-flying ghost by (mx, my) × speed; |(mx, my)| ≤ 1.
export function moveGhost(w: World, g: Ghost, mx: number, my: number, dt: number) {
  const len = Math.hypot(mx, my)
  g.moved = len > 0.1
  if (!g.moved) return
  const sp = ghostSpeed(g) * dt * Math.min(1, len)
  const dx = (mx / len) * sp
  const dy = (my / len) * sp
  if (g.noclip > 0) {
    g.x += dx
    g.y += dy
    clampToMap(w, g)
    return
  }
  const movedX = Math.abs(dx) < 1e-9 || slide(w, g, dx, 0)
  const movedY = Math.abs(dy) < 1e-9 || slide(w, g, 0, dy)
  // Corner nudge: blocked going one way, but the tile that way from the
  // nearest tile center is open? Ease toward that center so the ghost lines
  // up with the side passage.
  if (!movedX && Math.abs(dx) > Math.abs(dy) * 0.5) nudge(w, g, Math.sign(dx), 0, sp)
  if (!movedY && Math.abs(dy) > Math.abs(dx) * 0.5) nudge(w, g, 0, Math.sign(dy), sp)
}

function nudge(w: World, g: Ghost, sx: number, sy: number, amount: number) {
  const cx = Math.round(g.x)
  const cy = Math.round(g.y)
  if (ghostBlocked(w.maze, cx + sx, cy + sy)) return
  if (sx) {
    const d = cy - g.y
    if (Math.abs(d) > 0.45) return
    slide(w, g, 0, Math.sign(d) * Math.min(Math.abs(d), amount))
  } else {
    const d = cx - g.x
    if (Math.abs(d) > 0.45) return
    slide(w, g, Math.sign(d) * Math.min(Math.abs(d), amount), 0)
  }
}

// After passing through walls: out to the nearest open tile.
export function pushOut(w: World, g: Ghost) {
  if (!overlapsWall(w, g.x, g.y)) return
  const m = w.maze
  const start = { x: Math.round(g.x), y: Math.round(g.y) }
  let best: { x: number; y: number } | null = null
  let bestD = Infinity
  for (let r = 0; r <= Math.max(m.w, m.h) && !best; r++) {
    for (let y = start.y - r; y <= start.y + r; y++) {
      for (let x = start.x - r; x <= start.x + r; x++) {
        if (ghostBlocked(m, x, y)) continue
        const d = Math.hypot(x - g.x, y - g.y)
        if (d < bestD) {
          bestD = d
          best = { x, y }
        }
      }
    }
  }
  if (best) {
    g.x = best.x
    g.y = best.y
  }
}

export function houseHome(w: World): { x: number; y: number } {
  const m = w.maze
  const i = m.house[Math.floor(m.house.length / 2)]
  return { x: tileX(m, i), y: tileY(m, i) }
}

// Timers that run for every ghost each step.
export function tickGhost(w: World, g: Ghost, dt: number) {
  for (const k of Object.keys(g.cd) as (keyof typeof g.cd)[]) g.cd[k] = Math.max(0, (g.cd[k] ?? 0) - dt)
  g.boost = Math.max(0, g.boost - dt)
  g.intangible = Math.max(0, g.intangible - dt)
  g.ai.wait = Math.max(0, g.ai.wait - dt)
  g.ai.think = Math.max(0, g.ai.think - dt)
  if (g.noclip > 0) {
    g.noclip -= dt
    if (g.noclip <= 0) {
      g.noclip = 0
      pushOut(w, g)
    }
  }
  if (g.respawn > 0) {
    g.respawn -= dt
    g.moved = false
    if (g.respawn <= 0) {
      g.respawn = 0
      const home = houseHome(w)
      g.x = home.x
      g.y = home.y
      w.events.push({ type: 'respawn', ghost: g.id })
    }
  }
}

// Wisps of spectral residue drift into quiet corners; any ghost collects them.
export function tickWisps(w: World, dt: number) {
  const m = w.maze
  w.wispT -= dt
  if (w.wispT <= 0) {
    w.wispT = w.diff.wispEvery
    if (w.wisps.length < TUNING.wispMax) {
      for (let tries = 0; tries < 30; tries++) {
        const i = w.rng.int(0, m.cells.length)
        if (m.cells[i] !== FLOOR) continue
        const x = tileX(m, i)
        const y = tileY(m, i)
        if (Math.hypot(x - w.intruder.x, y - w.intruder.y) < TUNING.wispMinDist) continue
        if (w.wisps.some((p) => p.x === x && p.y === y)) continue
        w.wisps.push({ x, y })
        break
      }
    }
  }
  for (const g of w.ghosts) {
    if (g.respawn > 0) continue
    for (let k = w.wisps.length - 1; k >= 0; k--) {
      const p = w.wisps[k]
      if (Math.hypot(p.x - g.x, p.y - g.y) < TUNING.wispPickup) {
        w.wisps.splice(k, 1)
        w.ecto = Math.min(TUNING.ectoMax, w.ecto + TUNING.wispValue)
        w.events.push({ type: 'wisp', x: p.x, y: p.y })
      }
    }
  }
}

export const ghostTile = (w: World, g: Ghost) => tileAt(w.maze, g.x, g.y)
