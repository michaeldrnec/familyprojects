// The four weapons and their shared heat meter. Every shot adds heat;
// hitting 100 locks fire while the meter drains to zero over 2.5 s. A shot
// on the beat (perfect beat) is free, faster, and scores more.
import {
  COOL_DELAY,
  COOL_RATE,
  HEAT_MAX,
  OVERHEAT_TIME,
  PERFECT_SPEED_MULT,
  SPREAD_ANGLE,
  WEAPONS,
  WEAPON_ORDER,
  type WeaponId,
} from './constants'

export interface WeaponState {
  current: WeaponId
  heat: number
  overheated: boolean
  cooldown: number // until the next shot is allowed
  idle: number // seconds since the last shot (cooling starts after COOL_DELAY)
}

export interface PlayerShot {
  id: number
  weapon: WeaponId
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  pierceLeft: number
  hitIds: number[] // invaders already pierced, so one rail can't hit twice
  perfect: boolean
  age: number
}

export function newWeaponState(): WeaponState {
  return { current: 'disruptor', heat: 0, overheated: false, cooldown: 0, idle: 0 }
}

// Returns true the moment the weapon recovers from an overheat.
export function updateHeat(ws: WeaponState, dt: number): boolean {
  ws.cooldown = Math.max(0, ws.cooldown - dt)
  ws.idle += dt
  if (ws.overheated) {
    ws.heat -= (HEAT_MAX / OVERHEAT_TIME) * dt
    if (ws.heat <= 0) {
      ws.heat = 0
      ws.overheated = false
      return true
    }
    return false
  }
  if (ws.idle >= COOL_DELAY) ws.heat = Math.max(0, ws.heat - COOL_RATE * dt)
  return false
}

export function canFire(ws: WeaponState): boolean {
  return !ws.overheated && ws.cooldown <= 0
}

export interface FireResult {
  shots: PlayerShot[]
  overheated: boolean // this shot tipped the meter over
}

export function fire(ws: WeaponState, x: number, y: number, perfect: boolean, nextId: () => number): FireResult {
  const def = WEAPONS[ws.current]
  ws.cooldown = def.cooldown
  ws.idle = 0
  let overheated = false
  if (!perfect) {
    ws.heat += def.heat
    if (ws.heat >= HEAT_MAX) {
      ws.heat = HEAT_MAX
      ws.overheated = true
      overheated = true
    }
  }
  const speed = def.speed * (perfect ? PERFECT_SPEED_MULT : 1)
  const angles = ws.current === 'spread' ? [-SPREAD_ANGLE, 0, SPREAD_ANGLE] : [0]
  const shots = angles.map((a) => ({
    id: nextId(),
    weapon: ws.current,
    x,
    y,
    vx: Math.sin(a) * speed,
    vy: -Math.cos(a) * speed,
    damage: def.damage,
    pierceLeft: def.pierce,
    hitIds: [],
    perfect,
    age: 0,
  }))
  return { shots, overheated }
}

export function selectWeapon(ws: WeaponState, id: WeaponId) {
  ws.current = id
}

export function cycleWeapon(ws: WeaponState, delta: number) {
  const i = WEAPON_ORDER.indexOf(ws.current)
  ws.current = WEAPON_ORDER[(i + delta + WEAPON_ORDER.length) % WEAPON_ORDER.length]
}
