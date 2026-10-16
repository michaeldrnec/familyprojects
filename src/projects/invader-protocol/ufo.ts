// The Apex Transponder: a mystery ship that crosses the top of the screen
// every 25-40 s, dropping orbital laser markers into the lanes behind the
// bunkers. Shooting it down pays more the further away the cannon is, and
// patches up the most damaged bunker.
import {
  MARKERS_PER_PASS,
  MARKER_BEAM,
  MARKER_HALF_W,
  MARKER_TELEGRAPH,
  UFO_HALF_W,
  UFO_HP,
  UFO_INTERVAL_MAX,
  UFO_INTERVAL_MIN,
  UFO_SPEED,
  UFO_Y,
  VIEW_W,
} from './constants'
import { BUNKER_HALF_W, isStanding, type Bunker } from './bunkers'
import type { Rng } from '../../shared/rng'

export interface Ufo {
  x: number
  y: number
  dir: 1 | -1
  hp: number
  flash: number
  dropTimes: number[] // seconds into the pass at which to drop a marker
  age: number
}

export interface Marker {
  x: number
  t: number // counts up; telegraph, then beam
  hitDone: boolean
}

export function nextUfoDelay(rng: Rng): number {
  return rng.range(UFO_INTERVAL_MIN, UFO_INTERVAL_MAX)
}

export function spawnUfo(rng: Rng): Ufo {
  const dir = rng.next() < 0.5 ? 1 : -1
  const crossTime = (VIEW_W + UFO_HALF_W * 2) / UFO_SPEED
  const dropTimes: number[] = []
  for (let i = 0; i < MARKERS_PER_PASS; i++) dropTimes.push(rng.range(crossTime * 0.15, crossTime * 0.85))
  dropTimes.sort((a, b) => a - b)
  return { x: dir === 1 ? -UFO_HALF_W : VIEW_W + UFO_HALF_W, y: UFO_Y, dir, hp: UFO_HP, flash: 0, dropTimes, age: 0 }
}

// Moves the UFO; returns false once it has left the screen.
export function updateUfo(ufo: Ufo, dt: number, rng: Rng, bunkers: Bunker[], markers: Marker[]): boolean {
  ufo.x += ufo.dir * UFO_SPEED * dt
  ufo.age += dt
  ufo.flash = Math.max(0, ufo.flash - dt)
  while (ufo.dropTimes.length > 0 && ufo.age >= ufo.dropTimes[0]) {
    ufo.dropTimes.shift()
    const standing = bunkers.filter(isStanding)
    if (standing.length === 0) continue
    const b = standing[Math.floor(rng.next() * standing.length)]
    markers.push({ x: b.x + rng.range(-BUNKER_HALF_W + MARKER_HALF_W, BUNKER_HALF_W - MARKER_HALF_W), t: 0, hitDone: false })
  }
  return ufo.dir === 1 ? ufo.x < VIEW_W + UFO_HALF_W * 2 : ufo.x > -UFO_HALF_W * 2
}

export function markerFiring(m: Marker): boolean {
  return m.t >= MARKER_TELEGRAPH && m.t < MARKER_TELEGRAPH + MARKER_BEAM
}

export function markerDone(m: Marker): boolean {
  return m.t >= MARKER_TELEGRAPH + MARKER_BEAM
}

export function ufoReward(ufoX: number, playerX: number): number {
  const k = Math.max(0, Math.min(1, Math.abs(ufoX - playerX) / 960))
  return Math.round((1000 + 4000 * k) / 100) * 100
}
