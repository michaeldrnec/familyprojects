// Enemy roster (spec.md section 6 + open question, resolved for v1, then
// extended):
// - drifter: passive, straight-line flight, no weapon -- a ramming hazard.
// - gunner: slow, drifts toward the player's altitude and fires at them.
// - diver: fast, actively closes on the player's position to ram.
// - pod (level 2+): slow egg sac that bursts into 3 swarmers when killed.
// - swarmer: tiny, fast, loosely homing -- only ever spawned by a pod.
// - layer (level 3+): saucer that crosses the loop seeding stationary mines.
// - mine: stationary, short-lived -- only ever laid by a layer.
// - shieldgunner (level 5+): a gunner behind a slow-turning front shield
//   that blocks lasers from the side facing it, so it has to be flanked.
// - carrier: the mini-boss every 5th escalation level; its core only takes
//   damage while its hatch is open, and it launches drifters.
import { VIEW_HEIGHT, Y_MARGIN, offscreenSpawnX, wrapDelta, type ShipState } from './physics'
import type { Rng } from './rng'

export type EnemyType =
  | 'drifter'
  | 'gunner'
  | 'diver'
  | 'pod'
  | 'swarmer'
  | 'layer'
  | 'mine'
  | 'shieldgunner'
  | 'carrier'

export interface Enemy {
  id: number
  type: EnemyType
  worldX: number
  y: number
  vx: number
  health: number
  maxHealth: number
  radius: number
  fireCooldown: number // gunners: next shot; layer: next mine; carrier: next launch
  rotation: number
  rotationSpeed: number
  age: number // seconds alive -- drives bobbing, mine expiry, carrier hatch cycle
  hitFlash: number // seconds remaining of the white "just hit" overlay
  shieldAngle: number // shieldgunner: world-space direction its shield faces
  ramCooldown: number // carrier: seconds until its hull can hurt the ship again
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
  pod: 30,
  swarmer: 8,
  layer: 35,
  mine: 5,
  shieldgunner: 45,
  carrier: 500,
}

const ENEMY_HEALTH: Record<EnemyType, number> = {
  drifter: 1,
  gunner: 2,
  diver: 1,
  pod: 2,
  swarmer: 1,
  layer: 2,
  mine: 1,
  shieldgunner: 3,
  carrier: 30,
}

const ENEMY_RADIUS: Record<EnemyType, number> = {
  drifter: 13,
  gunner: 16,
  diver: 11,
  pod: 15,
  swarmer: 6,
  layer: 15,
  mine: 8,
  shieldgunner: 16,
  carrier: 34,
}

// Types introduced after v1 always spawn off-screen, so a new threat never
// materializes on top of the ship.
const OFFSCREEN_TYPES = new Set<EnemyType>(['pod', 'layer', 'shieldgunner', 'carrier'])

const GUNNER_BASE_FIRE_INTERVAL = 1.6
const GUNNER_BASE_PROJECTILE_SPEED = 220
const DIVER_BASE_ACCEL = 90
const DIVER_BASE_MAX_SPEED = 210
const DRIFTER_SPEED = 70
const POD_SPEED = 45
const SWARMER_ACCEL = 170
const SWARMER_MAX_SPEED = 230
const LAYER_SPEED = 90
const LAYER_MINE_INTERVAL = 2.5
const MINE_LIFETIME = 20
const SHIELD_TURN_RATE = 1.1 // rad/s -- slow enough to slip around
export const SHIELD_HALF_ARC = (70 * Math.PI) / 180
const CARRIER_SPEED = 55
const CARRIER_HOLD_DISTANCE = 260 // keeps roughly this far off the ship horizontally
const CARRIER_LAUNCH_INTERVAL = 3.5
const CARRIER_HATCH_CYCLE = 6
const CARRIER_HATCH_OPEN = 2.5
export const CARRIER_RAM_COOLDOWN = 1

