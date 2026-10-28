// Traps and effects attached to tiles: slime, mirror walls, Trick Treats,
// goo, poltergeist zones, wail sources and jelly decoys, plus the lantern
// snuff timers. Each lives for a few seconds and is removed when it runs out.
import { ABILITIES, TUNING, type GhostId } from './config'
import { fearOverTime, heat } from './fear'
import { tileX, tileY } from './maze'
import type { Hazard, HazardKind, World } from './types'

// How many of each kind one ghost may have out at once.
const LIMITS: Partial<Record<HazardKind, number>> = { slime: 3, mirror: 2, trick: 2, decoy: 2, goo: 1, party: 1, wail: 1 }

export const PARTY_RADIUS = 3

export function addHazard(w: World, kind: HazardKind, tile: number, ghost: GhostId, life: number): Hazard {
  const limit = LIMITS[kind]
  if (limit) {
    const mine = w.hazards.filter((h) => h.kind === kind && h.ghost === ghost)
    if (mine.length >= limit) removeHazard(w, mine[0])
  }
  const h: Hazard = { id: w.nextId++, kind, tile, x: tileX(w.maze, tile), y: tileY(w.maze, tile), t: life, life, seen: false, ghost }
  w.hazards.push(h)
  return h
}

export function hazardAt(w: World, tile: number, kind: HazardKind): Hazard | undefined {
  for (const h of w.hazards) if (h.tile === tile && h.kind === kind) return h
  return undefined
}

export function removeHazard(w: World, h: Hazard) {
  const k = w.hazards.indexOf(h)
  if (k < 0) return
  w.hazards.splice(k, 1)
  w.events.push({ type: 'hazardEnd', kind: h.kind, x: h.x, y: h.y })
}

// Timers, plus the effects that hold him every second they last.
export function tickHazards(w: World, dt: number) {
  const it = w.intruder
  for (const h of [...w.hazards]) {
    h.t -= dt
    if (h.t <= 0) {
      removeHazard(w, h)
      continue
    }
    if (it.state === 'flee') continue
    if (h.kind === 'party' && Math.hypot(it.x - h.x, it.y - h.y) <= PARTY_RADIUS) {
      it.status.confused = Math.max(it.status.confused, 0.3)
      fearOverTime(w, ABILITIES.party.fear, dt)
    } else if (h.kind === 'wail') {
      heat(w, h.x, h.y, TUNING.wailRadius, 1.5)
      it.alert = Math.max(it.alert, 0.2)
      it.alertAt = { x: h.x, y: h.y }
    }
  }
  if (it.state !== 'flee') {
    if (it.status.stuck > 0) fearOverTime(w, ABILITIES.goo.fear, dt)
    if (it.status.treadmill > 0) fearOverTime(w, ABILITIES.hallway.fear, dt)
  }
  for (let i = 0; i < w.snuff.length; i++) if (w.snuff[i] > 0) w.snuff[i] = Math.max(0, w.snuff[i] - dt)
}
