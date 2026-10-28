// The ghosts' abilities: which one sits in each slot right now, whether it
// can be used, what it does, and the upkeep of the ones that last (a Swoop
// in flight, Blush in the wall, Ember tiptoeing behind him).
//
// The player and the helper AI both cast through castSlot(), aiming at a
// tile; the player's aim is the tile in front of the ghost.
import { ABILITIES, DEFENSE, ghostDef, type AbilityId } from './config'
import type { DenyReason } from './events'
import { fearOverTime, loseFear, scare, spook } from './fear'
import { pushOut } from './ghosts'
import { addHazard } from './hazards'
import { canEnter, enterSnuff, interruptMunch } from './intruder'
import { FLOOR, corridorRun, ghostBlocked, isIntersection, neighbors, tileAt, tileX, tileY } from './maze'
import type { Ghost, World } from './types'

const SWOOP_SPEED = 10
const SWOOP_REACH = 3
const SWOOP_SCARE = 1.5
const WALLFLOWER_TIME = 15
const BURST_TRIGGER = 1.2
const BURST_RANGE = 2
const BEHIND_TIME = 6
const AIM_RANGE = 3.2

export function slotAbility(w: World, g: Ghost, slot: number): AbilityId | null {
  if (w.intruder.rush > 0) return DEFENSE[slot] ?? null
  if (slot === 2 && !w.manor.ultimates) return null
  return ghostDef(g.id).abilities[slot] ?? null
}

const dist = (g: Ghost, w: World) => Math.hypot(g.x - w.intruder.x, g.y - w.intruder.y)

// The tile a ghost aims at: the one in front of it, or its own.
export function frontTile(w: World, g: Ghost): number {
  const m = w.maze
  const ahead = tileAt(m, g.x + Math.cos(g.facing), g.y + Math.sin(g.facing))
  if (ahead >= 0 && m.cells[ahead] === FLOOR) return ahead
  return tileAt(m, g.x, g.y)
}

// Whether the ability in `slot` could be used right now (ignoring aim).
export function canCast(w: World, g: Ghost, slot: number): DenyReason | null {
  const id = slotAbility(w, g, slot)
  if (!id || w.over || w.intruder.state === 'flee') return 'locked'
  // Blush bursting back out of the wall is free.
  if (id === 'wallflower' && g.hidden > 0) return null
  if (g.respawn > 0 || g.dash || g.hidden > 0 || g.invisible > 0) return 'busy'
  const def = ABILITIES[id]
  if ((g.cd[id] ?? 0) > 0) return 'cooldown'
  if (w.ecto < def.cost) return 'ecto'
  if (def.fearCost && w.fear < def.fearCost) return 'ecto'
  return null
}

export function castSlot(w: World, g: Ghost, slot: number, aim?: number): boolean {
  const deny = canCast(w, g, slot)
  const id = slotAbility(w, g, slot)
  if (deny || !id) {
    w.events.push({ type: 'denied', ghost: g.id, reason: deny ?? 'locked' })
    return false
  }
  const target = aim ?? frontTile(w, g)
  const result = CAST[id](w, g, target)
  if (result) {
    w.events.push({ type: 'denied', ghost: g.id, reason: result })
    return false
  }
  return true
}

// Charges the cost, starts the cooldown and announces the cast.
function spend(w: World, g: Ghost, id: AbilityId, x = g.x, y = g.y) {
  const def = ABILITIES[id]
  w.ecto -= def.cost
  if (def.fearCost) loseFear(w, def.fearCost, false)
  g.cd[id] = def.cooldown
  w.events.push({ type: 'cast', ghost: g.id, ability: id, x, y })
}

function aimOk(w: World, g: Ghost, tile: number): boolean {
  const m = w.maze
  return tile >= 0 && m.cells[tile] === FLOOR && Math.hypot(tileX(m, tile) - g.x, tileY(m, tile) - g.y) <= AIM_RANGE
}

type Cast = (w: World, g: Ghost, tile: number) => DenyReason | null