// Enemies escalate in a clear step every ESCALATION_INTERVAL seconds
// (rather than smoothly ramping continuously) -- level 0 for the first
// minute, level 1 for the second, and so on, matching the "escalating
// every 60 seconds" ask and giving Starwarden.tsx a clean integer to
// detect a level change against (to trigger the escalation banner/burst).
export const ESCALATION_INTERVAL = 60
// The carrier mini-boss arrives every CARRIER_EVERY displayed levels.
export const CARRIER_EVERY = 5

export function enemyLevel(elapsed: number): number {
  return Math.floor(elapsed / ESCALATION_INTERVAL)
}

// How the enemy-type mix shifts as the level climbs: mostly harmless
// drifters at level 0, gunners and divers phasing in, then pods, layers
// and shield gunners joining -- still shifting through about level 10.
type SpawnableType = 'drifter' | 'gunner' | 'diver' | 'pod' | 'layer' | 'shieldgunner'
const SPAWNABLE: SpawnableType[] = ['drifter', 'gunner', 'diver', 'pod', 'layer', 'shieldgunner']

function weightsFor(level: number): Record<SpawnableType, number> {
  return {
    drifter: Math.max(0.15, 1 - 0.1 * level),
    gunner: Math.min(0.3, 0.06 * level),
    diver: Math.min(0.3, 0.06 * level),
    pod: level >= 2 ? Math.min(0.2, 0.05 * (level - 1)) : 0,
    layer: level >= 3 ? Math.min(0.15, 0.04 * (level - 2)) : 0,
    shieldgunner: level >= 5 ? Math.min(0.2, 0.05 * (level - 4)) : 0,
  }
}

function pickType(rng: Rng, level: number): SpawnableType {
  const weights = weightsFor(level)
  const total = SPAWNABLE.reduce((sum, t) => sum + weights[t], 0)
  let roll = rng.next() * total
  for (const type of SPAWNABLE) {
    roll -= weights[type]
    if (roll <= 0) return type
  }
  return 'drifter'
}

// Spawn interval shrinks a step at a time with each escalation level,
// floored so the screen never becomes unfairly saturated.
export function spawnInterval(level: number): number {
  return Math.max(0.5, 2.2 - level * 0.25)
}

// Per-level combat tuning -- keeps sharpening after the spawn interval and
// type mix have bottomed out, so a long run never goes flat.
function gunnerFireInterval(level: number): number {
  return Math.max(0.8, GUNNER_BASE_FIRE_INTERVAL - 0.08 * level)
}
function gunnerShotSpeed(level: number): number {
  return Math.min(360, GUNNER_BASE_PROJECTILE_SPEED + 12 * level)
}
const GUNNER_LEAD_LEVEL = 4 // from here on gunners aim ahead of a moving ship

// Tumble/bank rate per type: drifters (spinning space mines) tumble
// noticeably, divers bank gently into their dive, gunners hold steady since
// their barrel already visibly tracks the player.
const ROTATION_SPEED_RANGE: Record<EnemyType, [number, number]> = {
  drifter: [-2.4, 2.4],
  gunner: [0, 0],
  diver: [-0.6, 0.6],
  pod: [-0.4, 0.4],
  swarmer: [0, 0],
  layer: [0, 0],
  mine: [-1.5, 1.5],
  shieldgunner: [0, 0],
  carrier: [0, 0],
}

function makeEnemy(rng: Rng, type: EnemyType, worldX: number, y: number, vx: number, nextId: number): Enemy {
  const [rotMin, rotMax] = ROTATION_SPEED_RANGE[type]
  return {
    id: nextId,
    type,
    worldX,
    y,
    vx,
    health: ENEMY_HEALTH[type],
    maxHealth: ENEMY_HEALTH[type],
    radius: ENEMY_RADIUS[type],
    fireCooldown: type === 'layer' ? LAYER_MINE_INTERVAL : type === 'carrier' ? CARRIER_LAUNCH_INTERVAL : rng.range(0.4, GUNNER_BASE_FIRE_INTERVAL),
    rotation: rng.range(0, Math.PI * 2),
    rotationSpeed: rng.range(rotMin, rotMax),
    age: 0,
    hitFlash: 0,
    shieldAngle: rng.range(0, Math.PI * 2),
    ramCooldown: 0,
  }
}

