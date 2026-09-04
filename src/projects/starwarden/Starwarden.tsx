import { useEffect, useRef, useState } from 'react'
import {
  CRYSTAL_MAX,
  FUEL_MAX,
  HEALTH_MAX,
  SHIELD_ACTIVE_DURATION,
  SHIELD_COOLDOWN_UNUSED,
  SHIELD_COOLDOWN_USED,
  SHIELD_TRIGGER_RANGE,
  SHIP_RADIUS,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  WORLD_WIDTH,
  initialShip,
  stepShip,
  wrapDelta,
  type ShipInput,
  type ShipState,
} from './physics'
import {
  ENEMY_POINTS,
  spawnEnemy,
  spawnInterval,
  stepEnemies,
  stepProjectiles,
  type Enemy,
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
} from './powerups'
import { survivalPoints } from './scoring'
import { makeRng, type Rng } from './rng'
import * as audio from './audio'
import './Starwarden.css'

type Phase = 'intro' | 'playing' | 'gameover'

const LASER_SPEED = 520
const LASER_COOLDOWN = 0.22
const RAM_DAMAGE_RADIUS_PAD = 4
const ASTEROID_INTERVAL = 8

interface GameState {
  ship: ShipState
  enemies: Enemy[]
  asteroids: Asteroid[]
  projectiles: Projectile[]
  powerups: Powerup[]
  explosions: Explosion[]
  score: number
  elapsed: number
  spawnTimer: number
  asteroidTimer: number
  powerupTimer: number
  fireCooldown: number
  idCounter: number
  rng: Rng
}

function newGame(seed: number): GameState {
  return {
    ship: initialShip(),
    enemies: [],
    asteroids: [],
    projectiles: [],
    powerups: [],
    explosions: [],
    score: 0,
    elapsed: 0,
    spawnTimer: 1,
    asteroidTimer: ASTEROID_INTERVAL * 0.5,
    powerupTimer: STANDALONE_INTERVAL,
    fireCooldown: 0,
    idCounter: 1,
    rng: makeRng(seed),
  }
}

// A fixed starfield generated once per canvas size, purely for background
// flavor -- positions are in world space so stars scroll past like every
// other entity, and the field tiles seamlessly across the wraparound world.
function makeStars(rng: Rng, count: number): { worldX: number; y: number; r: number }[] {
  const stars = []
  for (let i = 0; i < count; i++) {
    stars.push({ worldX: rng.range(0, WORLD_WIDTH), y: rng.range(0, VIEW_HEIGHT), r: rng.next() < 0.8 ? 1 : 1.8 })
  }
  return stars
}

function screenX(worldX: number, shipWorldX: number): number {
  return VIEW_WIDTH / 2 + wrapDelta(worldX, shipWorldX, WORLD_WIDTH)
}

function drawShip(ctx: CanvasRenderingContext2D, ship: ShipState) {
  const x = VIEW_WIDTH / 2
  const y = ship.y
  ctx.save()
  ctx.translate(x, y)

  // Shield ring, drawn under the hull so the hull reads on top of the glow.
  if (ship.shieldState === 'active') {
    const t = 1 - ship.shieldTimer / SHIELD_ACTIVE_DURATION
    const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 6)
    ctx.beginPath()
    ctx.arc(0, 0, SHIP_RADIUS + 9, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(103,232,249,${0.4 + 0.4 * pulse})`
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 0, SHIP_RADIUS + 9, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(103,232,249,${0.08 + 0.08 * pulse})`
    ctx.fill()
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

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, sx: number, shipScreenY: number) {
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
    const grad = ctx.createLinearGradient(-e.radius, -e.radius, e.radius, e.radius)
    grad.addColorStop(0, '#7f1d1d')
    grad.addColorStop(0.5, '#f87171')
    grad.addColorStop(1, '#fecaca')
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
    ctx.strokeStyle = '#fecaca'
    ctx.lineWidth = 1.5
    ctx.stroke()

    const barrelAngle = Math.atan2(shipScreenY - e.y, VIEW_WIDTH / 2 - sx)
    ctx.rotate(barrelAngle)
    ctx.fillStyle = '#450a0a'
    ctx.fillRect(0, -2, e.radius * 1.4, 4)
    ctx.beginPath()
    ctx.arc(0, 0, e.radius * 0.35, 0, Math.PI * 2)
    ctx.fillStyle = '#fde68a'
    ctx.fill()
  } else {
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
  }
  ctx.restore()
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

function drawGauge(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, color: string, label: string) {
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = color
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h)
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, w, h)
  ctx.fillStyle = '#e5e7eb'
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(label, x, y - 4)
}

