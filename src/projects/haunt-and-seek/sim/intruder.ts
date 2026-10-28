// Snaxley: what he sees and hears, where he decides to go, and how he moves.
//
// He walks tile to tile along tile centers. Each time he reaches one he
// eats what's there, trips any trap, and picks the next tile from his state:
// foraging (Dijkstra to the best-looking cluster of sweets), spooked (away
// from the scare), fleeing (to the front door) or Sugar Rush (after a ghost).
// Status effects (stumbling, confusion, goo...) sit on top of the state.
import { ABILITIES, TUNING } from './config'
import { hunger, scare, startFlee } from './fear'
import { hazardAt, removeHazard } from './hazards'
import { DOOR, FLOOR, HOUSE, HOUSE_DOOR, lineOfSight, neighbors, tileAt, tileX, tileY } from './maze'
import { dijkstra, pathTo, type CostFn } from './path'
import type { Ghost, World } from './types'

const TRAIL = 12

// Tiles he will step onto by choice. Mirror walls look solid to him.
export function canEnter(w: World, i: number): boolean {
  const c = w.maze.cells[i]
  if (c === FLOOR) return !hazardAt(w, i, 'mirror')
  return c === DOOR && w.intruder.state === 'flee'
}

function forageCost(w: World): CostFn {
  return (i) => {
    if (!canEnter(w, i)) return Infinity
    let c = 1 + w.danger[i] * TUNING.dangerCost
    if (hazardAt(w, i, 'slime')?.seen) c += TUNING.slimeCost
    return c
  }
}

export function inHouse(w: World, g: Ghost): boolean {
  const c = w.maze.cells[tileAt(w.maze, g.x, g.y)]
  return c === HOUSE || c === HOUSE_DOOR
}

// Ghosts he can notice at all (not hidden, invisible or bonked).
export function noticeable(g: Ghost): boolean {
  return g.respawn <= 0 && g.hidden <= 0 && g.invisible <= 0
}

function angleDiff(a: number, b: number) {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

// --- Perception ---------------------------------------------------------

export function visionCone(w: World) {
  const snuffed = w.snuff[w.intruder.cur] > 0
  return {
    range: (snuffed ? TUNING.snuffRange : TUNING.visionRange) * w.manor.visionMul,
    half: snuffed ? TUNING.snuffHalfAngle : TUNING.visionHalfAngle,
  }
}

export function canSee(w: World, x: number, y: number): boolean {
  const it = w.intruder
  const { range, half } = visionCone(w)
  const d = Math.hypot(x - it.x, y - it.y)
  if (d > range) return false
  if (d > 0.4 && Math.abs(angleDiff(Math.atan2(y - it.y, x - it.x), it.look)) > half) return false
  return lineOfSight(w.maze, it.x, it.y, x, y)
}

function perceive(w: World, dt: number) {
  const it = w.intruder
  for (const g of w.ghosts) {
    if (noticeable(g) && canSee(w, g.x, g.y)) {
      g.seen = Math.min(2, g.seen + dt)
      if (!g.spotted && g.seen > 0.25) {
        g.spotted = true
        w.events.push({ type: 'spotted', ghost: g.id })
        w.events.push({ type: 'bark', kind: 'spot' })
        if (it.state === 'forage') {
          it.alert = 2
          it.alertAt = { x: g.x, y: g.y }
        }
      }
    } else {
      g.seen = Math.max(0, g.seen - TUNING.seenDecay * dt)
      if (g.seen === 0) g.spotted = false
    }
    // A ghost rustling right next to him makes him look round.
    if (g.moved && noticeable(g) && it.state === 'forage' && Math.hypot(g.x - it.x, g.y - it.y) < TUNING.hearRange) {
      it.alert = Math.max(it.alert, 1)
      it.alertAt = { x: g.x, y: g.y }
    }
  }
  for (const h of w.hazards) if (h.kind === 'slime' && !h.seen && canSee(w, h.x, h.y)) h.seen = true

  const target = it.alert > 0 ? Math.atan2(it.alertAt.y - it.y, it.alertAt.x - it.x) : Math.atan2(it.dirY, it.dirX)
  const d = angleDiff(target, it.look)
  const turn = 7 * dt
  it.look += Math.abs(d) <= turn ? d : Math.sign(d) * turn
}

// --- Choosing where to go -----------------------------------------------

function sweetValue(w: World, i: number): number {
  const m = w.maze
  let v = 0
  if (w.sweets[i]) v = 1
  if (w.gumballs[i]) v = Math.max(v, 2)
  if (hazardAt(w, i, 'trick')) v = Math.max(v, 4)
  if (!v) return 0
  const x = tileX(m, i)
  const y = tileY(m, i)
  let near = 0
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if ((!dx && !dy) || Math.abs(dx) + Math.abs(dy) > 2) continue
      const nx = x + dx
      const ny = y + dy
      if (nx >= 0 && ny >= 0 && nx < m.w && ny < m.h && w.sweets[ny * m.w + nx]) near++
    }
  }
  return v + 0.4 * near
}