export function spawnEnemy(rng: Rng, level: number, worldWidth: number, nextId: number, cameraWorldX: number): Enemy {
  const type = pickType(rng, level)
  const worldX = OFFSCREEN_TYPES.has(type) ? offscreenSpawnX(rng, cameraWorldX, worldWidth) : rng.range(0, worldWidth)
  const y = rng.range(Y_MARGIN, VIEW_HEIGHT - Y_MARGIN)
  const dir = rng.next() < 0.5 ? -1 : 1
  const vx = type === 'drifter' ? dir * DRIFTER_SPEED : type === 'pod' ? dir * POD_SPEED : type === 'layer' ? dir * LAYER_SPEED : 0
  return makeEnemy(rng, type, worldX, y, vx, nextId)
}

// The carrier enters just past the far edge of the view in whichever
// direction the ship is facing, so it's seen arriving rather than popping in.
export function spawnCarrier(rng: Rng, ship: ShipState, worldWidth: number, nextId: number): Enemy {
  const worldX = (((ship.worldX + ship.facing * 820) % worldWidth) + worldWidth) % worldWidth
  return makeEnemy(rng, 'carrier', worldX, VIEW_HEIGHT / 2, 0, nextId)
}

export function spawnSwarmers(rng: Rng, pod: Enemy, nextId: () => number): Enemy[] {
  const out: Enemy[] = []
  for (let i = 0; i < 3; i++) {
    const vx = rng.range(-120, 120)
    out.push(makeEnemy(rng, 'swarmer', pod.worldX, pod.y + (i - 1) * 10, vx, nextId()))
  }
  return out
}

export function carrierHatchOpen(e: Enemy): boolean {
  return e.age % CARRIER_HATCH_CYCLE < CARRIER_HATCH_OPEN
}

// Whether a laser arriving from offset (fromDx, fromDy) relative to a shield
// gunner hits its shield rather than its hull.
export function shieldBlocks(e: Enemy, fromDx: number, fromDy: number): boolean {
  if (e.type !== 'shieldgunner') return false
  const incoming = Math.atan2(fromDy, fromDx)
  let diff = Math.abs(incoming - e.shieldAngle) % (Math.PI * 2)
  if (diff > Math.PI) diff = Math.PI * 2 - diff
  return diff <= SHIELD_HALF_ARC
}

export interface EnemyStepResult {
  enemies: Enemy[]
  newProjectiles: Projectile[]
  newEnemies: Enemy[] // mines laid, drifters launched by a carrier
}

function turnToward(current: number, target: number, maxStep: number): number {
  let diff = (target - current) % (Math.PI * 2)
  if (diff > Math.PI) diff -= Math.PI * 2
  if (diff < -Math.PI) diff += Math.PI * 2
  return current + Math.max(-maxStep, Math.min(maxStep, diff))
}

function clampY(y: number): number {
  return Math.max(Y_MARGIN, Math.min(VIEW_HEIGHT - Y_MARGIN, y))
}

