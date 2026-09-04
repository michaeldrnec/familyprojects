// Enemy roster (spec.md section 6 + open question, resolved for v1):
// - drifter: passive, straight-line flight, no weapon -- a ramming hazard.
// - gunner: slow, drifts toward the player's altitude and fires at them.
// - diver: fast, actively closes on the player's position to ram.
import { VIEW_HEIGHT, Y_MARGIN, wrapDelta, type ShipState } from './physics'
import type { Rng } from './rng'

export type EnemyType = 'drifter' | 'gunner' | 'diver'

export interface Enemy {
  id: number
  type: EnemyType
  worldX: number
  y: number
  vx: number
  health: number
  radius: number
  fireCooldown: number
  rotation: number
  rotationSpeed: number
}

export interface Projectile {
  id: number
  worldX: number
  y: number
  vx: number
  vy: number
  owner: 'player' | 'enemy'
  life: number // seconds remaining before despawn
}

export const ENEMY_POINTS: Record<EnemyType, number> = {
  drifter: 10,
  gunner: 25,
  diver: 20,
}

const ENEMY_HEALTH: Record<EnemyType, number> = {
  drifter: 1,
  gunner: 2,
  diver: 1,
}

const ENEMY_RADIUS: Record<EnemyType, number> = {
  drifter: 13,
  gunner: 16,
  diver: 11,
}

const GUNNER_FIRE_INTERVAL = 1.6
const GUNNER_PROJECTILE_SPEED = 220
const DIVER_ACCEL = 90
const DIVER_MAX_SPEED = 210
const DRIFTER_SPEED = 70

// How the enemy-type mix shifts over survival time: mostly harmless
// drifters early on, gunners and divers phasing in as the run goes on --
// the difficulty ramp described in spec.md section 11.
function weightsFor(elapsed: number): Record<EnemyType, number> {
  const t = Math.min(1, elapsed / 90) // reaches the "late run" mix by 90s
  return {
    drifter: 1 - 0.6 * t,
    gunner: 0.3 * t,
    diver: 0.3 * t,
  }
}

function pickType(rng: Rng, elapsed: number): EnemyType {
  const weights = weightsFor(elapsed)
  const total = weights.drifter + weights.gunner + weights.diver
  let roll = rng.next() * total
  for (const type of ['drifter', 'gunner', 'diver'] as EnemyType[]) {
    roll -= weights[type]
    if (roll <= 0) return type
  }
  return 'drifter'
}

// Spawn interval shrinks (more frequent spawns) as survival time
// accumulates, floored so the screen never becomes unfairly saturated.
export function spawnInterval(elapsed: number): number {
  return Math.max(0.55, 2.2 - elapsed * 0.018)
}

// Tumble/bank rate per type: drifters (spinning space mines) tumble
// noticeably, divers bank gently into their dive, gunners hold steady since
// their barrel already visibly tracks the player.
const ROTATION_SPEED_RANGE: Record<EnemyType, [number, number]> = {
  drifter: [-2.4, 2.4],
  gunner: [0, 0],
  diver: [-0.6, 0.6],
}

export function spawnEnemy(rng: Rng, elapsed: number, worldWidth: number, nextId: number): Enemy {
  const type = pickType(rng, elapsed)
  const [rotMin, rotMax] = ROTATION_SPEED_RANGE[type]
  return {
    id: nextId,
    type,
    worldX: rng.range(0, worldWidth),
    y: rng.range(Y_MARGIN, VIEW_HEIGHT - Y_MARGIN),
    vx: type === 'drifter' ? (rng.next() < 0.5 ? -1 : 1) * DRIFTER_SPEED : 0,
    health: ENEMY_HEALTH[type],
    radius: ENEMY_RADIUS[type],
    fireCooldown: rng.range(0.4, GUNNER_FIRE_INTERVAL),
    rotation: rng.range(0, Math.PI * 2),
    rotationSpeed: rng.range(rotMin, rotMax),
  }
}

export interface EnemyStepResult {
  enemies: Enemy[]
  newProjectiles: Projectile[]
}

export function stepEnemies(
  enemies: Enemy[],
  ship: ShipState,
  worldWidth: number,
  dt: number,
  nextId: () => number,
): EnemyStepResult {
  const newProjectiles: Projectile[] = []
  const stepped: Enemy[] = []

  for (const e of enemies) {
    const dxToShip = wrapDelta(ship.worldX, e.worldX, worldWidth)
    let worldX = e.worldX
    let y = e.y
    let vx = e.vx
    let fireCooldown = e.fireCooldown

    if (e.type === 'drifter') {
      worldX += vx * dt
    } else if (e.type === 'gunner') {
      // Drifts gently toward the player's altitude, staying mostly in place
      // horizontally -- a stationary-ish turret more than a chaser.
      y += Math.sign(ship.y - e.y) * Math.min(Math.abs(ship.y - e.y), 40 * dt)
      fireCooldown -= dt
      if (fireCooldown <= 0 && Math.abs(dxToShip) < 700) {
        const dist = Math.hypot(dxToShip, ship.y - e.y) || 1
        newProjectiles.push({
          id: nextId(),
          worldX: e.worldX,
          y: e.y,
          vx: (dxToShip / dist) * GUNNER_PROJECTILE_SPEED,
          vy: ((ship.y - e.y) / dist) * GUNNER_PROJECTILE_SPEED,
          owner: 'enemy',
          life: 3,
        })
        fireCooldown = GUNNER_FIRE_INTERVAL
      }
    } else if (e.type === 'diver') {
      const dist = Math.hypot(dxToShip, ship.y - e.y) || 1
      vx = Math.max(-DIVER_MAX_SPEED, Math.min(DIVER_MAX_SPEED, vx + (dxToShip / dist) * DIVER_ACCEL * dt))
      y += (ship.y - e.y) / dist * 130 * dt
      worldX += vx * dt
    }

    stepped.push({
      ...e,
      worldX: ((worldX % worldWidth) + worldWidth) % worldWidth,
      y,
      vx,
      fireCooldown,
      rotation: e.rotation + e.rotationSpeed * dt,
    })
  }

  return { enemies: stepped, newProjectiles }
}

export function stepProjectiles(projectiles: Projectile[], worldWidth: number, dt: number): Projectile[] {
  const out: Projectile[] = []
  for (const p of projectiles) {
    const life = p.life - dt
    if (life <= 0) continue
    out.push({
      ...p,
      worldX: ((p.worldX + p.vx * dt) % worldWidth + worldWidth) % worldWidth,
      y: p.y + p.vy * dt,
      life,
    })
  }
  return out
}