function chooseForage(w: World): number {
  const it = w.intruder
  const m = w.maze
  const field = dijkstra(m.w, m.h, it.cur, forageCost(w))
  let best = -1
  let bestScore = 0
  for (let i = 0; i < m.cells.length; i++) {
    if (field.dist[i] === Infinity || i === it.cur) continue
    const v = sweetValue(w, i)
    if (!v) continue
    const s = v / (field.dist[i] + 1.5)
    if (s > bestScore) {
      bestScore = s
      best = i
    }
  }
  // Stick with the old goal unless something is clearly better, so he
  // doesn't dither between two equally good corners.
  if (it.goal >= 0 && it.goal !== best && field.dist[it.goal] < Infinity) {
    const keep = sweetValue(w, it.goal) / (field.dist[it.goal] + 1.5)
    if (keep >= bestScore * 0.85) best = it.goal
  }
  if (best < 0) {
    it.goal = -1
    it.path = []
    return wander(w, false)
  }
  it.goal = best
  it.path = pathTo(field, it.cur, best)
  return it.path[0] ?? -1
}

function openNeighbors(w: World, i: number, mirrorsLookOpen: boolean): number[] {
  return neighbors(w.maze, i).filter((n) => canEnter(w, n) || (mirrorsLookOpen && w.maze.cells[n] === FLOOR))
}

function reverseTile(w: World): number {
  const it = w.intruder
  return tileAt(w.maze, it.x - it.dirX, it.y - it.dirY)
}

// A random way on, avoiding turning back where there's a choice.
function wander(w: World, panicky: boolean, allowReverse = false): number {
  const it = w.intruder
  const opts = openNeighbors(w, it.cur, panicky)
  if (!opts.length) return -1
  const back = reverseTile(w)
  const fwd = allowReverse ? opts : opts.filter((n) => n !== back)
  const pool = fwd.length ? fwd : opts
  return pool[w.rng.int(0, pool.length)]
}

function chooseSpooked(w: World): number {
  const it = w.intruder
  const m = w.maze
  let best = -1
  let bestD = -Infinity
  for (const n of openNeighbors(w, it.cur, true)) {
    const d = Math.hypot(tileX(m, n) - it.from.x, tileY(m, n) - it.from.y) + w.rng.next() * 0.3
    if (d > bestD) {
      bestD = d
      best = n
    }
  }
  return best
}

function chooseFlee(w: World): number {
  const it = w.intruder
  const m = w.maze
  const base: CostFn = (i) => (canEnter(w, i) ? 1 : Infinity)
  let path = pathTo(dijkstra(m.w, m.h, it.cur, base), it.cur, m.door)
  // A mirror wall in the only way out: he'll run straight through it.
  if (!path.length) {
    const through: CostFn = (i) => (m.cells[i] === FLOOR || m.cells[i] === DOOR ? 1 : Infinity)
    path = pathTo(dijkstra(m.w, m.h, it.cur, through), it.cur, m.door)
  }
  it.path = path
  return path[0] ?? -1
}

