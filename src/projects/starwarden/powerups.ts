// Powerups (spec.md section 8): fuel canisters and power-crystal pickups,
// spawned both as standalone drifting pickups and as chance-based drops
// from destroyed enemies.
import { VIEW_HEIGHT, Y_MARGIN } from './physics'
import type { Rng } from './rng'

export type PowerupType = 'fuel' | 'crystal'

export interface Powerup {
  id: number
  type: PowerupType
  worldX: number
  y: number
}

// Scaled to roughly the same fraction of the (now larger) FUEL_MAX/
// CRYSTAL_MAX pools in physics.ts, so a pickup still feels meaningful.
export const FUEL_RESTORE = 75
export const CRYSTAL_RESTORE = 15
export const POWERUP_RADIUS = 12

// Chance a destroyed enemy leaves a powerup behind.
export const ENEMY_DROP_CHANCE = 0.22
// Average seconds between standalone powerup spawns.
export const STANDALONE_INTERVAL = 9

export function randomPowerupType(rng: Rng): PowerupType {
  return rng.next() < 0.5 ? 'fuel' : 'crystal'
}

export function spawnPowerup(rng: Rng, worldWidth: number, nextId: number, type?: PowerupType): Powerup {
  return {
    id: nextId,
    type: type ?? randomPowerupType(rng),
    worldX: rng.range(0, worldWidth),
    y: rng.range(Y_MARGIN, VIEW_HEIGHT - Y_MARGIN),
  }
}
