import { useEffect, useRef, useState } from 'react'
import {
  CRYSTAL_MAX,
  FUEL_MAX,
  HEALTH_MAX,
  SHIELD_BREAK_DURATION,
  SHIELD_FLASH_DURATION,
  SHIELD_REGEN_TIME,
  SHIP_RADIUS,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  WORLD_WIDTH,
  initialShip,
  stepShip,
  wrap,
  wrapDelta,
  type ShipInput,
  type ShipState,
} from './physics'
import {
  CARRIER_EVERY,
  CARRIER_RAM_COOLDOWN,
  ENEMY_POINTS,
  SHIELD_HALF_ARC,
  carrierHatchOpen,
  enemyLevel,
  shieldBlocks,
  spawnCarrier,
  spawnEnemy,
  spawnInterval,
  spawnSwarmers,
  stepEnemies,
  stepProjectiles,
  type Enemy,
  type EnemyType,
  type Projectile,
} from './enemies'
import { ASTEROID_POINTS, spawnAsteroid, stepAsteroids, type Asteroid } from './asteroids'
import { spawnExplosion, stepExplosions, type Explosion } from './explosions'
import {
  CRYSTAL_RESTORE,
  ENEMY_DROP_CHANCE,
  FUEL_RESTORE,
  POWERUP_RADIUS,
  STANDALONE_INTERVAL,
  spawnPowerup,
  type Powerup,
  type PowerupType,
} from './powerups'
import { NOVA_CLEAR_MARGIN, NOVA_FLASH_DURATION, NOVA_MAX_CHARGES, NOVA_RECHARGE_TIME } from './nova'
import { survivalPoints } from './scoring'
import { formatTime, loadProgress, recordRun, type Progress } from './progress'
import { makeRng, type Rng } from './rng'
import * as audio from './audio'
import './Starwarden.css'

type Phase = 'intro' | 'playing' | 'gameover'

const LASER_SPEED = 520
const LASER_COOLDOWN = 0.22
const RAM_DAMAGE_RADIUS_PAD = 4
const ASTEROID_INTERVAL = 8
const ESCALATION_BANNER_DURATION = 2.5
const ESCALATION_BURST_COUNT = 2

// The camera eases ahead of the ship in the direction it faces, so more of
// the oncoming loop is visible than what's behind (as in Defender).
const CAMERA_LEAD = 200
const CAMERA_LEAD_RATE = 3

const HIT_FLASH = 0.12
const SHAKE_DURATION = 0.35
const SHAKE_MAGNITUDE = 7
const DAMAGE_FLASH_DURATION = 0.45
const FLOATER_DURATION = 0.9

// Kills within COMBO_WINDOW seconds of each other build a score multiplier
// up to COMBO_MAX; taking damage (or letting the window lapse) resets it.
const COMBO_WINDOW = 2
const COMBO_MAX = 5

// Resource warnings fire once each time a gauge drops under LOW_THRESHOLD,
// and re-arm once it's been topped back up past LOW_REARM.
const LOW_THRESHOLD = 0.2
const LOW_REARM = 0.3

const NOVA_CARRIER_DAMAGE = 8

interface Floater {
  id: number
  worldX: number
  y: number
  text: string
  color: string
  age: number
}

interface GameState {
  ship: ShipState
  enemies: Enemy[]
  asteroids: Asteroid[]
  projectiles: Projectile[]
  powerups: Powerup[]
  explosions: Explosion[]
  floaters: Floater[]
  score: number
  elapsed: number
  spawnTimer: number
  asteroidTimer: number
  powerupTimer: number
  fireCooldown: number
  idCounter: number
  rng: Rng
  enemyLevel: number
  escalationBannerTimer: number
  escalationText: string
  novaCharges: number
  novaTimer: number
  novaFlashTimer: number
  cameraLead: number
  shakeTimer: number
  damageFlashTimer: number
  combo: number
  comboTimer: number
  lowFuelWarned: boolean
  lowCrystalWarned: boolean
}

function newGame(seed: number): GameState {
  return {
    ship: initialShip(),
    enemies: [],
    asteroids: [],
    projectiles: [],
    powerups: [],
    explosions: [],
    floaters: [],
    score: 0,
    elapsed: 0,
    spawnTimer: 1,
    asteroidTimer: ASTEROID_INTERVAL * 0.5,
    powerupTimer: STANDALONE_INTERVAL,
    fireCooldown: 0,
    idCounter: 1,
    rng: makeRng(seed),
    enemyLevel: 0,
    escalationBannerTimer: 0,
    escalationText: '',
    novaCharges: 1,
    novaTimer: 0,
    novaFlashTimer: 0,
    cameraLead: CAMERA_LEAD,
    shakeTimer: 0,
    damageFlashTimer: 0,
    combo: 0,
    comboTimer: 0,
    lowFuelWarned: false,
    lowCrystalWarned: false,
  }
}

// World x at the center of the screen.
function cameraX(gs: GameState): number {
  return gs.ship.worldX + gs.cameraLead
}

function screenX(worldX: number, camX: number): number {
  return VIEW_WIDTH / 2 + wrapDelta(worldX, camX, WORLD_WIDTH)
}

// ---------------------------------------------------------------------------
// Background: parallax star layers and a looping mountain ridge
// ---------------------------------------------------------------------------

interface StarLayer {
  factor: number // scroll speed relative to the world
  width: number // the layer loops every WORLD_WIDTH * factor px, so it wraps with the world
  alpha: number
  stars: { x: number; y: number; r: number }[]
}

function makeStarLayers(rng: Rng): StarLayer[] {
  const specs = [
    { factor: 0.3, count: 60, alpha: 0.3, big: 0.05 },
    { factor: 0.6, count: 70, alpha: 0.5, big: 0.15 },
    { factor: 1, count: 60, alpha: 0.75, big: 0.3 },
  ]
  return specs.map(({ factor, count, alpha, big }) => {
    const width = WORLD_WIDTH * factor
    const stars = []
    for (let i = 0; i < count; i++) {
      stars.push({ x: rng.range(0, width), y: rng.range(0, VIEW_HEIGHT), r: rng.next() < big ? 1.8 : 1 })
    }
    return { factor, width, alpha, stars }
  })
}

// Ridge heights at fixed RIDGE_STEP spacing around the whole loop. Built
// from whole-number sine harmonics of the loop so the last point meets the
// first seamlessly at the wrap seam.
const RIDGE_STEP = 40
const RIDGE: number[] = (() => {
  const n = WORLD_WIDTH / RIDGE_STEP
  const rng = makeRng(11)
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return Math.max(8, 26 + 12 * Math.sin(3 * a) + 8 * Math.sin(7 * a + 1) + 5 * Math.sin(13 * a + 2) + rng.range(-3, 3))
  })
})()