function drawHud(ctx: CanvasRenderingContext2D, gs: GameState) {
  ctx.fillStyle = '#e5e7eb'
  ctx.font = 'bold 18px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(`Score: ${Math.floor(gs.score)}`, 16, 26)

  const gaugeW = 140
  drawGauge(ctx, VIEW_WIDTH - gaugeW - 16, 20, gaugeW, 10, gs.ship.fuel / FUEL_MAX, '#fbbf24', 'Fuel')
  drawGauge(ctx, VIEW_WIDTH - gaugeW - 16, 46, gaugeW, 10, gs.ship.crystals / CRYSTAL_MAX, '#22d3ee', 'Crystals')

  for (let i = 0; i < HEALTH_MAX; i++) {
    ctx.beginPath()
    ctx.arc(VIEW_WIDTH - gaugeW - 16 + i * 18, 70, 6, 0, Math.PI * 2)
    ctx.fillStyle = i < gs.ship.health ? '#4ade80' : 'rgba(255,255,255,0.15)'
    ctx.fill()
  }

  if (gs.ship.shieldState !== 'ready') {
    ctx.fillStyle = gs.ship.shieldState === 'active' ? '#67e8f9' : 'rgba(255,255,255,0.4)'
    ctx.font = '11px sans-serif'
    ctx.fillText(gs.ship.shieldState === 'active' ? 'Shield up' : 'Shield charging', VIEW_WIDTH - gaugeW - 16, 92)
  }

  // Radar: the whole wraparound world compressed into one strip, spec.md
  // section 9 -- markers for the player, enemies, and powerups so threats
  // approaching from off-screen are still visible.
  const radarY = VIEW_HEIGHT - 22
  const radarW = VIEW_WIDTH - 32
  const radarX = 16
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.strokeRect(radarX, radarY, radarW, 10)
  const toRadarX = (worldX: number) => radarX + (worldX / WORLD_WIDTH) * radarW

  for (const e of gs.enemies) {
    ctx.fillStyle = e.type === 'drifter' ? '#94a3b8' : e.type === 'gunner' ? '#f87171' : '#fb923c'
    ctx.fillRect(toRadarX(e.worldX) - 1, radarY + 1, 2, 8)
  }
  for (const a of gs.asteroids) {
    ctx.fillStyle = '#78716c'
    ctx.fillRect(toRadarX(a.worldX) - 1, radarY + 1, 2, 8)
  }
  for (const p of gs.powerups) {
    ctx.fillStyle = p.type === 'fuel' ? '#fbbf24' : '#22d3ee'
    ctx.fillRect(toRadarX(p.worldX) - 1, radarY + 1, 2, 8)
  }
  ctx.fillStyle = '#a3e635'
  ctx.fillRect(toRadarX(gs.ship.worldX) - 1.5, radarY - 2, 3, 14)
}