export function stepEnemies(
  enemies: Enemy[],
  ship: ShipState,
  worldWidth: number,
  dt: number,
  nextId: () => number,
  level: number,
  rng: Rng,
): EnemyStepResult {
  const newProjectiles: Projectile[] = []
  const newEnemies: Enemy[] = []
  const stepped: Enemy[] = []

  for (const e of enemies) {
    const age = e.age + dt
    if (e.type === 'mine' && age >= MINE_LIFETIME) continue

    const dxToShip = wrapDelta(ship.worldX, e.worldX, worldWidth)
    const dyToShip = ship.y - e.y
    let worldX = e.worldX
    let y = e.y
    let vx = e.vx
    let fireCooldown = e.fireCooldown
    let shieldAngle = e.shieldAngle

    if (e.type === 'drifter') {
      worldX += vx * dt
    } else if (e.type === 'gunner' || e.type === 'shieldgunner') {
      // Drifts gently toward the player's altitude, staying mostly in place
      // horizontally -- a stationary-ish turret more than a chaser.
      y += Math.sign(dyToShip) * Math.min(Math.abs(dyToShip), 40 * dt)
      if (e.type === 'shieldgunner') {
        shieldAngle = turnToward(shieldAngle, Math.atan2(dyToShip, dxToShip), SHIELD_TURN_RATE * dt)
      }
      fireCooldown -= dt
      if (fireCooldown <= 0 && Math.abs(dxToShip) < 700) {
        const speed = gunnerShotSpeed(level)
        // From GUNNER_LEAD_LEVEL on, aim where the ship will be when the
        // shot arrives (simple linear lead on its horizontal velocity).
        const flight = Math.hypot(dxToShip, dyToShip) / speed
        const aimDx = level >= GUNNER_LEAD_LEVEL ? dxToShip + ship.vx * flight : dxToShip
        const dist = Math.hypot(aimDx, dyToShip) || 1
        newProjectiles.push({
          id: nextId(),
          worldX: e.worldX,
          y: e.y,
          vx: (aimDx / dist) * speed,
          vy: (dyToShip / dist) * speed,
          owner: 'enemy',
          life: 3,
        })
        fireCooldown = gunnerFireInterval(level) * (e.type === 'shieldgunner' ? 1.2 : 1)
      }
    } else if (e.type === 'diver') {
      const accel = Math.min(200, DIVER_BASE_ACCEL + 10 * level)
      const maxSpeed = Math.min(300, DIVER_BASE_MAX_SPEED + 8 * level)
      const dist = Math.hypot(dxToShip, dyToShip) || 1
      vx = Math.max(-maxSpeed, Math.min(maxSpeed, vx + (dxToShip / dist) * accel * dt))
      y += (dyToShip / dist) * 130 * dt
      worldX += vx * dt
    } else if (e.type === 'pod') {
      worldX += vx * dt
      y = clampY(y + Math.sin(age * 1.8 + e.id) * 30 * dt)
    } else if (e.type === 'swarmer') {
      vx = Math.max(-SWARMER_MAX_SPEED, Math.min(SWARMER_MAX_SPEED, vx + Math.sign(dxToShip) * SWARMER_ACCEL * dt))
      y = clampY(y + Math.sign(dyToShip) * Math.min(Math.abs(dyToShip), 90 * dt) + Math.sin(age * 8 + e.id) * 40 * dt)
      worldX += vx * dt
    } else if (e.type === 'layer') {
      worldX += vx * dt
      y = clampY(y + Math.sin(age * 0.9 + e.id) * 45 * dt)
      fireCooldown -= dt
      if (fireCooldown <= 0) {
        newEnemies.push(makeEnemy(rng, 'mine', e.worldX, e.y + e.radius * 0.6, 0, nextId()))
        fireCooldown = LAYER_MINE_INTERVAL
      }
    } else if (e.type === 'carrier') {
      // Closes to a holding distance off the ship's flank and hovers there
      // around mid-screen, so the fight happens on screen.
      const gap = Math.abs(dxToShip) - CARRIER_HOLD_DISTANCE
      vx = Math.abs(gap) > 20 ? Math.sign(dxToShip) * Math.sign(gap) * CARRIER_SPEED : 0
      worldX += vx * dt
      y = clampY(VIEW_HEIGHT / 2 + Math.sin(age * 0.6) * 110)
      fireCooldown -= dt
      if (fireCooldown <= 0) {
        const launched = makeEnemy(rng, 'drifter', e.worldX, e.y, Math.sign(dxToShip || 1) * DRIFTER_SPEED * 1.4, nextId())
        newEnemies.push(launched)
        fireCooldown = CARRIER_LAUNCH_INTERVAL
      }
    }

    stepped.push({
      ...e,
      worldX: ((worldX % worldWidth) + worldWidth) % worldWidth,
      y,
      vx,
      fireCooldown,
      shieldAngle,
      age,
      hitFlash: Math.max(0, e.hitFlash - dt),
      ramCooldown: Math.max(0, e.ramCooldown - dt),
      rotation: e.rotation + e.rotationSpeed * dt,
    })
  }

  return { enemies: stepped, newProjectiles, newEnemies }
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
