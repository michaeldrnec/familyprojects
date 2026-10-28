// Fear and hunger: how much a scare is worth, what it does to Snaxley, and
// the slow slide back down when nobody's scaring him.
import { TUNING, type AbilityId, type GhostId } from './config'
import { isFloor } from './maze'
import type { World } from './types'

export function hunger(w: World): number {
  return w.sweetsTotal ? 1 - w.sweetsLeft / w.sweetsTotal : 0
}

export interface ScareOpts {
  x: number
  y: number
  subtle?: boolean
  drop?: number // sweets he drops
  spook?: number // seconds he runs from (x, y)
  bonus?: number // added to the base before modifiers
}

// Resolves one scare and returns the fear it added.
export function scare(w: World, ghost: GhostId | null, ability: AbilityId, base: number, o: ScareOpts): number {
  const it = w.intruder
  if (w.over || it.state === 'flee') return 0
  let amount = (base + (o.bonus ?? 0)) * w.diff.scareMul
  const g = ghost ? w.ghosts.find((gh) => gh.id === ghost) : undefined
  if (g && g.seen >= TUNING.seenThreshold) amount *= TUNING.seenMul
  if (g && g !== w.ghosts[w.active]) amount *= TUNING.helperScare
  const uses = (w.habit[ability] ?? []).filter((at) => w.time - at <= w.manor.habitWindow)
  amount *= Math.max(TUNING.habitFloor, Math.pow(TUNING.habitMul, uses.length))
  w.habit[ability] = [...uses, w.time]
  const combo = !!ghost && !!w.lastScare && w.lastScare.ghost !== ghost && w.time - w.lastScare.t <= TUNING.comboWindow
  if (combo) amount *= TUNING.comboMul
  amount *= 1 - (o.subtle ? TUNING.subtleResist : TUNING.bigResist) * hunger(w)

  if (ghost) {
    w.lastScare = { ghost, t: w.time }
    w.chain = combo ? w.chain + 1 : 1
    w.bestCombo = Math.max(w.bestCombo, w.chain > 1 ? w.chain : 0)
  }
  w.scares++
  w.ecto = Math.min(TUNING.ectoMax, w.ecto + amount * TUNING.ectoRefund)
  heat(w, o.x, o.y, 2, 1)
  w.events.push({ type: 'scare', ghost, ability, amount, combo, x: o.x, y: o.y })
  w.events.push({ type: 'bark', kind: 'scared' })
  if (o.drop) dropSweets(w, o.drop, it.x, it.y)
  addFear(w, amount)
  if (o.spook && w.fear < 100 && it.state !== 'rush') spook(w, o.x, o.y, o.spook)
  return amount
}

// Fear that builds every second an ultimate or trap holds him.
export function fearOverTime(w: World, perSecond: number, dt: number, subtle = false) {
  if (w.over || w.intruder.state === 'flee') return
  const amount = perSecond * dt * w.diff.scareMul * (1 - (subtle ? TUNING.subtleResist : TUNING.bigResist) * hunger(w))
  w.ecto = Math.min(TUNING.ectoMax, w.ecto + amount * TUNING.ectoRefund)
  addFear(w, amount)
}

function addFear(w: World, amount: number) {
  w.lastScareAt = w.time
  w.fear = Math.min(100, w.fear + amount)
  w.fearFloor = Math.max(w.fearFloor, Math.floor(w.fear / TUNING.tier) * TUNING.tier)
  if (w.fear >= 100) startFlee(w)
}

// Fear never slides below the last 25% step reached.
export function decayFear(w: World, dt: number) {
  if (w.intruder.rush > 0 || w.intruder.state === 'flee') return
  if (w.time - w.lastScareAt < TUNING.decayDelay) return
  w.fear = Math.max(w.fearFloor, w.fear - TUNING.decayRate * dt)
}

// Spends fear (a bonk, a Desperation Dash). `keepFloor` stops at the step.
export function loseFear(w: World, amount: number, keepFloor: boolean) {
  w.fear = Math.max(keepFloor ? w.fearFloor : 0, w.fear - amount)
  if (!keepFloor) w.fearFloor = Math.min(w.fearFloor, Math.floor(w.fear / TUNING.tier) * TUNING.tier)
}

export function startFlee(w: World) {
  const it = w.intruder
  if (it.state === 'flee') return
  it.state = 'flee'
  it.rush = 0
  it.status = { stumble: 0, frozen: 0, confused: 0, stuck: 0, treadmill: 0, blind: 0, munch: 0, noEat: 0, skid: false }
  it.munchTile = -1
  it.alert = 0
  w.fleeLeft = w.sweetsLeft
  w.events.push({ type: 'flee' })
  w.events.push({ type: 'bark', kind: 'flee' })
}

export function spook(w: World, x: number, y: number, seconds: number) {
  const it = w.intruder
  it.state = 'spooked'
  it.stateT = Math.max(it.stateT, seconds)
  it.from = { x, y }
  // A scare knocks a half-eaten sweet out of his paws.
  it.status.munch = 0
  it.munchTile = -1
}

// Adds danger heat around a point; he routes around hot tiles.
export function heat(w: World, x: number, y: number, radius: number, amount: number) {
  const m = w.maze
  for (let ty = Math.floor(y - radius); ty <= Math.ceil(y + radius); ty++) {
    for (let tx = Math.floor(x - radius); tx <= Math.ceil(x + radius); tx++) {
      if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) continue
      const d = Math.hypot(tx - x, ty - y)
      if (d > radius) continue
      const i = ty * m.w + tx
      w.danger[i] = Math.max(w.danger[i], amount * (1 - d / (radius + 1)))
    }
  }
}

// Scatters up to `n` sweets back onto empty floor near (x, y). Never puts
// back more than he has eaten.
export function dropSweets(w: World, n: number, x: number, y: number) {
  const m = w.maze
  const room = w.sweetsTotal - w.sweetsLeft
  n = Math.min(n, room)
  if (n <= 0) return
  const it = w.intruder
  const spots: number[] = []
  for (let r = 3; spots.length < n && r <= 6; r++) {
    spots.length = 0
    for (let ty = Math.floor(y - r); ty <= Math.ceil(y + r); ty++) {
      for (let tx = Math.floor(x - r); tx <= Math.ceil(x + r); tx++) {
        if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) continue
        const i = ty * m.w + tx
        if (!isFloor(m, i) || w.sweets[i] || w.gumballs[i] || i === it.cur || i === it.next) continue
        if (Math.hypot(tx - x, ty - y) <= r) spots.push(i)
      }
    }
  }
  const tiles: number[] = []
  while (tiles.length < n && spots.length) {
    const k = w.rng.int(0, spots.length)
    const i = spots.splice(k, 1)[0]
    w.sweets[i] = 1
    w.sweetsLeft++
    tiles.push(i)
  }
  if (tiles.length) w.events.push({ type: 'drop', tiles })
}