function drawStarLayers(ctx: CanvasRenderingContext2D, layers: StarLayer[], camX: number, vx: number, thrusting: boolean) {
  // Star warp: stars stretch into streaks trailing the ship's motion as
  // speed builds, nearer layers streaking longer than distant ones.
  const baseStreak = Math.min(70, Math.abs(vx) * 0.28)
  const dir = vx >= 0 ? 1 : -1
  for (const layer of layers) {
    const layerCam = camX * layer.factor
    const streakLen = baseStreak * layer.factor
    const alpha = layer.alpha * (thrusting ? 1.2 : 1)
    for (const s of layer.stars) {
      const sx = VIEW_WIDTH / 2 + wrapDelta(s.x, layerCam, layer.width)
      if (sx < -80 || sx > VIEW_WIDTH + 80) continue
      if (streakLen > 3) {
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`
        ctx.lineWidth = s.r
        ctx.beginPath()
        ctx.moveTo(sx, s.y)
        ctx.lineTo(sx + dir * streakLen, s.y)
        ctx.stroke()
      } else {
        ctx.fillStyle = `rgba(255,255,255,${alpha})`
        ctx.fillRect(sx, s.y, s.r, s.r)
      }
    }
  }
}

function drawRidge(ctx: CanvasRenderingContext2D, camX: number) {
  const n = RIDGE.length
  const left = camX - VIEW_WIDTH / 2
  const first = Math.floor(left / RIDGE_STEP) - 1
  const count = Math.ceil(VIEW_WIDTH / RIDGE_STEP) + 3
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(-10, VIEW_HEIGHT)
  for (let k = first; k <= first + count; k++) {
    const h = RIDGE[((k % n) + n) % n]
    ctx.lineTo(k * RIDGE_STEP - left, VIEW_HEIGHT - h)
  }
  ctx.lineTo(VIEW_WIDTH + 10, VIEW_HEIGHT)
  ctx.closePath()
  const grad = ctx.createLinearGradient(0, VIEW_HEIGHT - 55, 0, VIEW_HEIGHT)
  grad.addColorStop(0, 'rgba(76,29,149,0.55)')
  grad.addColorStop(1, 'rgba(15,10,40,0.9)')
  ctx.fillStyle = grad
  ctx.fill()
  ctx.strokeStyle = 'rgba(167,139,250,0.7)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Ship and enemies
// ---------------------------------------------------------------------------

function drawShip(ctx: CanvasRenderingContext2D, ship: ShipState, sx: number, t: number) {
  ctx.save()
  ctx.translate(sx, ship.y)

  // Shield bubble while ready, drawn under the hull so the hull reads on
  // top of the glow; a progress arc while recharging.
  if (ship.shieldState === 'ready') {
    const pulse = 0.5 + 0.5 * Math.sin(t * 4)
    ctx.beginPath()
    ctx.arc(0, 0, SHIP_RADIUS + 9, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(103,232,249,${0.06 + 0.05 * pulse})`
    ctx.fill()
    ctx.strokeStyle = `rgba(103,232,249,${0.35 + 0.3 * pulse})`
    ctx.lineWidth = 1.8
    ctx.stroke()
  } else {
    const progress = Math.min(1, ship.shieldTimer / SHIELD_REGEN_TIME)
    if (progress > 0) {
      const rotation = ship.shieldTimer * 0.8
      ctx.beginPath()
      ctx.arc(0, 0, SHIP_RADIUS + 8, -Math.PI / 2 + rotation, -Math.PI / 2 + rotation + progress * Math.PI * 2)
      ctx.strokeStyle = 'rgba(103,232,249,0.45)'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }

  // Shatter: the bubble breaking into shards when it absorbs a hit.
  if (ship.shieldBreak > 0) {
    const p = 1 - ship.shieldBreak / SHIELD_BREAK_DURATION
    ctx.strokeStyle = `rgba(165,243,252,${1 - p})`
    ctx.lineWidth = 2
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3
      const r1 = SHIP_RADIUS + 9 + p * 26
      const r2 = r1 + 7 * (1 - p)
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1)
      ctx.lineTo(Math.cos(a + 0.18) * r2, Math.sin(a + 0.18) * r2)
      ctx.stroke()
    }
  }

  // A brief expanding burst when the shield finishes recharging.
  if (ship.shieldFlash > 0) {
    const p = 1 - ship.shieldFlash / SHIELD_FLASH_DURATION
    ctx.beginPath()
    ctx.arc(0, 0, SHIP_RADIUS + 6 + p * 26, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(165,243,252,${0.9 * (1 - p)})`
    ctx.lineWidth = 3
    ctx.stroke()
  }

  ctx.scale(ship.facing, 1)

  if (ship.thrusting) {
    ctx.beginPath()
    ctx.moveTo(-SHIP_RADIUS - 2, -6)
    ctx.lineTo(-SHIP_RADIUS - 18 - Math.random() * 8, 0)
    ctx.lineTo(-SHIP_RADIUS - 2, 6)
    ctx.closePath()
    const flame = ctx.createLinearGradient(-SHIP_RADIUS - 24, 0, -SHIP_RADIUS, 0)
    flame.addColorStop(0, 'rgba(251,191,36,0)')
    flame.addColorStop(0.6, 'rgba(251,191,36,0.85)')
    flame.addColorStop(1, 'rgba(254,240,138,0.95)')
    ctx.fillStyle = flame
    ctx.fill()
  }

  // Rear wings/nacelles, drawn behind the main hull.
  ctx.beginPath()
  ctx.moveTo(-SHIP_RADIUS * 0.3, -SHIP_RADIUS * 0.5)
  ctx.lineTo(-SHIP_RADIUS * 1.1, -SHIP_RADIUS * 1.15)
  ctx.lineTo(-SHIP_RADIUS * 0.7, -SHIP_RADIUS * 0.35)
  ctx.closePath()
  ctx.moveTo(-SHIP_RADIUS * 0.3, SHIP_RADIUS * 0.5)
  ctx.lineTo(-SHIP_RADIUS * 1.1, SHIP_RADIUS * 1.15)
  ctx.lineTo(-SHIP_RADIUS * 0.7, SHIP_RADIUS * 0.35)
  ctx.closePath()
  ctx.fillStyle = '#4d7c0f'
  ctx.fill()
  ctx.strokeStyle = '#a3e635'
  ctx.lineWidth = 1
  ctx.stroke()

  // Main hull, gradient-shaded for some depth instead of a flat fill.
  ctx.beginPath()
  ctx.moveTo(SHIP_RADIUS, 0)
  ctx.lineTo(-SHIP_RADIUS * 0.2, -SHIP_RADIUS * 0.7)
  ctx.lineTo(-SHIP_RADIUS, -SHIP_RADIUS * 0.55)
  ctx.lineTo(-SHIP_RADIUS * 0.55, 0)
  ctx.lineTo(-SHIP_RADIUS, SHIP_RADIUS * 0.55)
  ctx.lineTo(-SHIP_RADIUS * 0.2, SHIP_RADIUS * 0.7)
  ctx.closePath()
  const hull = ctx.createLinearGradient(-SHIP_RADIUS, -SHIP_RADIUS, SHIP_RADIUS, SHIP_RADIUS)
  hull.addColorStop(0, '#4d7c0f')
  hull.addColorStop(0.5, '#a3e635')
  hull.addColorStop(1, '#d9f99d')
  ctx.fillStyle = hull
  ctx.fill()
  ctx.strokeStyle = '#ecfccb'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Canopy.
  ctx.beginPath()
  ctx.ellipse(SHIP_RADIUS * 0.2, 0, SHIP_RADIUS * 0.4, SHIP_RADIUS * 0.28, 0, 0, Math.PI * 2)
  const canopy = ctx.createRadialGradient(SHIP_RADIUS * 0.25, -2, 1, SHIP_RADIUS * 0.2, 0, SHIP_RADIUS * 0.4)
  canopy.addColorStop(0, '#e0f2fe')
  canopy.addColorStop(1, '#0369a1')
  ctx.fillStyle = canopy
  ctx.fill()

  ctx.restore()
}

function drawHexTurret(ctx: CanvasRenderingContext2D, e: Enemy, sx: number, shipSx: number, shipY: number, dark: string, mid: string, light: string) {
  const grad = ctx.createLinearGradient(-e.radius, -e.radius, e.radius, e.radius)
  grad.addColorStop(0, dark)
  grad.addColorStop(0.5, mid)
  grad.addColorStop(1, light)
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const px = Math.cos(a) * e.radius
    const py = Math.sin(a) * e.radius
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()
  ctx.strokeStyle = light
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.save()
  ctx.rotate(Math.atan2(shipY - e.y, shipSx - sx))
  ctx.fillStyle = '#1e1b2e'
  ctx.fillRect(0, -2, e.radius * 1.4, 4)
  ctx.beginPath()
  ctx.arc(0, 0, e.radius * 0.35, 0, Math.PI * 2)
  ctx.fillStyle = '#fde68a'
  ctx.fill()
  ctx.restore()
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, sx: number, shipSx: number, shipY: number) {
  ctx.save()
  ctx.translate(sx, e.y)

  if (e.type === 'drifter') {
    // A tumbling spiked mine -- a slow ramming hazard, not a ship.
    ctx.rotate(e.rotation)
    const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, e.radius)
    grad.addColorStop(0, '#cbd5e1')
    grad.addColorStop(1, '#475569')
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * e.radius * 0.7, Math.sin(a) * e.radius * 0.7)
      ctx.lineTo(Math.cos(a) * e.radius * 1.5, Math.sin(a) * e.radius * 1.5)
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = 2
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(0, 0, e.radius * 0.75, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 0, e.radius * 0.22, 0, Math.PI * 2)
    ctx.fillStyle = '#f87171'
    ctx.fill()
  } else if (e.type === 'gunner') {
    // A turreted hull with a barrel that visibly tracks the player.
    drawHexTurret(ctx, e, sx, shipSx, shipY, '#7f1d1d', '#f87171', '#fecaca')
  } else if (e.type === 'shieldgunner') {
    drawHexTurret(ctx, e, sx, shipSx, shipY, '#312e81', '#818cf8', '#e0e7ff')
    // Front shield: a thick arc on the side it's currently guarding.
    ctx.beginPath()
    ctx.arc(0, 0, e.radius + 7, e.shieldAngle - SHIELD_HALF_ARC, e.shieldAngle + SHIELD_HALF_ARC)
    ctx.strokeStyle = 'rgba(165,243,252,0.9)'
    ctx.shadowColor = '#67e8f9'
    ctx.shadowBlur = 8
    ctx.lineWidth = 4
    ctx.stroke()
  } else if (e.type === 'diver') {
    // A swept-wing fighter silhouette with a short engine trail.
    ctx.rotate(e.rotation * 0.15)
    ctx.beginPath()
    ctx.moveTo(0, -e.radius * 1.3)
    ctx.lineTo(0, e.radius * 0.4)
    const trail = ctx.createLinearGradient(0, e.radius * 0.4, 0, e.radius * 1.4)
    trail.addColorStop(0, 'rgba(251,146,60,0.9)')
    trail.addColorStop(1, 'rgba(251,146,60,0)')
    ctx.strokeStyle = trail
    ctx.lineWidth = 3
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(0, -e.radius * 1.3)
    ctx.lineTo(e.radius, e.radius * 0.6)
    ctx.lineTo(e.radius * 0.3, e.radius * 0.2)
    ctx.lineTo(0, e.radius * 0.6)
    ctx.lineTo(-e.radius * 0.3, e.radius * 0.2)
    ctx.lineTo(-e.radius, e.radius * 0.6)
    ctx.closePath()
    const grad = ctx.createLinearGradient(-e.radius, -e.radius, e.radius, e.radius)
    grad.addColorStop(0, '#9a3412')
    grad.addColorStop(0.5, '#fb923c')
    grad.addColorStop(1, '#fed7aa')
    ctx.fillStyle = grad
    ctx.fill()
    ctx.strokeStyle = '#fed7aa'
    ctx.lineWidth = 1.5
    ctx.stroke()
  } else if (e.type === 'pod') {
    // A throbbing egg sac with three swarmers visible inside.
    const throb = 1 + 0.08 * Math.sin(e.age * 5)
    ctx.rotate(e.rotation)
    ctx.beginPath()
    ctx.ellipse(0, 0, e.radius * throb, e.radius * 0.85 * throb, 0, 0, Math.PI * 2)
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, e.radius)
    grad.addColorStop(0, 'rgba(216,180,254,0.9)')
    grad.addColorStop(1, 'rgba(107,33,168,0.85)')
    ctx.fillStyle = grad
    ctx.fill()
    ctx.strokeStyle = '#e9d5ff'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = '#bef264'
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + e.age
      ctx.beginPath()
      ctx.arc(Math.cos(a) * e.radius * 0.4, Math.sin(a) * e.radius * 0.4, 2.6, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (e.type === 'swarmer') {
    // A tiny dart pointed along its flight.
    ctx.rotate(e.vx >= 0 ? 0 : Math.PI)
    ctx.beginPath()
    ctx.moveTo(e.radius * 1.4, 0)
    ctx.lineTo(-e.radius, e.radius * 0.8)
    ctx.lineTo(-e.radius * 0.4, 0)
    ctx.lineTo(-e.radius, -e.radius * 0.8)
    ctx.closePath()
    ctx.fillStyle = '#bef264'
    ctx.shadowColor = '#bef264'
    ctx.shadowBlur = 6
    ctx.fill()
  } else if (e.type === 'layer') {
    // A flat saucer with a blinking bay light underneath.
    ctx.beginPath()
    ctx.ellipse(0, 0, e.radius * 1.4, e.radius * 0.5, 0, 0, Math.PI * 2)
    const grad = ctx.createLinearGradient(0, -e.radius * 0.5, 0, e.radius * 0.5)
    grad.addColorStop(0, '#99f6e4')
    grad.addColorStop(1, '#115e59')
    ctx.fillStyle = grad
    ctx.fill()
    ctx.strokeStyle = '#ccfbf1'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(0, -e.radius * 0.35, e.radius * 0.55, e.radius * 0.4, 0, Math.PI, 0)
    ctx.fillStyle = 'rgba(204,251,241,0.6)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(0, e.radius * 0.55, 3, 0, Math.PI * 2)
    ctx.fillStyle = Math.sin(e.age * 10) > 0 ? '#f87171' : '#7f1d1d'
    ctx.fill()
  } else if (e.type === 'mine') {
    // Small spiked mine; blinks faster as it nears expiry.
    ctx.rotate(e.rotation)
    ctx.strokeStyle = '#fca5a5'
    ctx.lineWidth = 1.5
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * e.radius * 0.6, Math.sin(a) * e.radius * 0.6)
      ctx.lineTo(Math.cos(a) * e.radius * 1.3, Math.sin(a) * e.radius * 1.3)
      ctx.stroke()
    }
    const blinkRate = 4 + e.age * 0.6
    ctx.beginPath()
    ctx.arc(0, 0, e.radius * 0.7, 0, Math.PI * 2)
    ctx.fillStyle = Math.sin(e.age * blinkRate) > 0 ? '#ef4444' : '#7f1d1d'
    ctx.fill()
  } else if (e.type === 'carrier') {
    drawCarrier(ctx, e, shipSx - sx)
  }
  ctx.restore()

  if (e.hitFlash > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(0.7, (e.hitFlash / HIT_FLASH) * 0.7)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(sx, e.y, e.type === 'carrier' ? e.radius * 0.45 : e.radius * 0.9, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

// The carrier mini-boss: a long armored hull whose central hatch slides
// open on a cycle to expose the glowing core -- the only time it can be hurt.
function drawCarrier(ctx: CanvasRenderingContext2D, e: Enemy, dxToShip: number) {
  const r = e.radius
  const open = carrierHatchOpen(e)
  ctx.scale(dxToShip >= 0 ? 1 : -1, 1)

  // engine glow at the stern
  const flicker = 0.7 + 0.3 * Math.sin(e.age * 30)
  ctx.fillStyle = `rgba(251,113,133,${0.5 * flicker})`
  ctx.beginPath()
  ctx.ellipse(-r * 1.35, 0, r * 0.35 * flicker, r * 0.25, 0, 0, Math.PI * 2)
  ctx.fill()

  // hull
  ctx.beginPath()
  ctx.moveTo(r * 1.4, 0)
  ctx.lineTo(r * 0.9, -r * 0.55)
  ctx.lineTo(-r * 1.1, -r * 0.6)
  ctx.lineTo(-r * 1.3, -r * 0.25)
  ctx.lineTo(-r * 1.3, r * 0.25)
  ctx.lineTo(-r * 1.1, r * 0.6)
  ctx.lineTo(r * 0.9, r * 0.55)
  ctx.closePath()
  const hull = ctx.createLinearGradient(0, -r * 0.6, 0, r * 0.6)
  hull.addColorStop(0, '#4b5563')
  hull.addColorStop(0.5, '#1f2937')
  hull.addColorStop(1, '#111827')
  ctx.fillStyle = hull
  ctx.fill()
  ctx.strokeStyle = '#fb7185'
  ctx.lineWidth = 2
  ctx.stroke()

  // running lights
  for (let i = 0; i < 4; i++) {
    const on = Math.sin(e.age * 4 - i) > 0
    ctx.fillStyle = on ? '#fda4af' : '#4c0519'
    ctx.fillRect(-r * 0.9 + i * r * 0.45, -r * 0.5, 3, 3)
    ctx.fillRect(-r * 0.9 + i * r * 0.45, r * 0.5 - 3, 3, 3)
  }

  // core, visible only while the hatch is open
  if (open) {
    const pulse = 0.85 + 0.15 * Math.sin(e.age * 12)
    const core = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 0.38 * pulse)
    core.addColorStop(0, '#fff1f2')
    core.addColorStop(0.5, '#fb7185')
    core.addColorStop(1, 'rgba(225,29,72,0.2)')
    ctx.fillStyle = core
    ctx.shadowColor = '#f43f5e'
    ctx.shadowBlur = 16
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.38 * pulse, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  }

  // hatch doors: closed over the core, or slid apart
  const slide = open ? r * 0.42 : 0
  ctx.fillStyle = '#374151'
  ctx.strokeStyle = '#9ca3af'
  ctx.lineWidth = 1
  for (const side of [-1, 1]) {
    const x = side * slide + (side < 0 ? -r * 0.42 : 0)
    ctx.fillRect(x, -r * 0.42, r * 0.42, r * 0.84)
    ctx.strokeRect(x, -r * 0.42, r * 0.42, r * 0.84)
  }
  if (!open) {
    ctx.strokeStyle = 'rgba(251,191,36,0.6)'
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath()
      ctx.moveTo(-r * 0.4, i * r * 0.15)
      ctx.lineTo(r * 0.4, i * r * 0.15)
      ctx.stroke()
    }
  }
}

// Jagged rock outline, same idea as gravity-well's asteroid rendering: a
// ring of points whose radius wobbles based on a per-asteroid seed, so each
// one reads as a distinct chunk of debris rather than a plain circle.
function drawAsteroid(ctx: CanvasRenderingContext2D, a: Asteroid, sx: number) {
  ctx.save()
  ctx.translate(sx, a.y)
  ctx.rotate(a.rotation)
  const bumps = 9
  ctx.beginPath()
  for (let i = 0; i <= bumps; i++) {
    const angle = (i / bumps) * Math.PI * 2
    const r = a.radius * (0.78 + 0.22 * Math.sin(a.jagSeed + i * 2.3) * Math.cos(a.jagSeed * 1.7 + i))
    const px = Math.cos(angle) * r
    const py = Math.sin(angle) * r
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  const grad = ctx.createRadialGradient(-a.radius * 0.3, -a.radius * 0.3, a.radius * 0.1, 0, 0, a.radius * 1.15)
  grad.addColorStop(0, '#b5b0a8')
  grad.addColorStop(1, '#4a453e')
  ctx.fillStyle = grad
  ctx.fill()
  ctx.strokeStyle = '#78716c'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.restore()
}

function drawExplosion(ctx: CanvasRenderingContext2D, ex: Explosion, sx: number) {
  const t = ex.age / ex.duration
  ctx.save()
  ctx.translate(sx, ex.y)
  for (const p of ex.particles) {
    const dist = p.speed * ex.age
    const px = Math.cos(p.angle) * dist
    const py = Math.sin(p.angle) * dist
    const alpha = Math.max(0, 1 - t)
    ctx.beginPath()
    ctx.arc(px, py, Math.max(0.4, p.size * (1 - t)), 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.globalAlpha = alpha
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.restore()
}

function drawPowerup(ctx: CanvasRenderingContext2D, p: Powerup, sx: number, pulse: number) {
  ctx.save()
  ctx.translate(sx, p.y)
  const glowR = POWERUP_RADIUS * (1.6 + 0.3 * pulse)
  const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, glowR)
  const color = p.type === 'fuel' ? '251,191,36' : '34,211,238'
  glow.addColorStop(0, `rgba(${color},0.35)`)
  glow.addColorStop(1, `rgba(${color},0)`)
  ctx.beginPath()
  ctx.arc(0, 0, glowR, 0, Math.PI * 2)
  ctx.fillStyle = glow
  ctx.fill()

  if (p.type === 'fuel') {
    ctx.fillStyle = '#fbbf24'
    ctx.beginPath()
    ctx.arc(0, 0, POWERUP_RADIUS * 0.8, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#fde68a'
    ctx.lineWidth = 1.5
    ctx.stroke()
  } else {
    ctx.fillStyle = '#22d3ee'
    ctx.beginPath()
    ctx.moveTo(0, -POWERUP_RADIUS)
    ctx.lineTo(POWERUP_RADIUS * 0.75, 0)
    ctx.lineTo(0, POWERUP_RADIUS)
    ctx.lineTo(-POWERUP_RADIUS * 0.75, 0)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#a5f3fc'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
  ctx.restore()
}

function drawGauge(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, color: string, label: string, warn = false, t = 0) {
  // Below LOW_THRESHOLD the gauge pulses red so it catches the eye.
  const blink = warn && Math.sin(t * 10) > 0
  ctx.fillStyle = warn ? 'rgba(248,113,113,0.25)' : 'rgba(255,255,255,0.15)'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = blink ? '#f87171' : color
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h)
  ctx.strokeStyle = warn ? '#f87171' : 'rgba(255,255,255,0.4)'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, w, h)
  ctx.fillStyle = warn ? '#fca5a5' : '#e5e7eb'
  ctx.font = warn ? 'bold 11px sans-serif' : '11px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(warn ? `${label} LOW` : label, x, y - 4)
}

const RADAR_COLORS: Record<EnemyType, string> = {
  drifter: '#94a3b8',
  gunner: '#f87171',
  diver: '#fb923c',
  pod: '#c084fc',
  swarmer: '#bef264',
  layer: '#2dd4bf',
  mine: '#ef4444',
  shieldgunner: '#818cf8',
  carrier: '#fb7185',
}

// One distinct shape per enemy type, so the radar reads by silhouette as
// well as color.
function drawRadarMarker(ctx: CanvasRenderingContext2D, type: EnemyType, x: number, cy: number, t: number) {
  ctx.fillStyle = RADAR_COLORS[type]
  ctx.strokeStyle = RADAR_COLORS[type]
  ctx.lineWidth = 1
  switch (type) {
    case 'drifter':
      ctx.beginPath()
      ctx.arc(x, cy, 1.6, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'gunner':
      ctx.fillRect(x - 2, cy - 2, 4, 4)
      break
    case 'shieldgunner':
      ctx.strokeRect(x - 2.5, cy - 2.5, 5, 5)
      break
    case 'diver':
      ctx.beginPath()
      ctx.moveTo(x, cy - 3)
      ctx.lineTo(x + 2.6, cy + 2.4)
      ctx.lineTo(x - 2.6, cy + 2.4)
      ctx.closePath()
      ctx.fill()
      break
    case 'pod':
      ctx.beginPath()
      ctx.arc(x, cy, 2.8, 0, Math.PI * 2)
      ctx.stroke()
      break
    case 'layer':
      ctx.beginPath()
      ctx.moveTo(x, cy - 3)
      ctx.lineTo(x + 3, cy)
      ctx.lineTo(x, cy + 3)
      ctx.lineTo(x - 3, cy)
      ctx.closePath()
      ctx.fill()
      break
    case 'swarmer':
    case 'mine':
      ctx.fillRect(x - 0.6, cy - 0.6, 1.2, 1.2)
      break
    case 'carrier':
      if (Math.sin(t * 8) > -0.3) ctx.fillRect(x - 4, cy - 4, 8, 8)
      break
  }
}

function drawRadar(ctx: CanvasRenderingContext2D, gs: GameState) {
  // Radar: the whole wraparound world compressed into one strip, spec.md
  // section 9 -- markers for the player, enemies, and powerups so threats
  // approaching from off-screen are still visible.
  const radarY = VIEW_HEIGHT - 22
  const radarH = 10
  const radarW = VIEW_WIDTH - 32
  const radarX = 16
  const cy = radarY + radarH / 2
  const toRadarX = (worldX: number) => radarX + (wrap(worldX, WORLD_WIDTH) / WORLD_WIDTH) * radarW

  ctx.fillStyle = 'rgba(3,4,10,0.75)'
  ctx.fillRect(radarX, radarY, radarW, radarH)

  // the ridge, as a faint skyline along the strip's floor
  ctx.strokeStyle = 'rgba(167,139,250,0.45)'
  ctx.lineWidth = 1
  ctx.beginPath()
  RIDGE.forEach((h, i) => {
    const x = radarX + (i / RIDGE.length) * radarW
    const y = radarY + radarH - (h / 55) * 5
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()

  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.strokeRect(radarX, radarY, radarW, radarH)

  // bracket around the part of the loop currently on screen (split in two
  // when it straddles the wrap seam)
  const viewLeft = wrap(cameraX(gs) - VIEW_WIDTH / 2, WORLD_WIDTH)
  const spanW = (VIEW_WIDTH / WORLD_WIDTH) * radarW
  const startX = radarX + (viewLeft / WORLD_WIDTH) * radarW
  ctx.strokeStyle = 'rgba(163,230,53,0.65)'
  ctx.lineWidth = 1.2
  const bracket = (x: number, w: number) => ctx.strokeRect(x, radarY - 3, w, radarH + 6)
  if (startX + spanW <= radarX + radarW) bracket(startX, spanW)
  else {
    const firstW = radarX + radarW - startX
    bracket(startX, firstW)
    bracket(radarX, spanW - firstW)
  }

  for (const a of gs.asteroids) {
    ctx.fillStyle = '#78716c'
    ctx.fillRect(toRadarX(a.worldX) - 1, radarY + 1, 2, 8)
  }
  for (const p of gs.powerups) {
    ctx.fillStyle = p.type === 'fuel' ? '#fbbf24' : '#22d3ee'
    ctx.fillRect(toRadarX(p.worldX) - 1, radarY + 1, 2, 8)
  }
  for (const e of gs.enemies) drawRadarMarker(ctx, e.type, toRadarX(e.worldX), cy, gs.elapsed)
  ctx.fillStyle = '#a3e635'
  ctx.fillRect(toRadarX(gs.ship.worldX) - 1.5, radarY - 2, 3, 14)
}

function drawHud(ctx: CanvasRenderingContext2D, gs: GameState) {
  ctx.fillStyle = '#e5e7eb'
  ctx.font = 'bold 18px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(`Score: ${Math.floor(gs.score)}`, 16, 26)

  // Combo multiplier with a bar draining over the combo window.
  if (gs.combo >= 2) {
    const pop = Math.max(0, gs.comboTimer - (COMBO_WINDOW - 0.15)) * 4
    ctx.font = `bold ${16 + pop * 8}px sans-serif`
    ctx.fillStyle = gs.combo >= COMBO_MAX ? '#f472b6' : '#fde047'
    ctx.fillText(`×${gs.combo} COMBO`, 16, 50)
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.fillRect(16, 56, 100, 4)
    ctx.fillStyle = gs.combo >= COMBO_MAX ? '#f472b6' : '#fde047'
    ctx.fillRect(16, 56, 100 * (gs.comboTimer / COMBO_WINDOW), 4)
  }

  const gaugeW = 140
  const gx = VIEW_WIDTH - gaugeW - 16
  const fuelFrac = gs.ship.fuel / FUEL_MAX
  const crystalFrac = gs.ship.crystals / CRYSTAL_MAX
  drawGauge(ctx, gx, 20, gaugeW, 10, fuelFrac, '#fbbf24', 'Fuel', fuelFrac < LOW_THRESHOLD, gs.elapsed)
  drawGauge(ctx, gx, 46, gaugeW, 10, crystalFrac, '#22d3ee', 'Crystals', crystalFrac < LOW_THRESHOLD, gs.elapsed)

  for (let i = 0; i < HEALTH_MAX; i++) {
    ctx.beginPath()
    ctx.arc(gx + i * 18, 70, 6, 0, Math.PI * 2)
    ctx.fillStyle = i < gs.ship.health ? '#4ade80' : 'rgba(255,255,255,0.15)'
    ctx.fill()
  }

  ctx.textAlign = 'left'
  if (gs.ship.shieldState === 'ready') {
    ctx.fillStyle = gs.ship.shieldFlash > 0 ? '#ffffff' : '#67e8f9'
    ctx.font = 'bold 11px sans-serif'
    ctx.fillText('Shield ready', gx, 92)
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.font = '11px sans-serif'
    ctx.fillText(`Shield in ${Math.max(0, Math.ceil(SHIELD_REGEN_TIME - gs.ship.shieldTimer))}s`, gx, 92)
  }

  // Nova Bomb readout: charge count plus a thin recharge progress bar
  // whenever a charge is still filling.
  const novaY = 108
  ctx.fillStyle = gs.novaCharges > 0 ? '#fde047' : 'rgba(255,255,255,0.4)'
  ctx.font = 'bold 12px sans-serif'
  ctx.fillText(`NOVA ×${gs.novaCharges} (C)`, gx, novaY)
  if (gs.novaCharges < NOVA_MAX_CHARGES) {
    drawGauge(ctx, gx, novaY + 16, gaugeW, 6, gs.novaTimer / NOVA_RECHARGE_TIME, '#fde047', '')
  }

  if (gs.escalationBannerTimer > 0) {
    const alpha = Math.min(1, gs.escalationBannerTimer / 0.4)
    ctx.textAlign = 'center'
    ctx.font = 'bold 22px sans-serif'
    ctx.fillStyle = `rgba(248,113,113,${alpha})`
    ctx.fillText(gs.escalationText, VIEW_WIDTH / 2, 60)
    ctx.textAlign = 'left'
  }

  const carrier = gs.enemies.find((e) => e.type === 'carrier')
  if (carrier) {
    const w = 260
    const x = VIEW_WIDTH / 2 - w / 2
    const y = 84
    ctx.textAlign = 'center'
    ctx.font = 'bold 11px sans-serif'
    ctx.fillStyle = '#fda4af'
    ctx.fillText(carrierHatchOpen(carrier) ? 'CARRIER — CORE EXPOSED' : 'CARRIER', VIEW_WIDTH / 2, y - 4)
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.fillRect(x, y, w, 7)
    ctx.fillStyle = '#f43f5e'
    ctx.fillRect(x, y, w * (carrier.health / carrier.maxHealth), 7)
    ctx.strokeStyle = 'rgba(253,164,175,0.6)'
    ctx.strokeRect(x, y, w, 7)
  }

  drawRadar(ctx, gs)
}

// Whether a projectile's path this frame (not just its end point) passed
// within `r` of a target -- fast lasers would otherwise skip clean over
// small enemies on a slow frame. Also returns the projectile's offset from
// the target at the start of the frame, i.e. the direction it came from.
function sweptHit(p: Projectile, dt: number, targetX: number, targetY: number, r: number): { hit: boolean; fromDx: number; fromDy: number } {
  const ex = wrapDelta(p.worldX, targetX, WORLD_WIDTH)
  const ey = p.y - targetY
  const sx = ex - p.vx * dt
  const sy = ey - p.vy * dt
  const dx = ex - sx
  const dy = ey - sy
  const len2 = dx * dx + dy * dy
  const u = len2 > 0 ? Math.max(0, Math.min(1, -(sx * dx + sy * dy) / len2)) : 0
  const cx = sx + dx * u
  const cy = sy + dy * u
  return { hit: cx * cx + cy * cy < r * r, fromDx: sx, fromDy: sy }
}

function Starwarden() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [isNewBest, setIsNewBest] = useState(false)
  const [finalScore, setFinalScore] = useState(0)
  const [finalTime, setFinalTime] = useState(0)
  const [finalLevel, setFinalLevel] = useState(1)
  const [muted, setMuted] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const phaseRef = useRef<Phase>('intro')
  const gsRef = useRef<GameState>(newGame(1))
  const starLayersRef = useRef(makeStarLayers(makeRng(7)))
  const keysRef = useRef({ up: false, down: false, left: false, right: false, thrust: false, fire: false, nova: false })
  // Edge-detects the nova key so holding it down doesn't burn every charge
  // in a single press -- only a fresh keydown (or touch tap) fires it.
  const novaPrevRef = useRef(false)

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    function onDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase()
      const k = keysRef.current
      if (key === 'arrowup' || key === 'w') k.up = true
      else if (key === 'arrowdown' || key === 's') k.down = true
      else if (key === 'arrowleft' || key === 'a') k.left = true
      else if (key === 'arrowright' || key === 'd') k.right = true
      // Thrust (Z) and fire (X) are adjacent keys, both reachable by the
      // same hand as a single unit.
      else if (key === 'z') k.thrust = true
      else if (key === 'x') k.fire = true
      else if (key === 'c') k.nova = true
      else return
      e.preventDefault()
    }
    function onUp(e: KeyboardEvent) {
      const key = e.key.toLowerCase()
      const k = keysRef.current
      if (key === 'arrowup' || key === 'w') k.up = false
      else if (key === 'arrowdown' || key === 's') k.down = false
      else if (key === 'arrowleft' || key === 'a') k.left = false
      else if (key === 'arrowright' || key === 'd') k.right = false
      else if (key === 'z') k.thrust = false
      else if (key === 'x') k.fire = false
      else if (key === 'c') k.nova = false
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  function addFloater(gs: GameState, worldX: number, y: number, text: string, color: string) {
    gs.floaters.push({ id: gs.idCounter++, worldX, y, text, color, age: 0 })
  }

  function dropPowerup(gs: GameState, worldX: number, y: number, type?: PowerupType) {
    const drop = spawnPowerup(gs.rng, WORLD_WIDTH, gs.idCounter++, type)
    gs.powerups.push({ ...drop, worldX, y })
  }

  // Bumps the combo for a kill and returns the multiplied points.
  function comboPoints(gs: GameState, base: number): number {
    gs.combo = gs.comboTimer > 0 ? Math.min(COMBO_MAX, gs.combo + 1) : 1
    gs.comboTimer = COMBO_WINDOW
    return base * gs.combo
  }

  // Scores and resolves an enemy destroyed by the player (laser or Nova):
  // combo-multiplied points, a floating score label, drops, and anything
  // the death releases (a pod's swarmers). Returns spawned enemies for the
  // caller to add once it's done iterating.
  function killEnemy(gs: GameState, e: Enemy): Enemy[] {
    const points = comboPoints(gs, ENEMY_POINTS[e.type])
    gs.score += points
    const big = e.type === 'carrier'
    addFloater(gs, e.worldX, e.y - e.radius, `+${points}`, gs.combo >= 2 ? '#fde047' : '#e5e7eb')
    gs.explosions.push(spawnExplosion(gs.rng, e.worldX, e.y, gs.idCounter++, big ? 'large' : 'small'))
    audio.playExplosion(big ? 'large' : 'small')
    if (big) {
      // The carrier always pays out a full resupply.
      dropPowerup(gs, e.worldX - 30, e.y, 'fuel')
      dropPowerup(gs, e.worldX + 30, e.y, 'crystal')
      gs.shakeTimer = SHAKE_DURATION
      gs.escalationBannerTimer = ESCALATION_BANNER_DURATION
      gs.escalationText = 'CARRIER DESTROYED'
    } else if (gs.rng.next() < ENEMY_DROP_CHANCE) {
      dropPowerup(gs, e.worldX, e.y)
    }
    return e.type === 'pod' ? spawnSwarmers(gs.rng, e, () => gs.idCounter++) : []
  }

  function killAsteroid(gs: GameState, a: Asteroid) {
    const points = comboPoints(gs, ASTEROID_POINTS)
    gs.score += points
    addFloater(gs, a.worldX, a.y - a.radius, `+${points}`, gs.combo >= 2 ? '#fde047' : '#e5e7eb')
    gs.explosions.push(spawnExplosion(gs.rng, a.worldX, a.y, gs.idCounter++, 'small'))
    audio.playExplosion('small')
  }

  function update(dt: number) {
    const gs = gsRef.current
    gs.elapsed += dt

    const input: ShipInput = { ...keysRef.current }
    const wasThrusting = gs.ship.thrusting
    gs.ship = stepShip(gs.ship, input, dt)
    if (gs.ship.thrusting !== wasThrusting) audio.setThrusterOn(gs.ship.thrusting)

    // Ease the camera toward a lead ahead of the ship's facing.
    const leadTarget = gs.ship.facing * CAMERA_LEAD
    gs.cameraLead += (leadTarget - gs.cameraLead) * Math.min(1, CAMERA_LEAD_RATE * dt)
    const camX = cameraX(gs)

    gs.shakeTimer = Math.max(0, gs.shakeTimer - dt)
    gs.damageFlashTimer = Math.max(0, gs.damageFlashTimer - dt)
    gs.comboTimer = Math.max(0, gs.comboTimer - dt)
    if (gs.comboTimer === 0) gs.combo = 0
    gs.floaters = gs.floaters.map((f) => ({ ...f, age: f.age + dt })).filter((f) => f.age < FLOATER_DURATION)

    gs.fireCooldown = Math.max(0, gs.fireCooldown - dt)
    if (keysRef.current.fire && gs.fireCooldown <= 0 && gs.ship.crystals > 0) {
      gs.ship = { ...gs.ship, crystals: gs.ship.crystals - 1 }
      gs.projectiles.push({
        id: gs.idCounter++,
        worldX: gs.ship.worldX,
        y: gs.ship.y,
        // Lasers inherit the ship's own speed, so shots still pull well
        // ahead when chasing something at full thrust.
        vx: gs.ship.facing * LASER_SPEED + gs.ship.vx,
        vy: 0,
        owner: 'player',
        life: 1.4,
      })
      gs.fireCooldown = LASER_COOLDOWN
      audio.playLaser()
    }

    // Nova Bomb recharge: a passive trickle, capped so charges can't be
    // stockpiled forever.
    if (gs.novaCharges < NOVA_MAX_CHARGES) {
      gs.novaTimer += dt
      if (gs.novaTimer >= NOVA_RECHARGE_TIME) {
        gs.novaCharges += 1
        gs.novaTimer = 0
      }
    }
    gs.novaFlashTimer = Math.max(0, gs.novaFlashTimer - dt)

    const spawned: Enemy[] = []

    // Nova Bomb trigger: edge-detected so holding the key doesn't burn
    // every charge in one press. Clears everything currently on screen
    // (enemies, asteroids, enemy projectiles) -- off-screen threats
    // elsewhere on the wraparound loop are untouched, so it's a panic
    // button for the immediate danger, not a whole-run reset. The carrier
    // is too big to clear outright; it takes a heavy hit instead.
    const novaPressed = keysRef.current.nova && !novaPrevRef.current
    novaPrevRef.current = keysRef.current.nova
    if (novaPressed && gs.novaCharges > 0) {
      gs.novaCharges -= 1
      gs.novaFlashTimer = NOVA_FLASH_DURATION
      gs.shakeTimer = SHAKE_DURATION * 0.6
      audio.playNova()
      const onScreen = (worldX: number) => {
        const sx = screenX(worldX, camX)
        return sx > -NOVA_CLEAR_MARGIN && sx < VIEW_WIDTH + NOVA_CLEAR_MARGIN
      }
      const killed = new Set<number>()
      for (const e of gs.enemies) {
        if (!onScreen(e.worldX)) continue
        if (e.type === 'carrier') {
          e.health -= NOVA_CARRIER_DAMAGE
          e.hitFlash = HIT_FLASH * 3
          if (e.health > 0) continue
        }
        killed.add(e.id)
        spawned.push(...killEnemy(gs, e))
      }
      for (const a of gs.asteroids) if (onScreen(a.worldX)) killAsteroid(gs, a)
      gs.enemies = gs.enemies.filter((e) => !killed.has(e.id))
      gs.asteroids = gs.asteroids.filter((a) => !onScreen(a.worldX))
      gs.projectiles = gs.projectiles.filter((p) => p.owner !== 'enemy' || !onScreen(p.worldX))
    }

    const level = enemyLevel(gs.elapsed)
    if (level > gs.enemyLevel) {
      // A new escalation level: announce it, and throw in an immediate
      // burst of enemies at the new level's mix rather than waiting for
      // the regular spawn timer to slowly catch up. Every CARRIER_EVERY
      // levels the carrier mini-boss arrives too (one at a time).
      gs.enemyLevel = level
      gs.escalationBannerTimer = ESCALATION_BANNER_DURATION
      const shown = level + 1
      const carrierDue = shown % CARRIER_EVERY === 0 && !gs.enemies.some((e) => e.type === 'carrier')
      gs.escalationText = carrierDue ? `⚠ CARRIER INBOUND — LEVEL ${shown}` : `⚠ ENEMIES ESCALATING — LEVEL ${shown}`
      audio.playEscalation()
      if (carrierDue) gs.enemies.push(spawnCarrier(gs.rng, gs.ship, WORLD_WIDTH, gs.idCounter++))
      for (let i = 0; i < ESCALATION_BURST_COUNT; i++) {
        gs.enemies.push(spawnEnemy(gs.rng, level, WORLD_WIDTH, gs.idCounter++, camX))
      }
    }
    gs.escalationBannerTimer = Math.max(0, gs.escalationBannerTimer - dt)

    gs.spawnTimer -= dt
    if (gs.spawnTimer <= 0) {
      gs.enemies.push(spawnEnemy(gs.rng, gs.enemyLevel, WORLD_WIDTH, gs.idCounter++, camX))
      gs.spawnTimer = spawnInterval(gs.enemyLevel) * gs.rng.range(0.7, 1.3)
    }

    gs.asteroidTimer -= dt
    if (gs.asteroidTimer <= 0) {
      gs.asteroids.push(spawnAsteroid(gs.rng, WORLD_WIDTH, gs.idCounter++))
      gs.asteroidTimer = ASTEROID_INTERVAL * gs.rng.range(0.75, 1.4)
    }

    gs.powerupTimer -= dt
    if (gs.powerupTimer <= 0) {
      gs.powerups.push(spawnPowerup(gs.rng, WORLD_WIDTH, gs.idCounter++))
      gs.powerupTimer = STANDALONE_INTERVAL * gs.rng.range(0.7, 1.3)
    }

    const stepResult = stepEnemies(gs.enemies, gs.ship, WORLD_WIDTH, dt, () => gs.idCounter++, gs.enemyLevel, gs.rng)
    gs.enemies = stepResult.enemies.concat(stepResult.newEnemies)
    gs.projectiles.push(...stepResult.newProjectiles)
    gs.projectiles = stepProjectiles(gs.projectiles, WORLD_WIDTH, dt)
    gs.asteroids = stepAsteroids(gs.asteroids, WORLD_WIDTH, dt)
    gs.explosions = stepExplosions(gs.explosions, dt)

    // Player lasers vs enemies and asteroids. Shield gunners' shields and a
    // carrier's closed hatch deflect the shot instead of taking damage.
    const deadEnemyIds = new Set<number>()
    const deadAsteroidIds = new Set<number>()
    const consumedProjectileIds = new Set<number>()
    for (const proj of gs.projectiles) {
      if (proj.owner !== 'player' || consumedProjectileIds.has(proj.id)) continue
      for (const e of gs.enemies) {
        if (deadEnemyIds.has(e.id)) continue
        const { hit, fromDx, fromDy } = sweptHit(proj, dt, e.worldX, e.y, e.radius + 3)
        if (!hit) continue
        consumedProjectileIds.add(proj.id)
        if (shieldBlocks(e, fromDx, fromDy) || (e.type === 'carrier' && !carrierHatchOpen(e))) {
          gs.explosions.push(spawnExplosion(gs.rng, proj.worldX, proj.y, gs.idCounter++, 'spark'))
          audio.playDeflect()
          break
        }
        e.health -= 1
        e.hitFlash = HIT_FLASH
        if (e.health <= 0) {
          deadEnemyIds.add(e.id)
          spawned.push(...killEnemy(gs, e))
        }
        break
      }
    }
    for (const proj of gs.projectiles) {
      if (proj.owner !== 'player' || consumedProjectileIds.has(proj.id)) continue
      for (const a of gs.asteroids) {
        if (deadAsteroidIds.has(a.id)) continue
        if (!sweptHit(proj, dt, a.worldX, a.y, a.radius + 3).hit) continue
        consumedProjectileIds.add(proj.id)
        a.health -= 1
        if (a.health <= 0) {
          deadAsteroidIds.add(a.id)
          killAsteroid(gs, a)
        }
        break
      }
    }

    // Gather this frame's would-be damage sources against the ship (enemy
    // lasers, ramming enemies, ramming asteroids) before applying anything,
    // so the shield can absorb the first one if it's up.
    let hits = 0
    for (const proj of gs.projectiles) {
      if (proj.owner !== 'enemy' || consumedProjectileIds.has(proj.id)) continue
      const dist = Math.hypot(wrapDelta(proj.worldX, gs.ship.worldX, WORLD_WIDTH), proj.y - gs.ship.y)
      if (dist < SHIP_RADIUS + RAM_DAMAGE_RADIUS_PAD) {
        consumedProjectileIds.add(proj.id)
        hits += 1
      }
    }
    for (const e of gs.enemies) {
      if (deadEnemyIds.has(e.id)) continue
      const dist = Math.hypot(wrapDelta(e.worldX, gs.ship.worldX, WORLD_WIDTH), e.y - gs.ship.y)
      if (dist >= SHIP_RADIUS + e.radius) continue
      if (e.type === 'carrier') {
        // The carrier survives a ram; its hull hurts at most once a second
        // so overlapping it isn't an instant, multi-hit death.
        if (e.ramCooldown <= 0) {
          e.ramCooldown = CARRIER_RAM_COOLDOWN
          hits += 1
        }
        continue
      }
      deadEnemyIds.add(e.id)
      gs.explosions.push(spawnExplosion(gs.rng, e.worldX, e.y, gs.idCounter++, 'small'))
      audio.playExplosion('small')
      hits += 1
    }
    for (const a of gs.asteroids) {
      if (deadAsteroidIds.has(a.id)) continue
      const dist = Math.hypot(wrapDelta(a.worldX, gs.ship.worldX, WORLD_WIDTH), a.y - gs.ship.y)
      if (dist < SHIP_RADIUS + a.radius) {
        deadAsteroidIds.add(a.id)
        gs.score += ASTEROID_POINTS
        gs.explosions.push(spawnExplosion(gs.rng, a.worldX, a.y, gs.idCounter++, 'small'))
        audio.playExplosion('small')
        hits += 1
      }
    }

    if (deadEnemyIds.size > 0) gs.enemies = gs.enemies.filter((e) => !deadEnemyIds.has(e.id))
    if (spawned.length > 0) gs.enemies.push(...spawned)
    if (deadAsteroidIds.size > 0) gs.asteroids = gs.asteroids.filter((a) => !deadAsteroidIds.has(a.id))
    if (consumedProjectileIds.size > 0) gs.projectiles = gs.projectiles.filter((p) => !consumedProjectileIds.has(p.id))

    // Powerup pickups.
    const collectedIds = new Set<number>()
    for (const p of gs.powerups) {
      const dist = Math.hypot(wrapDelta(p.worldX, gs.ship.worldX, WORLD_WIDTH), p.y - gs.ship.y)
      if (dist < SHIP_RADIUS + POWERUP_RADIUS) {
        collectedIds.add(p.id)
        if (p.type === 'fuel') gs.ship = { ...gs.ship, fuel: Math.min(FUEL_MAX, gs.ship.fuel + FUEL_RESTORE) }
        else gs.ship = { ...gs.ship, crystals: Math.min(CRYSTAL_MAX, gs.ship.crystals + CRYSTAL_RESTORE) }
        audio.playPowerup()
      }
    }
    if (collectedIds.size > 0) gs.powerups = gs.powerups.filter((p) => !collectedIds.has(p.id))

    // Low-resource warnings: one beep per drop below the threshold.
    const fuelFrac = gs.ship.fuel / FUEL_MAX
    const crystalFrac = gs.ship.crystals / CRYSTAL_MAX
    if (fuelFrac < LOW_THRESHOLD && !gs.lowFuelWarned) {
      gs.lowFuelWarned = true
      audio.playLowWarning()
    } else if (fuelFrac > LOW_REARM) gs.lowFuelWarned = false
    if (crystalFrac < LOW_THRESHOLD && !gs.lowCrystalWarned) {
      gs.lowCrystalWarned = true
      audio.playLowWarning()
    } else if (crystalFrac > LOW_REARM) gs.lowCrystalWarned = false

    // Resolve the shield: while ready it absorbs the first hit of the frame
    // and starts recharging from zero. While recharging, a frame with a hit
    // simply doesn't count toward the recharge -- progress pauses rather
    // than resetting.
    let { shieldState, shieldTimer } = gs.ship
    let shieldFlash = Math.max(0, gs.ship.shieldFlash - dt)
    let shieldBreak = Math.max(0, gs.ship.shieldBreak - dt)
    if (shieldState === 'ready') {
      if (hits > 0) {
        hits -= 1
        shieldState = 'charging'
        shieldTimer = 0
        shieldBreak = SHIELD_BREAK_DURATION
        audio.playShieldBreak()
      }
    } else if (hits === 0) {
      shieldTimer += dt
      if (shieldTimer >= SHIELD_REGEN_TIME) {
        shieldState = 'ready'
        shieldTimer = 0
        shieldFlash = SHIELD_FLASH_DURATION
        audio.playShieldRegen()
      }
    }

    gs.ship = { ...gs.ship, shieldState, shieldTimer, shieldFlash, shieldBreak }
    if (hits > 0) {
      gs.ship = { ...gs.ship, health: gs.ship.health - hits }
      gs.shakeTimer = SHAKE_DURATION
      gs.damageFlashTimer = DAMAGE_FLASH_DURATION
      gs.combo = 0
      gs.comboTimer = 0
      audio.playHit()
    }

    gs.score += survivalPoints(dt)

    if (gs.ship.health <= 0) {
      gs.explosions.push(spawnExplosion(gs.rng, gs.ship.worldX, gs.ship.y, gs.idCounter++, 'large'))
      audio.playExplosion('large')
      audio.playGameOver()
      audio.setThrusterOn(false)
      const finalized = Math.floor(gs.score)
      const shownLevel = gs.enemyLevel + 1
      const result = recordRun(finalized, gs.elapsed, shownLevel)
      setFinalScore(finalized)
      setFinalTime(gs.elapsed)
      setFinalLevel(shownLevel)
      setProgress(result.progress)
      setIsNewBest(result.isNewBest)
      setPhase('gameover')
    }
  }

  function draw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const gs = gsRef.current
    const camX = cameraX(gs)
    const shipSx = VIEW_WIDTH / 2 - gs.cameraLead

    ctx.fillStyle = '#03040a'
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
    drawStarLayers(ctx, starLayersRef.current, camX, gs.ship.vx, gs.ship.thrusting)
    drawRidge(ctx, camX)

    // Everything in the world shakes on impact; the HUD stays put.
    ctx.save()
    if (gs.shakeTimer > 0) {
      const mag = SHAKE_MAGNITUDE * (gs.shakeTimer / SHAKE_DURATION)
      ctx.translate((Math.random() * 2 - 1) * mag, (Math.random() * 2 - 1) * mag)
    }

    const visible = (sx: number, margin: number) => sx > -margin && sx < VIEW_WIDTH + margin
    const pulse = 0.5 + 0.5 * Math.sin(gs.elapsed * 3)
    for (const p of gs.powerups) {
      const sx = screenX(p.worldX, camX)
      if (visible(sx, 30)) drawPowerup(ctx, p, sx, pulse)
    }

    for (const a of gs.asteroids) {
      const sx = screenX(a.worldX, camX)
      if (visible(sx, 50)) drawAsteroid(ctx, a, sx)
    }

    for (const e of gs.enemies) {
      const sx = screenX(e.worldX, camX)
      if (visible(sx, e.type === 'carrier' ? 100 : 30)) drawEnemy(ctx, e, sx, shipSx, gs.ship.y)
    }

    ctx.lineCap = 'round'
    for (const proj of gs.projectiles) {
      const sx = screenX(proj.worldX, camX)
      if (!visible(sx, 20)) continue
      const speed = Math.hypot(proj.vx, proj.vy) || 1
      const tail = proj.owner === 'player' ? 14 : 7
      ctx.strokeStyle = proj.owner === 'player' ? '#67e8f9' : '#fca5a5'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(sx - (proj.vx / speed) * tail, proj.y - (proj.vy / speed) * tail)
      ctx.lineTo(sx, proj.y)
      ctx.stroke()
    }
    ctx.lineCap = 'butt'

    for (const ex of gs.explosions) {
      const sx = screenX(ex.worldX, camX)
      if (visible(sx, 60)) drawExplosion(ctx, ex, sx)
    }

    if (gs.ship.health > 0) drawShip(ctx, gs.ship, shipSx, gs.elapsed)

    ctx.textAlign = 'center'
    ctx.font = 'bold 13px sans-serif'
    for (const f of gs.floaters) {
      const sx = screenX(f.worldX, camX)
      if (!visible(sx, 40)) continue
      const p = f.age / FLOATER_DURATION
      ctx.globalAlpha = 1 - p * p
      ctx.fillStyle = f.color
      ctx.fillText(f.text, sx, f.y - p * 34)
    }
    ctx.globalAlpha = 1
    ctx.textAlign = 'left'
    ctx.restore()

    // Red vignette when the hull takes damage.
    if (gs.damageFlashTimer > 0) {
      const a = (gs.damageFlashTimer / DAMAGE_FLASH_DURATION) * 0.55
      const vignette = ctx.createRadialGradient(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_HEIGHT * 0.35, VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH * 0.65)
      vignette.addColorStop(0, 'rgba(239,68,68,0)')
      vignette.addColorStop(1, `rgba(239,68,68,${a})`)
      ctx.fillStyle = vignette
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
    }

    drawHud(ctx, gs)

    if (gs.novaFlashTimer > 0) {
      const alpha = (gs.novaFlashTimer / NOVA_FLASH_DURATION) * 0.5
      ctx.fillStyle = `rgba(224,242,254,${alpha})`
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
    }
  }

  const drawRef = useRef(draw)
  useEffect(() => {
    drawRef.current = draw
  })

  useEffect(() => {
    let last = performance.now()
    function tick(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      if (phaseRef.current === 'playing') update(dt)
      drawRef.current()
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function start() {
    audio.init()
    gsRef.current = newGame(Math.floor(Math.random() * 1_000_000_000))
    keysRef.current = { up: false, down: false, left: false, right: false, thrust: false, fire: false, nova: false }
    novaPrevRef.current = false
    setIsNewBest(false)
    setPhase('playing')
  }

  function toggleMute() {
    audio.init()
    const next = !muted
    audio.setMuted(next)
    setMuted(next)
  }

  // On-screen touch controls (spec.md's keyboard-only v1, extended for
  // mobile): each button just sets the same keysRef flags the keyboard
  // handler does, so update()/stepShip don't need to know controls came
  // from a finger instead of a key. Pointer events (not touch events) so
  // one handler covers touch, pen, and mouse, and multiple fingers on
  // different buttons are tracked independently by the browser.
  function bindTouch(key: keyof typeof keysRef.current) {
    return {
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault()
        keysRef.current[key] = true
      },
      onPointerUp: (e: React.PointerEvent) => {
        e.preventDefault()
        keysRef.current[key] = false
      },
      onPointerLeave: () => {
        keysRef.current[key] = false
      },
      onPointerCancel: () => {
        keysRef.current[key] = false
      },
    }
  }

  return (
    <div className="starwarden fullscreen">
      <div className="sw-game-area">
        <canvas ref={canvasRef} width={VIEW_WIDTH} height={VIEW_HEIGHT} className="sw-canvas" />

        <button type="button" className="sw-mute" onClick={toggleMute} aria-label={muted ? 'Unmute sound' : 'Mute sound'}>
          {muted ? '🔇' : '🔊'}
        </button>

        {phase === 'playing' && (
          <div className="sw-touch-controls" aria-hidden="true">
            <div className="sw-dpad">
              <span className="sw-dpad-slot" />
              <button type="button" className="sw-touch-btn" {...bindTouch('up')}>▲</button>
              <span className="sw-dpad-slot" />
              <button type="button" className="sw-touch-btn" {...bindTouch('left')}>◀</button>
              <span className="sw-dpad-slot" />
              <button type="button" className="sw-touch-btn" {...bindTouch('right')}>▶</button>
              <span className="sw-dpad-slot" />
              <button type="button" className="sw-touch-btn" {...bindTouch('down')}>▼</button>
              <span className="sw-dpad-slot" />
            </div>
            <div className="sw-action-pad">
              <button type="button" className="sw-touch-btn sw-touch-nova" {...bindTouch('nova')}>
                NOVA
              </button>
              <button type="button" className="sw-touch-btn sw-touch-thrust" {...bindTouch('thrust')}>
                THRUST
              </button>
              <button type="button" className="sw-touch-btn sw-touch-fire" {...bindTouch('fire')}>
                FIRE
              </button>
            </div>
          </div>
        )}

        {phase === 'intro' && (
          <div className="sw-overlay">
            <h1>Starwarden</h1>
            <p className="sw-tagline">
              Hold the line in a scrolling alien warzone. Dodge and blast enemies, and survive as
              long as your fuel and power crystals hold out.
            </p>
            <ul className="sw-controls">
              <li><kbd>&uarr;</kbd>/<kbd>&darr;</kbd> move up / down</li>
              <li><kbd>&larr;</kbd>/<kbd>&rarr;</kbd> face left / right</li>
              <li><kbd>Z</kbd> engine thrust (uses fuel)</li>
              <li><kbd>X</kbd> fire laser (uses a power crystal)</li>
              <li><kbd>C</kbd> Nova Bomb — clears the screen (recharges over time)</li>
              <li>Your shield blocks one hit, then recharges · chain kills for a combo multiplier</li>
            </ul>
            {progress.bestScore > 0 && (
              <p className="sw-best">
                Best: {progress.bestScore.toLocaleString()} pts · {formatTime(progress.bestTime)} survived · level {progress.bestLevel}
              </p>
            )}
            <p className="sw-touch-hint">On a touchscreen, on-screen controls appear once you launch.</p>
            <button type="button" className="sw-primary" onClick={start}>
              Launch
            </button>
          </div>
        )}

        {phase === 'gameover' && (
          <div className="sw-overlay">
            <h1>Ship Lost</h1>
            <p className="sw-tagline">
              Final score: <strong>{finalScore.toLocaleString()}</strong>
              {isNewBest && <span className="sw-new-best"> New best!</span>}
            </p>
            <p className="sw-tagline">
              Survived {formatTime(finalTime)} · reached level {finalLevel}
            </p>
            <p className="sw-best">
              Best: {progress.bestScore.toLocaleString()} pts · {formatTime(progress.bestTime)} survived · level {progress.bestLevel}
            </p>
            <button type="button" className="sw-primary" onClick={start}>
              Fly Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Starwarden
