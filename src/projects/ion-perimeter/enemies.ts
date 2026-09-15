// Enemy type definitions -- see SPEC.md section 5. Stats here are the wave-1
// baseline; waves.ts applies a mild per-wave HP multiplier to regular
// enemies (not bosses, which only ever appear once each) so the full curve
// doesn't need every stat re-typed per wave.
import { PATH } from './path'

export type EnemyId =
  | 'scout'
  | 'cruiser'
  | 'hulk'
  | 'swarmling'
  | 'skiff'
  | 'phantom'
  | 'dreadnought'
  | 'harbinger'

export interface EnemyDef {
  id: EnemyId
  name: string
  hp: number
  speed: number // px/sec along the path
  armor: number // flat reduction per hit to non-piercing damage; 1 always gets through
  shield: number // regenerating shield HP, absorbed before hull damage; 0 = no shield
  shieldRegenDelay: number // seconds with no hits before shield snaps back to full
  cloak: boolean // Stealth Phantom: cycles near-transparent, still fully targetable
  radius: number
  color: string
  credit: number
  scoreValue: number
  coreDamage: number // Core Integrity lost if this enemy reaches the core
  boss: boolean
}

export const ENEMY_DEFS: Record<EnemyId, EnemyDef> = {
  scout: {
    id: 'scout',
    name: 'Scout Drone',
    hp: 18,
    speed: 95,
    armor: 0,
    shield: 0,
    shieldRegenDelay: 0,
    cloak: false,
    radius: 9,
    color: '#67e8f9',
    credit: 4,
    scoreValue: 8,
    coreDamage: 4,
    boss: false,
  },
  cruiser: {
    id: 'cruiser',
    name: 'Cruiser',
    hp: 45,
    speed: 65,
    armor: 1,
    shield: 0,
    shieldRegenDelay: 0,
    cloak: false,
    radius: 12,
    color: '#a3e635',
    credit: 7,
    scoreValue: 14,
    coreDamage: 6,
    boss: false,
  },
  hulk: {
    id: 'hulk',
    name: 'Armored Hulk',
    hp: 140,
    speed: 35,
    armor: 4,
    shield: 0,
    shieldRegenDelay: 0,
    cloak: false,
    radius: 16,
    color: '#f97316',
    credit: 14,
    scoreValue: 28,
    coreDamage: 10,
    boss: false,
  },
  swarmling: {
    id: 'swarmling',
    name: 'Swarmling',
    hp: 8,
    speed: 110,
    armor: 0,
    shield: 0,
    shieldRegenDelay: 0,
    cloak: false,
    radius: 6,
    color: '#fde047',
    credit: 2,
    scoreValue: 4,
    coreDamage: 2,
    boss: false,
  },
  skiff: {
    id: 'skiff',
    name: 'Shield Skiff',
    hp: 40,
    speed: 55,
    armor: 0,
    shield: 35,
    shieldRegenDelay: 4,
    cloak: false,
    radius: 12,
    color: '#38bdf8',
    credit: 10,
    scoreValue: 20,
    coreDamage: 6,
    boss: false,
  },
  phantom: {
    id: 'phantom',
    name: 'Stealth Phantom',
    hp: 30,
    speed: 80,
    armor: 0,
    shield: 0,
    shieldRegenDelay: 0,
    cloak: true,
    radius: 10,
    color: '#c084fc',
    credit: 9,
    scoreValue: 18,
    coreDamage: 5,
    boss: false,
  },
  dreadnought: {
    id: 'dreadnought',
    name: 'Dreadnought',
    hp: 900,
    speed: 26,
    armor: 3,
    shield: 300,
    shieldRegenDelay: 9999, // boss shields never passively regenerate
    cloak: false,
    radius: 30,
    color: '#f87171',
    credit: 220,
    scoreValue: 500,
    coreDamage: 40,
    boss: true,
  },
  harbinger: {
    id: 'harbinger',
    name: 'Harbinger',
    hp: 1800,
    speed: 24,
    armor: 5,
    shield: 500,
    shieldRegenDelay: 9999,
    cloak: false,
    radius: 36,
    color: '#fb7185',
    credit: 500,
    scoreValue: 1200,
    coreDamage: 60,
    boss: true,
  },
}

// Runtime instance of a spawned enemy, distinct from its static EnemyDef.
// x/y/angle are a cache of PATH.at(distance) refreshed once per frame by
// advanceEnemy(), rather than every system that needs an enemy's position
// (tower targeting, collision, drawing) resampling the path itself.
export interface Enemy {
  id: number
  defId: EnemyId
  hp: number
  maxHp: number // the wave-scaled HP this enemy spawned with, for HP-bar fraction
  shield: number
  distance: number // progress along the path, in px
  x: number
  y: number
  angle: number
  slowUntil: number // world-time timestamp; while in the future, speed is reduced
  slowFactor: number // multiplier applied while slowUntil is active
  cloakPhase: number // seconds into this enemy's own cloak cycle
  cloaked: boolean
  hitFlash: number // seconds remaining of "just hit" render highlight
  lastHitAt: number // world-time of last damage taken, for shield regen
  escortSpawned: boolean // Harbinger only: whether its mid-fight escort has launched
}

export function spawnEnemy(defId: EnemyId, id: number, waveIndex: number, now: number): Enemy {
  const def = ENEMY_DEFS[defId]
  const scaledHp = def.boss ? def.hp : Math.round(def.hp * (1 + 0.12 * (waveIndex - 1)))
  const start = PATH.at(0)
  return {
    id,
    defId,
    hp: scaledHp,
    maxHp: scaledHp,
    shield: def.shield,
    distance: 0,
    x: start.x,
    y: start.y,
    angle: start.angle,
    slowUntil: 0,
    slowFactor: 1,
    cloakPhase: 0,
    cloaked: false,
    hitFlash: 0,
    lastHitAt: now,
    escortSpawned: false,
  }
}

// Moves an enemy forward along the path by `deltaDistance` (already
// speed/slow/dt adjusted by the caller) and refreshes its position cache.
// Returns true once the enemy has reached the end of the path (the core).
export function advanceEnemy(enemy: Enemy, deltaDistance: number): boolean {
  enemy.distance += deltaDistance
  const p = PATH.at(enemy.distance)
  enemy.x = p.x
  enemy.y = p.y
  enemy.angle = p.angle
  return enemy.distance >= PATH.totalLength
}