function Starwarden() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [bestScore, setBestScore] = useState<number | null>(null)
  const [finalScore, setFinalScore] = useState(0)
  const [muted, setMuted] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const phaseRef = useRef<Phase>('intro')
  const gsRef = useRef<GameState>(newGame(1))
  const starsRef = useRef(makeStars(makeRng(7), 140))
  const keysRef = useRef({ up: false, down: false, left: false, right: false, thrust: false, fire: false })

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
      else if (key === ' ') k.thrust = true
      else if (key === 'x') k.fire = true
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
      else if (key === ' ') k.thrust = false
      else if (key === 'x') k.fire = false
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

  function update(dt: number) {
    const gs = gsRef.current
    gs.elapsed += dt

    const input: ShipInput = { ...keysRef.current }
    const wasThrusting = gs.ship.thrusting
    gs.ship = stepShip(gs.ship, input, dt)
    if (gs.ship.thrusting !== wasThrusting) audio.setThrusterOn(gs.ship.thrusting)

    gs.fireCooldown = Math.max(0, gs.fireCooldown - dt)
    if (keysRef.current.fire && gs.fireCooldown <= 0 && gs.ship.crystals > 0) {
      gs.ship = { ...gs.ship, crystals: gs.ship.crystals - 1 }
      gs.projectiles.push({
        id: gs.idCounter++,
        worldX: gs.ship.worldX,
        y: gs.ship.y,
        vx: gs.ship.facing * LASER_SPEED,
        vy: 0,
        owner: 'player',
        life: 1.4,
      })
      gs.fireCooldown = LASER_COOLDOWN
      audio.playLaser()
    }

    gs.spawnTimer -= dt
    if (gs.spawnTimer <= 0) {
      gs.enemies.push(spawnEnemy(gs.rng, gs.elapsed, WORLD_WIDTH, gs.idCounter++))
      gs.spawnTimer = spawnInterval(gs.elapsed) * gs.rng.range(0.7, 1.3)
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

    const stepResult = stepEnemies(gs.enemies, gs.ship, WORLD_WIDTH, dt, () => gs.idCounter++)
    gs.enemies = stepResult.enemies
    gs.projectiles.push(...stepResult.newProjectiles)
    gs.projectiles = stepProjectiles(gs.projectiles, WORLD_WIDTH, dt)
    gs.asteroids = stepAsteroids(gs.asteroids, WORLD_WIDTH, dt)
    gs.explosions = stepExplosions(gs.explosions, dt)

    // Player lasers vs enemies and asteroids.
    const deadEnemyIds = new Set<number>()
    const deadAsteroidIds = new Set<number>()
    const consumedProjectileIds = new Set<number>()
    for (const proj of gs.projectiles) {
      if (proj.owner !== 'player' || consumedProjectileIds.has(proj.id)) continue
      for (const e of gs.enemies) {
        if (deadEnemyIds.has(e.id)) continue
        const dist = Math.hypot(wrapDelta(proj.worldX, e.worldX, WORLD_WIDTH), proj.y - e.y)
        if (dist < e.radius + 3) {
          consumedProjectileIds.add(proj.id)
          e.health -= 1
          if (e.health <= 0) {
            deadEnemyIds.add(e.id)
            gs.score += ENEMY_POINTS[e.type]
            gs.explosions.push(spawnExplosion(gs.rng, e.worldX, e.y, gs.idCounter++, 'small'))
            audio.playExplosion('small')
            if (gs.rng.next() < ENEMY_DROP_CHANCE) {
              const drop = spawnPowerup(gs.rng, WORLD_WIDTH, gs.idCounter++)
              gs.powerups.push({ ...drop, worldX: e.worldX, y: e.y })
            }
          }
          break
        }
      }
    }
    for (const proj of gs.projectiles) {
      if (proj.owner !== 'player' || consumedProjectileIds.has(proj.id)) continue
      for (const a of gs.asteroids) {
        if (deadAsteroidIds.has(a.id)) continue
        const dist = Math.hypot(wrapDelta(proj.worldX, a.worldX, WORLD_WIDTH), proj.y - a.y)
        if (dist < a.radius + 3) {
          consumedProjectileIds.add(proj.id)
          a.health -= 1
          if (a.health <= 0) {
            deadAsteroidIds.add(a.id)
            gs.score += ASTEROID_POINTS
            gs.explosions.push(spawnExplosion(gs.rng, a.worldX, a.y, gs.idCounter++, 'small'))
            audio.playExplosion('small')
          }
          break
        }
      }
    }

    // Shield arming check runs before this frame's hit detection, so a
    // shield that arms and a hazard that connects can happen the same
    // frame -- otherwise a fast diver could land its hit one frame before
    // the shield had a chance to come up.
    let shieldState = gs.ship.shieldState
    let shieldTimer = gs.ship.shieldTimer
    if (shieldState === 'ready') {
      let hazardNear = false
      for (const e of gs.enemies) {
        if (Math.hypot(wrapDelta(e.worldX, gs.ship.worldX, WORLD_WIDTH), e.y - gs.ship.y) < SHIELD_TRIGGER_RANGE) {
          hazardNear = true
          break
        }
      }
      if (!hazardNear) {
        for (const a of gs.asteroids) {
          if (Math.hypot(wrapDelta(a.worldX, gs.ship.worldX, WORLD_WIDTH), a.y - gs.ship.y) < SHIELD_TRIGGER_RANGE) {
            hazardNear = true
            break
          }
        }
      }
      if (!hazardNear) {
        for (const p of gs.projectiles) {
          if (p.owner !== 'enemy') continue
          if (Math.hypot(wrapDelta(p.worldX, gs.ship.worldX, WORLD_WIDTH), p.y - gs.ship.y) < SHIELD_TRIGGER_RANGE) {
            hazardNear = true
            break
          }
        }
      }
      if (hazardNear) {
        shieldState = 'active'
        shieldTimer = SHIELD_ACTIVE_DURATION
        audio.playShieldUp()
      }
    }

    // Gather this frame's would-be damage sources against the ship (enemy
    // lasers, ramming enemies, ramming asteroids) before applying anything,
    // so the shield can absorb the first one if it's active.
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
      if (dist < SHIP_RADIUS + e.radius) {
        deadEnemyIds.add(e.id)
        gs.explosions.push(spawnExplosion(gs.rng, e.worldX, e.y, gs.idCounter++, 'small'))
        audio.playExplosion('small')
        hits += 1
      }
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

    // Resolve the shield: while active, absorb the first hit of the frame
    // (if any) and go on the longer "used" cooldown; otherwise tick down
    // toward ready, using the shorter "unused" cooldown if the window
    // simply expired with nothing to block.
    if (shieldState === 'active') {
      if (hits > 0) {
        hits -= 1
        shieldState = 'cooldown'
        shieldTimer = SHIELD_COOLDOWN_USED
      } else {
        shieldTimer -= dt
        if (shieldTimer <= 0) {
          shieldState = 'cooldown'
          shieldTimer = SHIELD_COOLDOWN_UNUSED
        }
      }
    } else if (shieldState === 'cooldown') {
      shieldTimer -= dt
      if (shieldTimer <= 0) {
        shieldState = 'ready'
        shieldTimer = 0
      }
    }

    gs.ship = { ...gs.ship, shieldState, shieldTimer }
    if (hits > 0) {
      gs.ship = { ...gs.ship, health: gs.ship.health - hits }
      audio.playHit()
    }

    gs.score += survivalPoints(dt)

    if (gs.ship.health <= 0) {
      gs.explosions.push(spawnExplosion(gs.rng, gs.ship.worldX, gs.ship.y, gs.idCounter++, 'large'))
      audio.playExplosion('large')
      audio.playGameOver()
      audio.setThrusterOn(false)
      const finalized = Math.floor(gs.score)
      setFinalScore(finalized)
      setBestScore((prev) => (prev === null || finalized > prev ? finalized : prev))
      setPhase('gameover')
    }
  }

  function draw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const gs = gsRef.current

    ctx.fillStyle = '#03040a'
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)

    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    for (const s of starsRef.current) {
      const sx = screenX(s.worldX, gs.ship.worldX)
      if (sx < -10 || sx > VIEW_WIDTH + 10) continue
      ctx.fillRect(sx, s.y, s.r, s.r)
    }

    const pulse = 0.5 + 0.5 * Math.sin(gs.elapsed * 3)
    for (const p of gs.powerups) {
      const sx = screenX(p.worldX, gs.ship.worldX)
      if (sx < -30 || sx > VIEW_WIDTH + 30) continue
      drawPowerup(ctx, p, sx, pulse)
    }

    for (const a of gs.asteroids) {
      const sx = screenX(a.worldX, gs.ship.worldX)
      if (sx < -50 || sx > VIEW_WIDTH + 50) continue
      drawAsteroid(ctx, a, sx)
    }

    for (const e of gs.enemies) {
      const sx = screenX(e.worldX, gs.ship.worldX)
      if (sx < -30 || sx > VIEW_WIDTH + 30) continue
      drawEnemy(ctx, e, sx, gs.ship.y)
    }

    for (const proj of gs.projectiles) {
      const sx = screenX(proj.worldX, gs.ship.worldX)
      if (sx < -20 || sx > VIEW_WIDTH + 20) continue
      ctx.strokeStyle = proj.owner === 'player' ? '#67e8f9' : '#fca5a5'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(sx - proj.vx * 0.02, proj.y - proj.vy * 0.02)
      ctx.lineTo(sx, proj.y)
      ctx.stroke()
    }

    for (const ex of gs.explosions) {
      const sx = screenX(ex.worldX, gs.ship.worldX)
      if (sx < -60 || sx > VIEW_WIDTH + 60) continue
      drawExplosion(ctx, ex, sx)
    }

    if (gs.ship.health > 0) drawShip(ctx, gs.ship)
    drawHud(ctx, gs)
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
    keysRef.current = { up: false, down: false, left: false, right: false, thrust: false, fire: false }
    setPhase('playing')
  }

  function toggleMute() {
    audio.init()
    const next = !muted
    audio.setMuted(next)
    setMuted(next)
  }

  return (
    <div className="starwarden fullscreen">
      <div className="sw-game-area">
        <canvas ref={canvasRef} width={VIEW_WIDTH} height={VIEW_HEIGHT} className="sw-canvas" />

        <button type="button" className="sw-mute" onClick={toggleMute} aria-label={muted ? 'Unmute sound' : 'Mute sound'}>
          {muted ? '🔇' : '🔊'}
        </button>

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
              <li><kbd>Space</kbd> engine thrust (uses fuel)</li>
              <li><kbd>X</kbd> fire laser (uses a power crystal)</li>
            </ul>
            <button type="button" className="sw-primary" onClick={start}>
              Launch
            </button>
          </div>
        )}

        {phase === 'gameover' && (
          <div className="sw-overlay">
            <h1>Ship Lost</h1>
            <p className="sw-tagline">
              Final score: <strong>{finalScore}</strong>
              {bestScore !== null && bestScore === finalScore && <span className="sw-new-best"> New best!</span>}
            </p>
            {bestScore !== null && bestScore !== finalScore && (
              <p className="sw-tagline">Best this session: {bestScore}</p>
            )}
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