const CAST: Record<AbilityId, Cast> = {
  swoop(w, g) {
    const dx = Math.cos(g.facing)
    const dy = Math.sin(g.facing)
    let reach = 0
    for (let d = SWOOP_REACH; d >= 0.5; d -= 0.25) {
      if (!ghostBlocked(w.maze, Math.round(g.x + dx * d), Math.round(g.y + dy * d))) {
        reach = d
        break
      }
    }
    if (!reach) return 'aim'
    spend(w, g, 'swoop')
    const t = reach / SWOOP_SPEED
    g.dash = { vx: dx * SWOOP_SPEED, vy: dy * SWOOP_SPEED, t, scared: false }
    g.noclip = t + 0.02
    return null
  },

  snuff(w, g) {
    const here = tileAt(w.maze, g.x, g.y)
    if (here < 0 || ghostBlocked(w.maze, tileX(w.maze, here), tileY(w.maze, here))) return 'aim'
    spend(w, g, 'snuff')
    const id = w.nextId++
    const run = corridorRun(w.maze, here)
    for (const i of run) {
      w.snuff[i] = 8
      w.snuffId[i] = id
    }
    const it = w.intruder
    if (run.includes(it.cur) || run.includes(it.next)) enterSnuff(w, run.includes(it.cur) ? it.cur : it.next)
    return null
  },

  behind(w, g) {
    if (dist(g, w) > 7) return 'range'
    spend(w, g, 'behind')
    g.invisible = BEHIND_TIME
    g.noclip = BEHIND_TIME + 0.6
    return null
  },

  wallflower(w, g) {
    if (g.hidden > 0) {
      burst(w, g)
      return null
    }
    const m = w.maze
    const cx = Math.round(g.x)
    const cy = Math.round(g.y)
    if (ghostBlocked(m, cx, cy)) return 'aim'
    // The wall nearest the way she's facing.
    const dirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ].filter((d) => ghostBlocked(m, cx + d.x, cy + d.y))
    if (!dirs.length) return 'aim'
    const fx = Math.cos(g.facing)
    const fy = Math.sin(g.facing)
    dirs.sort((a, b) => b.x * fx + b.y * fy - (a.x * fx + a.y * fy))
    spend(w, g, 'wallflower')
    g.cd.wallflower = 0 // starts when she bursts out
    g.x = cx
    g.y = cy
    g.hidden = WALLFLOWER_TIME
    g.hideDir = dirs[0]
    return null
  },

  mirror(w, g, tile) {
    const it = w.intruder
    if (!aimOk(w, g, tile) || tile === it.cur || tile === it.next) return 'aim'
    spend(w, g, 'mirror', tileX(w.maze, tile), tileY(w.maze, tile))
    addHazard(w, 'mirror', tile, g.id, 12)
    return null
  },

  hallway(w, g) {
    if (dist(g, w) > 6) return 'range'
    spend(w, g, 'hallway', w.intruder.x, w.intruder.y)
    interruptMunch(w, 0)
    w.intruder.status.treadmill = 6
    w.events.push({ type: 'bark', kind: 'treadmill' })
    return null
  },

  slime(w, g, tile) {
    if (!aimOk(w, g, tile)) return 'aim'
    spend(w, g, 'slime', tileX(w.maze, tile), tileY(w.maze, tile))
    addHazard(w, 'slime', tile, g.id, 10)
    return null
  },

  trick(w, g, tile) {
    if (!aimOk(w, g, tile) || !canEnter(w, tile)) return 'aim'
    spend(w, g, 'trick', tileX(w.maze, tile), tileY(w.maze, tile))
    addHazard(w, 'trick', tile, g.id, 25)
    return null
  },

  party(w, g) {
    const here = tileAt(w.maze, g.x, g.y)
    if (here < 0) return 'aim'
    spend(w, g, 'party')
    addHazard(w, 'party', here, g.id, 7)
    return null
  },

  thump(w, g) {
    spend(w, g, 'thump')
    if (dist(g, w) <= 2.5) {
      interruptMunch(w, 2)
      w.intruder.status.stumble = Math.max(w.intruder.status.stumble, 0.8)
      scare(w, g.id, 'thump', ABILITIES.thump.fear, { x: g.x, y: g.y, spook: 1.5 })
    }
    return null
  },

  wail(w, g) {
    const m = w.maze
    const sx = Math.min(m.w - 1, Math.max(0, g.x + Math.cos(g.facing) * 4))
    const sy = Math.min(m.h - 1, Math.max(0, g.y + Math.sin(g.facing) * 4))
    const tile = tileAt(m, sx, sy)
    spend(w, g, 'wail', sx, sy)
    addHazard(w, 'wail', tile, g.id, 6)
    const it = w.intruder
    const d = Math.hypot(it.x - sx, it.y - sy)
    if (d <= 9) {
      it.alert = 6
      it.alertAt = { x: sx, y: sy }
      scare(w, g.id, 'wail', ABILITIES.wail.fear, { x: sx, y: sy, subtle: true })
      if (d <= 3 && it.state === 'forage') spook(w, sx, sy, 1.2)
    }
    return null
  },

  goo(w, g) {
    const m = w.maze
    const here = tileAt(m, g.x, g.y)
    // The nearest crossroads within two steps; else right here.
    let spot = -1
    const seen = new Set([here])
    let ring = [here]
    for (let r = 0; r <= 2 && spot < 0; r++) {
      spot = ring.find((i) => isIntersection(m, i)) ?? -1
      const next: number[] = []
      for (const i of ring) {
        for (const n of neighbors(m, i)) {
          if (seen.has(n) || ghostBlocked(m, tileX(m, n), tileY(m, n))) continue
          seen.add(n)
          next.push(n)
        }
      }
      ring = next
    }
    if (spot < 0) spot = m.cells[here] === FLOOR ? here : -1
    if (spot < 0) return 'aim'
    spend(w, g, 'goo', tileX(m, spot), tileY(m, spot))
    const h = addHazard(w, 'goo', spot, g.id, 6)
    const it = w.intruder
    if (Math.hypot(it.x - h.x, it.y - h.y) < 0.6) {
      it.status.stuck = h.t
      w.events.push({ type: 'bark', kind: 'stuck' })
    }
    return null
  },

  slip(w, g) {
    spend(w, g, 'slip')
    g.noclip = 1.2
    g.intangible = 1.2
    return null
  },

  decoy(w, g) {
    const m = w.maze
    const here = tileAt(m, g.x, g.y)
    const spot = [here, ...neighbors(m, here)].find((i) => canEnter(w, i))
    if (spot === undefined) return 'aim'
    spend(w, g, 'decoy', tileX(m, spot), tileY(m, spot))
    addHazard(w, 'decoy', spot, g.id, 10)
    return null
  },

  dash(w, g) {
    spend(w, g, 'dash')
    g.boost = 3
    return null
  },
}