function chooseRush(w: World): number {
  const it = w.intruder
  const m = w.maze
  const field = dijkstra(m.w, m.h, it.cur, (i) => (canEnter(w, i) ? 1 : Infinity))
  let best = -1
  let bestD = Infinity
  const consider = (x: number, y: number, bonus: number) => {
    if (Math.hypot(x - it.x, y - it.y) > TUNING.rushSense) return
    const t = tileAt(m, x, y)
    // The ghost's own tile, or (if it's over a wall or furniture) beside it.
    const spots = field.dist[t] < Infinity ? [t] : neighbors(m, t)
    for (const i of spots) {
      if (field.dist[i] === Infinity || i === it.cur) continue
      const d = field.dist[i] - bonus
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
  }
  for (const h of w.hazards) if (h.kind === 'decoy') consider(h.x, h.y, 3)
  for (const g of w.ghosts) if (noticeable(g) && !inHouse(w, g)) consider(g.x, g.y, 0)
  if (best < 0) return chooseForage(w)
  if (best === it.cur) return -1
  it.path = pathTo(field, it.cur, best)
  return it.path[0] ?? -1
}

function decide(w: World) {
  const it = w.intruder
  const s = it.status
  let next = -1
  if (s.skid) {
    const ahead = tileAt(w.maze, it.x + it.dirX, it.y + it.dirY)
    if (ahead >= 0 && w.maze.cells[ahead] === FLOOR) next = ahead
    else {
      s.skid = false
      s.stumble = 1
      w.events.push({ type: 'bump', x: it.x, y: it.y })
      w.events.push({ type: 'bark', kind: 'skid' })
      scare(w, 'drizzle', 'slime', ABILITIES.slime.fear, { x: it.x, y: it.y, spook: 1 })
      return
    }
  } else if (it.state === 'flee') next = chooseFlee(w)
  else if (s.blind > 0) {
    const ahead = tileAt(w.maze, it.x + it.dirX, it.y + it.dirY)
    next = ahead >= 0 && w.maze.cells[ahead] === FLOOR ? ahead : wander(w, true)
  } else if (s.confused > 0) next = wander(w, true, w.rng.next() < 0.5)
  else if (it.state === 'spooked') next = chooseSpooked(w)
  else if (it.state === 'rush') next = chooseRush(w)
  else {
    const crossroads = openNeighbors(w, it.cur, false).length >= 3
    const shaky = (w.fear - TUNING.stumbleFrom) / (100 - TUNING.stumbleFrom)
    if (crossroads && shaky > 0 && w.rng.next() < TUNING.wrongTurn * (w.fear / 100)) next = wander(w, false)
    else next = chooseForage(w)
  }
  if (next < 0) {
    it.wait = 0.15
    return
  }
  setNext(w, next)
}

function setNext(w: World, next: number) {
  const it = w.intruder
  const mirror = hazardAt(w, next, 'mirror')
  if (mirror) {
    // He ran into a fake wall: it shatters.
    removeHazard(w, mirror)
    w.events.push({ type: 'shatter', x: mirror.x, y: mirror.y })
    it.status.stumble = Math.max(it.status.stumble, 0.5)
    scare(w, mirror.ghost, 'mirror', ABILITIES.mirror.fear, { x: mirror.x, y: mirror.y })
    return
  }
  it.next = next
  it.p = 0
  const m = w.maze
  it.dirX = tileX(m, next) - tileX(m, it.cur)
  it.dirY = tileY(m, next) - tileY(m, it.cur)
}

function reverse(w: World) {
  const it = w.intruder
  if (it.next === it.cur) return
  ;[it.cur, it.next] = [it.next, it.cur]
  it.p = 1 - it.p
  it.dirX = -it.dirX
  it.dirY = -it.dirY
}

// --- Arriving at a tile -------------------------------------------------

function canEat(w: World): boolean {
  const it = w.intruder
  const s = it.status
  return it.state !== 'flee' && it.state !== 'spooked' && !s.skid && s.noEat <= 0 && s.blind <= 0 && s.treadmill <= 0
}

function arrive(w: World, i: number) {
  const it = w.intruder
  const m = w.maze
  it.trail.push(i)
  if (it.trail.length > TRAIL) it.trail.shift()
  it.next = i
  it.p = 0
  if (it.goal === i) it.goal = -1
  it.x = tileX(m, i)
  it.y = tileY(m, i)
  if (it.state === 'flee') {
    if (m.cells[i] === DOOR) {
      w.over = 'won'
      w.events.push({ type: 'won' })
    }
    return
  }
  const goo = hazardAt(w, i, 'goo')
  if (goo) {
    it.status.stuck = goo.t
    w.events.push({ type: 'bark', kind: 'stuck' })
  }
  const decoy = hazardAt(w, i, 'decoy')
  if (decoy && it.state === 'rush') {
    removeHazard(w, decoy)
    it.status.munch = 2
    it.munchTile = -1
    w.events.push({ type: 'eat', x: it.x, y: it.y })
  }
  const trick = hazardAt(w, i, 'trick')
  if (trick && canEat(w)) {
    removeHazard(w, trick)
    it.status.confused = 3
    w.events.push({ type: 'fizz', x: it.x, y: it.y })
    w.events.push({ type: 'bark', kind: 'treat' })
    scare(w, trick.ghost, 'trick', ABILITIES.trick.fear, { x: it.x, y: it.y })
    if (w.intruder.state === 'flee') return
  }
  if (w.gumballs[i] && canEat(w)) {
    w.gumballs[i] = 0
    it.rush = w.manor.rushSeconds
    it.state = 'rush'
    it.goal = -1
    w.events.push({ type: 'gumball', x: it.x, y: it.y })
    w.events.push({ type: 'bark', kind: 'rush' })
  }
  const slime = hazardAt(w, i, 'slime')
  if (slime && !it.status.skid) {
    slime.seen = true
    it.status.skid = true
    it.status.munch = 0
    it.munchTile = -1
    w.events.push({ type: 'skid', x: it.x, y: it.y })
  }
  if (w.snuff[i] > 0 && w.snuffId[i] !== it.lastSnuff) enterSnuff(w, i)
  if (w.sweets[i] && canEat(w)) {
    it.status.munch = TUNING.munch
    it.munchTile = i
  }
}

// Walking into a hallway Ember just darkened: he freezes, heart pounding.
export function enterSnuff(w: World, i: number) {
  const it = w.intruder
  it.lastSnuff = w.snuffId[i]
  it.status.frozen = Math.max(it.status.frozen, 1.5)
  scare(w, 'ember', 'snuff', ABILITIES.snuff.fear, { x: it.x, y: it.y, subtle: true })
}

export function interruptMunch(w: World, noEat: number) {
  const it = w.intruder
  it.status.munch = 0
  it.munchTile = -1
  it.status.noEat = Math.max(it.status.noEat, noEat)
}

// --- Each step ----------------------------------------------------------

function speed(w: World): number {
  const it = w.intruder
  let s = TUNING.snaxSpeed * w.diff.speedMul * w.manor.speedMul * (1 + TUNING.hungerSpeed * hunger(w))
  if (it.rush > 0) s *= TUNING.rushSpeed
  if (it.state === 'spooked') s *= TUNING.spookSpeed
  if (it.state === 'flee') s *= TUNING.fleeSpeed
  if (it.status.blind > 0) s *= TUNING.blindSpeed
  if (it.status.skid) s *= TUNING.skidSpeed
  return s
}

function bonk(w: World, g: Ghost) {
  const m = w.maze
  const home = m.house[Math.floor(m.house.length / 2)]
  w.events.push({ type: 'bonk', ghost: g.id, x: g.x, y: g.y })
  w.events.push({ type: 'bark', kind: 'bonk' })
  g.respawn = TUNING.respawn
  g.x = tileX(m, home)
  g.y = tileY(m, home)
  g.dash = null
  g.hidden = 0
  g.invisible = 0
  g.noclip = 0
  g.boost = 0
  w.fear = Math.max(w.fearFloor, w.fear - TUNING.bonkFear)
  w.ecto = Math.max(0, w.ecto - TUNING.bonkEcto)
}

export function stepIntruder(w: World, dt: number) {
  const it = w.intruder
  const s = it.status
  const m = w.maze

  perceive(w, dt)
  it.alert = Math.max(0, it.alert - dt)
  for (const k of ['stumble', 'frozen', 'confused', 'stuck', 'treadmill', 'blind', 'noEat'] as const) s[k] = Math.max(0, s[k] - dt)
  it.wait = Math.max(0, it.wait - dt)

  if (it.state === 'spooked') {
    it.stateT -= dt
    if (it.stateT <= 0) it.state = it.rush > 0 ? 'rush' : 'forage'
    // Heading straight at what scared him? Turn round.
    else if (it.next !== it.cur && (it.from.x - it.x) * it.dirX + (it.from.y - it.y) * it.dirY > 0.3) reverse(w)
  }
  if (it.rush > 0) {
    it.rush -= dt
    for (const g of w.ghosts) {
      if (!noticeable(g) || g.intangible > 0 || inHouse(w, g)) continue
      if (Math.hypot(g.x - it.x, g.y - it.y) < TUNING.bonkRange) bonk(w, g)
    }
    if (it.rush <= 0) {
      it.rush = 0
      if (it.state === 'rush') it.state = 'forage'
      w.events.push({ type: 'rushEnd' })
    }
  }
  if (it.state !== 'flee' && w.fear >= 100) startFlee(w)

  // Fear makes him trip over his own tail.
  if (it.state !== 'flee' && w.fear > TUNING.stumbleFrom && s.stumble <= 0) {
    const chance = (TUNING.stumbleRate * (w.fear - TUNING.stumbleFrom)) / (100 - TUNING.stumbleFrom)
    if (w.rng.next() < chance * dt) {
      s.stumble = TUNING.stumbleTime
      w.events.push({ type: 'stumble' })
    }
  }

  if (s.munch > 0) {
    s.munch -= dt
    if (s.munch <= 0) {
      s.munch = 0
      if (it.munchTile >= 0 && w.sweets[it.munchTile]) {
        w.sweets[it.munchTile] = 0
        w.sweetsLeft--
        w.events.push({ type: 'eat', x: it.x, y: it.y })
        if (w.rng.next() < 0.06) w.events.push({ type: 'bark', kind: 'munch' })
        if (w.sweetsLeft <= 0) {
          w.over = 'lost'
          w.events.push({ type: 'lost' })
        }
      }
      it.munchTile = -1
    }
    return
  }
  if (s.stumble > 0 || s.frozen > 0 || s.stuck > 0) return
  if (s.treadmill > 0) return // running flat out, getting nowhere

  if (it.next === it.cur) {
    if (it.wait > 0) return
    decide(w)
    if (it.next === it.cur) return
  }
  it.p += speed(w) * dt
  if (it.p >= 1) {
    arrive(w, it.next)
    it.cur = it.next
    if (!w.over) {
      // Arriving may have started a munch, a freeze or goo; otherwise go on.
      if (s.munch <= 0 && s.frozen <= 0 && s.stuck <= 0 && s.stumble <= 0) decide(w)
    }
  }
  const ax = tileX(m, it.cur)
  const ay = tileY(m, it.cur)
  it.x = ax + (tileX(m, it.next) - ax) * it.p
  it.y = ay + (tileY(m, it.next) - ay) * it.p
}
