import { useEffect, useRef, useState } from 'react'
import {
  CRYSTAL_MAX,
  FUEL_MAX,
  HEALTH_MAX,
  SHIELD_ACTIVE_DURATION,
  SHIELD_FLASH_DURATION,
  SHIELD_REGEN_TIME,
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
  enemyLevel,
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
import { NOVA_CLEAR_MARGIN, NOVA_FLASH_DURATION, NOVA_MAX_CHARGES, NOVA_RECHARGE_TIME } from './nova'
import { survivalPoints } from './scoring'
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
  enemyLevel: number
  escalationBannerTimer: number
  escalationText: string
  novaCharges: number
  novaTimer: number
  novaFlashTimer: number
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
    enemyLevel: 0,
    escalationBannerTimer: 0,
    escalationText: '',
    novaCharges: 1,
    novaTimer: 0,
    novaFlashTimer: 0,
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
  } else if (ship.shieldState === 'charging') {
    // A thin progress arc that fills in as the clean-streak regen timer
    // builds toward SHIELD_REGEN_TIME, slowly rotating so it visibly reads
    // as "charging" rather than a static gauge.
    const progress = Math.min(1, ship.shieldTimer / SHIELD_REGEN_TIME)
    if (progress > 0) {
      const rotation = ship.shieldTimer * 0.8
      ctx.beginPath()
      ctx.arc(0, 0, SHIP_RADIUS + 8, -Math.PI / 2 + rotation, -Math.PI / 2 + rotation + progress * Math.PI * 2)
      ctx.strokeStyle = 'rgba(103,232,249,0.55)'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }

  // A brief expanding burst when the shield finishes its regen streak.
  if (ship.shieldFlash > 0) {
    const t = 1 - ship.shieldFlash / SHIELD_FLASH_DURATION
    ctx.beginPath()
    ctx.arc(0, 0, SHIP_RADIUS + 6 + t * 26, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(165,243,252,${0.9 * (1 - t)})`
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
    ctx.fillStyle = gs.ship.shieldState === 'active' ? '#67e8f9' : 'rgba(255,255,255,0.45)'
    ctx.font = '11px sans-serif'
    const label =
      gs.ship.shieldState === 'active'
        ? 'Shield up'
        : `Shield in ${Math.max(0, Math.ceil(SHIELD_REGEN_TIME - gs.ship.shieldTimer))}s`
    ctx.fillText(label, VIEW_WIDTH - gaugeW - 16, 92)
  } else if (gs.ship.shieldFlash > 0) {
    ctx.fillStyle = '#a5f3fc'
    ctx.font = 'bold 11px sans-serif'
    ctx.fillText('Shield ready!', VIEW_WIDTH - gaugeW - 16, 92)
  }

  // Nova Bomb readout: charge count plus a thin recharge progress bar
  // whenever a charge is still filling.
  const novaY = 108
  ctx.fillStyle = gs.novaCharges > 0 ? '#fde047' : 'rgba(255,255,255,0.4)'
  ctx.font = 'bold 12px sans-serif'
  ctx.fillText(`NOVA ×${gs.novaCharges} (C)`, VIEW_WIDTH - gaugeW - 16, novaY)
  if (gs.novaCharges < NOVA_MAX_CHARGES) {
    drawGauge(ctx, VIEW_WIDTH - gaugeW - 16, novaY + 16, gaugeW, 6, gs.novaTimer / NOVA_RECHARGE_TIME, '#fde047', '')
  }

  if (gs.escalationBannerTimer > 0) {
    const alpha = Math.min(1, gs.escalationBannerTimer / 0.4)
    ctx.textAlign = 'center'
    ctx.font = 'bold 22px sans-serif'
    ctx.fillStyle = `rgba(248,113,113,${alpha})`
    ctx.fillText(gs.escalationText, VIEW_WIDTH / 2, 60)
    ctx.textAlign = 'left'
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

    // Nova Bomb trigger: edge-detected so holding the key doesn't burn
    // every charge in one press. Clears everything currently on screen
    // (enemies, asteroids, enemy projectiles) -- off-screen threats
    // elsewhere on the wraparound loop are untouched, so it's a panic
    // button for the immediate danger, not a whole-run reset.
    const novaPressed = keysRef.current.nova && !novaPrevRef.current
    novaPrevRef.current = keysRef.current.nova
    if (novaPressed && gs.novaCharges > 0) {
      gs.novaCharges -= 1
      gs.novaFlashTimer = NOVA_FLASH_DURATION
      audio.playNova()
      const onScreen = (worldX: number) => {
        const sx = screenX(worldX, gs.ship.worldX)
        return sx > -NOVA_CLEAR_MARGIN && sx < VIEW_WIDTH + NOVA_CLEAR_MARGIN
      }
      const clearedEnemies = gs.enemies.filter((e) => onScreen(e.worldX))
      const clearedAsteroids = gs.asteroids.filter((a) => onScreen(a.worldX))
      for (const e of clearedEnemies) {
        gs.score += ENEMY_POINTS[e.type]
        gs.explosions.push(spawnExplosion(gs.rng, e.worldX, e.y, gs.idCounter++, 'small'))
      }
      for (const a of clearedAsteroids) {
        gs.score += ASTEROID_POINTS
        gs.explosions.push(spawnExplosion(gs.rng, a.worldX, a.y, gs.idCounter++, 'small'))
      }
      gs.enemies = gs.enemies.filter((e) => !onScreen(e.worldX))
      gs.asteroids = gs.asteroids.filter((a) => !onScreen(a.worldX))
      gs.projectiles = gs.projectiles.filter((p) => p.owner !== 'enemy' || !onScreen(p.worldX))
    }

    const level = enemyLevel(gs.elapsed)
    if (level > gs.enemyLevel) {
      // A new escalation level: announce it, and throw in an immediate
      // burst of enemies at the new level's mix rather than waiting for
      // the regular spawn timer to slowly catch up.
      gs.enemyLevel = level
      gs.escalationBannerTimer = ESCALATION_BANNER_DURATION
      gs.escalationText = `⚠ ENEMIES ESCALATING — LEVEL ${level + 1}`
      audio.playEscalation()
      for (let i = 0; i < ESCALATION_BURST_COUNT; i++) {
        gs.enemies.push(spawnEnemy(gs.rng, level, WORLD_WIDTH, gs.idCounter++))
      }
    }
    gs.escalationBannerTimer = Math.max(0, gs.escalationBannerTimer - dt)

    gs.spawnTimer -= dt
    if (gs.spawnTimer <= 0) {
      gs.enemies.push(spawnEnemy(gs.rng, gs.enemyLevel, WORLD_WIDTH, gs.idCounter++))
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
    // (if any) and start the regen streak from zero; otherwise start the
    // streak once the active window simply expires unused. While charging,
    // a clean streak with no damage taken counts up toward
    // SHIELD_REGEN_TIME; any hit taken during that streak resets it to
    // zero instead of just slowing it down -- the shield comes back only
    // after a genuinely clean stretch.
    let shieldFlash = Math.max(0, gs.ship.shieldFlash - dt)
    if (shieldState === 'active') {
      if (hits > 0) {
        hits -= 1
        shieldState = 'charging'
        shieldTimer = 0
      } else {
        shieldTimer -= dt
        if (shieldTimer <= 0) {
          shieldState = 'charging'
          shieldTimer = 0
        }
      }
    } else if (shieldState === 'charging') {
      if (hits > 0) {
        shieldTimer = 0
      } else {
        shieldTimer += dt
        if (shieldTimer >= SHIELD_REGEN_TIME) {
          shieldState = 'ready'
          shieldTimer = 0
          shieldFlash = SHIELD_FLASH_DURATION
          audio.playShieldRegen()
        }
      }
    }

    gs.ship = { ...gs.ship, shieldState, shieldTimer, shieldFlash }
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

    // Star warp effect: stars stretch into streaks trailing behind the
    // ship's motion as speed builds under thrust, and shrink back to dots
    // as the ship coasts down -- length tracks |vx| directly so it scales
    // smoothly with the same momentum the long-coast physics already model.
    const speed = Math.abs(gs.ship.vx)
    const streakLen = Math.min(70, speed * 0.28)
    const dir = gs.ship.vx >= 0 ? 1 : -1
    for (const s of starsRef.current) {
      const sx = screenX(s.worldX, gs.ship.worldX)
      if (sx < -80 || sx > VIEW_WIDTH + 80) continue
      if (streakLen > 3) {
        ctx.strokeStyle = `rgba(255,255,255,${gs.ship.thrusting ? 0.75 : 0.5})`
        ctx.lineWidth = s.r
        ctx.beginPath()
        ctx.moveTo(sx, s.y)
        ctx.lineTo(sx + dir * streakLen, s.y)
        ctx.stroke()
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        ctx.fillRect(sx, s.y, s.r, s.r)
      }
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
            </ul>
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