// Blush bursts out of the wall; a scare if he's close enough.
function burst(w: World, g: Ghost) {
  const sneaky = g.seen < 0.05
  g.hidden = 0
  g.cd.wallflower = ABILITIES.wallflower.cooldown
  w.events.push({ type: 'cast', ghost: g.id, ability: 'wallflower', x: g.x, y: g.y })
  if (dist(g, w) <= BURST_RANGE && w.intruder.rush <= 0) scare(w, g.id, 'wallflower', ABILITIES.wallflower.fear, { x: g.x, y: g.y, drop: 3, spook: 2.5, bonus: sneaky ? 5 : 0 })
}

// Upkeep for abilities that last. Returns true while the ability is moving
// the ghost (so neither the player nor the AI steers it).
export function tickAbilities(w: World, g: Ghost, dt: number): boolean {
  const it = w.intruder
  if (g.dash) {
    g.x += g.dash.vx * dt
    g.y += g.dash.vy * dt
    g.x = Math.min(w.maze.w - 1, Math.max(0, g.x))
    g.y = Math.min(w.maze.h - 1, Math.max(0, g.y))
    g.moved = true
    if (!g.dash.scared && dist(g, w) <= SWOOP_SCARE && it.rush <= 0) {
      g.dash.scared = true
      scare(w, g.id, 'swoop', ABILITIES.swoop.fear, { x: g.x, y: g.y, drop: 1, spook: 2 })
    }
    g.dash.t -= dt
    if (g.dash.t <= 0) {
      g.dash = null
      g.noclip = 0
      pushOut(w, g)
    }
    return true
  }
  if (g.hidden > 0) {
    g.moved = false
    g.hidden -= dt
    if (g.hidden <= 0) {
      // Waited too long: she slips back out without a scare.
      g.hidden = 0
      g.cd.wallflower = ABILITIES.wallflower.cooldown
    } else if (dist(g, w) < BURST_TRIGGER && it.rush <= 0 && it.state !== 'flee') burst(w, g)
    return true
  }
  if (g.invisible > 0) {
    // Tiptoeing right behind him.
    const tx = it.x - Math.cos(it.look) * 0.9
    const ty = it.y - Math.sin(it.look) * 0.9
    const d = Math.hypot(tx - g.x, ty - g.y)
    const step = Math.min(d, 7 * dt)
    if (d > 1e-6) {
      g.x += ((tx - g.x) / d) * step
      g.y += ((ty - g.y) / d) * step
    }
    g.facing = it.look
    g.moved = false
    fearOverTime(w, 3, dt, true) // the footsteps
    w.footT -= dt
    if (w.footT <= 0) {
      w.footT = 0.45
      w.events.push({ type: 'footstep', x: g.x, y: g.y })
    }
    g.invisible -= dt
    if (g.invisible <= 0 || it.state === 'flee') {
      g.invisible = 0
      g.noclip = 0.4
      if (it.state !== 'flee' && it.rush <= 0) {
        scare(w, g.id, 'behind', ABILITIES.behind.fear, { x: g.x, y: g.y })
        if (w.intruder.state !== 'flee') it.status.blind = 3
      }
    }
    return true
  }
  return false
}

