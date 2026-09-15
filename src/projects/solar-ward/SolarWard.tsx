import { useEffect, useRef, useState } from 'react'
import {
  CENTER,
  ORBIT_RADIUS,
  RIM_RADIUS,
  STAR_RADIUS,
  TURRET_SIZE,
  VIEW_SIZE,
  initialTurret,
  pointOnCircle,
  stepTurret,
  type TurretInput,
  type TurretState,
} from './physics'
import { type Dreadnought, stepDreadnoughts } from './dreadnoughts'
import { spawnBeam, stepBeams, type Beam } from './beams'
import { spawnFighter, stepFighters, type Fighter } from './fighters'
import { spawnShot, stepShots, type Shot } from './shots'
import { generateWaveDreadnoughts, waveConfig } from './waves'
import {
  SEGMENT_ARC,
  allSegmentsDestroyed,
  initialSegments,
  segmentArcBounds,
  segmentIndexForAngle,
  totalRemainingHealth,
  type Segment,
} from './segments'
import { spawnExplosion, stepExplosions, type Explosion } from './explosions'
import {
  BEAM_POINTS,
  COMBO_START,
  FIGHTER_POINTS,
  OVERCHARGE_BONUS_MULT,
  endOfWaveBonus,
  maxPossibleWaveBonus,
  nextCombo,
} from './scoring'
import { OVERCHARGE_FLASH_DURATION, OVERCHARGE_MAX_CHARGES, OVERCHARGE_RADIUS, OVERCHARGE_RECHARGE_TIME } from './overcharge'
import { makeRng, type Rng } from './rng'
import * as audio from './audio'
import './SolarWard.css'

type Phase = 'intro' | 'playing' | 'wave-cleared' | 'gameover'

const FIRE_COOLDOWN = 0.16
const SHOT_SPEED = 480
const HIT_DISTANCE = 16
const SEGMENT_COLORS = ['#4ade80', '#facc15', '#fb923c', '#f87171']

interface GameState {
  turret: TurretState
  dreadnoughts: Dreadnought[]
  beams: Beam[]
  fighters: Fighter[]
  shots: Shot[]
  explosions: Explosion[]
  segments: Segment[]
  score: number
  combo: number
  waveIndex: number
  waveEventsSpawned: number
  waveQuota: number
  overchargeCharges: number
  overchargeTimer: number
  overchargeFlashTimer: number
  fireCooldown: number
  idCounter: number
  rng: Rng
  cosmeticClock: number
  lastWaveBonus: number
}

function startWaveState(gs: GameState, waveIndex: number) {
  gs.waveIndex = waveIndex
  gs.dreadnoughts = generateWaveDreadnoughts(gs.rng, waveIndex, () => gs.idCounter++)
  gs.waveEventsSpawned = 0
  gs.waveQuota = waveConfig(waveIndex).quota
  gs.beams = []
  gs.fighters = []
}

function newGame(seed: number): GameState {
  const rng = makeRng(seed)
  const gs: GameState = {
    turret: initialTurret(),
    dreadnoughts: [],
    beams: [],
    fighters: [],
    shots: [],
    explosions: [],
    segments: initialSegments(),
    score: 0,
    combo: COMBO_START,
    waveIndex: 0,
    waveEventsSpawned: 0,
    waveQuota: 0,
    overchargeCharges: 1,
    overchargeTimer: 0,
    overchargeFlashTimer: 0,
    fireCooldown: 0,
    idCounter: 1,
    rng,
    cosmeticClock: 0,
    lastWaveBonus: 0,
  }
  startWaveState(gs, 0)
  return gs
}

function makeStars(rng: Rng, count: number): { x: number; y: number; r: number; phase: number }[] {
  const stars = []
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rng.range(0, VIEW_SIZE),
      y: rng.range(0, VIEW_SIZE),
      r: rng.next() < 0.8 ? 1 : 1.8,
      phase: rng.range(0, Math.PI * 2),
    })
  }
  return stars
}

function drawStar(ctx: CanvasRenderingContext2D, clock: number) {
  const pulse = 0.5 + 0.5 * Math.sin(clock * 0.8)
  const grad = ctx.createRadialGradient(CENTER.x, CENTER.y, 0, CENTER.x, CENTER.y, STAR_RADIUS * 1.6)
  grad.addColorStop(0, `rgba(255,247,230,${0.95})`)
  grad.addColorStop(0.4, `rgba(253,186,${Math.round(60 + pulse * 40)},0.9)`)
  grad.addColorStop(1, 'rgba(220,38,38,0)')
  ctx.beginPath()
  ctx.arc(CENTER.x, CENTER.y, STAR_RADIUS * 1.6, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()

  ctx.beginPath()
  ctx.arc(CENTER.x, CENTER.y, STAR_RADIUS, 0, Math.PI * 2)
  ctx.fillStyle = '#fff7e6'
  ctx.fill()

  // Drifting corona particles -- purely cosmetic, computed procedurally
  // from the cosmetic clock so no extra state is needed.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + clock * 0.15
    const dist = STAR_RADIUS * (1.3 + 0.5 * ((Math.sin(clock * 1.3 + i) + 1) / 2))
    const x = CENTER.x + Math.cos(a) * dist
    const y = CENTER.y + Math.sin(a) * dist
    ctx.beginPath()
    ctx.arc(x, y, 1.6, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(253,224,71,0.5)'
    ctx.fill()
  }
}

function drawSegments(ctx: CanvasRenderingContext2D, segments: Segment[]) {
  const inner = STAR_RADIUS + 12
  const outer = STAR_RADIUS + 22
  segments.forEach((seg, i) => {
    const { start, end } = segmentArcBounds(i)
    const pad = SEGMENT_ARC * 0.06
    const healthFrac = seg.health / 3
    const color = seg.health <= 0 ? 'rgba(120,113,108,0.35)' : SEGMENT_COLORS[3 - seg.health] ?? SEGMENT_COLORS[0]
    ctx.beginPath()
    ctx.arc(CENTER.x, CENTER.y, outer, start + pad, end - pad)
    ctx.arc(CENTER.x, CENTER.y, inner, end - pad, start + pad, true)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.globalAlpha = seg.health <= 0 ? 1 : 0.5 + 0.5 * healthFrac
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 1
    ctx.stroke()
  })
}

function drawDreadnought(ctx: CanvasRenderingContext2D, d: Dreadnought) {
  const p = pointOnCircle(d.angle, RIM_RADIUS)
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(d.angle + Math.PI) // face inward, toward the star
  const telegraphing = d.state === 'telegraph'
  const base = d.type === 'siege' ? '#c084fc' : '#f87171'
  const glow = telegraphing ? 0.6 + 0.4 * Math.sin(d.timer * 40) : 0
  if (glow > 0) {
    ctx.beginPath()
    ctx.arc(0, 0, 16 + glow * 8, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,241,150,${0.25 + glow * 0.35})`
    ctx.fill()
  }
  ctx.beginPath()
  ctx.moveTo(12, 0)
  ctx.lineTo(-8, -9)
  ctx.lineTo(-3, 0)
  ctx.lineTo(-8, 9)
  ctx.closePath()
  ctx.fillStyle = base
  ctx.fill()
  ctx.strokeStyle = '#fee2e2'
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.restore()
}

function drawBeam(ctx: CanvasRenderingContext2D, b: Beam) {
  const tip = pointOnCircle(b.angle, b.radius)
  const tail = pointOnCircle(b.angle, Math.min(RIM_RADIUS, b.radius + 22))
  const grad = ctx.createLinearGradient(tail.x, tail.y, tip.x, tip.y)
  grad.addColorStop(0, 'rgba(248,113,113,0)')
  grad.addColorStop(1, 'rgba(254,202,202,0.95)')
  ctx.strokeStyle = grad
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(tail.x, tail.y)
  ctx.lineTo(tip.x, tip.y)
  ctx.stroke()
}

function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter) {
  const p = pointOnCircle(f.angle, f.radius)
  const trailPos = pointOnCircle(f.angle, f.radius + 16)
  ctx.strokeStyle = 'rgba(251,146,60,0.6)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(trailPos.x, trailPos.y)
  ctx.lineTo(p.x, p.y)
  ctx.stroke()

  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(f.angle + Math.PI)
  ctx.beginPath()
  ctx.moveTo(9, 0)
  ctx.lineTo(-6, -7)
  ctx.lineTo(-6, 7)
  ctx.closePath()
  ctx.fillStyle = '#fb923c'
  ctx.fill()
  ctx.strokeStyle = '#fed7aa'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

function drawShot(ctx: CanvasRenderingContext2D, s: Shot) {
  const p = pointOnCircle(s.angle, s.radius)
  const tail = pointOnCircle(s.angle, s.radius - 10)
  ctx.strokeStyle = '#67e8f9'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(tail.x, tail.y)
  ctx.lineTo(p.x, p.y)
  ctx.stroke()
}

function drawTurret(ctx: CanvasRenderingContext2D, turret: TurretState) {
  const p = pointOnCircle(turret.angle, ORBIT_RADIUS)
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(turret.angle)

  if (turret.thrustDir !== 0) {
    // Flame on the tangential side opposite the thrust direction.
    const side = turret.thrustDir === 1 ? 1 : -1
    ctx.beginPath()
    ctx.moveTo(-4, side * 7)
    ctx.lineTo(-14 - Math.random() * 5, side * 12)
    ctx.lineTo(2, side * 7)
    ctx.closePath()
    ctx.fillStyle = 'rgba(251,191,36,0.9)'
    ctx.fill()
  }

  ctx.beginPath()
  ctx.moveTo(TURRET_SIZE, 0)
  ctx.lineTo(-TURRET_SIZE * 0.6, -TURRET_SIZE * 0.8)
  ctx.lineTo(-TURRET_SIZE * 0.2, 0)
  ctx.lineTo(-TURRET_SIZE * 0.6, TURRET_SIZE * 0.8)
  ctx.closePath()
  const hull = ctx.createLinearGradient(-TURRET_SIZE, 0, TURRET_SIZE, 0)
  hull.addColorStop(0, '#0e7490')
  hull.addColorStop(1, '#67e8f9')
  ctx.fillStyle = hull
  ctx.fill()
  ctx.strokeStyle = '#cffafe'
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(TURRET_SIZE * 0.15, 0, 3, 0, Math.PI * 2)
  ctx.fillStyle = '#fde047'
  ctx.fill()
  ctx.restore()
}

function drawExplosion(ctx: CanvasRenderingContext2D, ex: Explosion) {
  const t = ex.age / ex.duration
  for (const p of ex.particles) {
    const dist = p.speed * ex.age
    const px = ex.x + Math.cos(p.angle) * dist
    const py = ex.y + Math.sin(p.angle) * dist
    ctx.beginPath()
    ctx.arc(px, py, Math.max(0.4, p.size * (1 - t)), 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.globalAlpha = Math.max(0, 1 - t)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function drawHud(ctx: CanvasRenderingContext2D, gs: GameState) {
  ctx.fillStyle = '#e5e7eb'
  ctx.font = 'bold 18px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(`Score: ${Math.floor(gs.score)}`, 16, 26)
  ctx.font = '13px sans-serif'
  ctx.fillStyle = '#a5f3fc'
  ctx.fillText(`Combo x${gs.combo.toFixed(1)}`, 16, 46)

  ctx.textAlign = 'right'
  ctx.fillStyle = '#e5e7eb'
  ctx.font = 'bold 16px sans-serif'
  ctx.fillText(`Wave ${gs.waveIndex + 1}`, VIEW_SIZE - 16, 26)

  ctx.font = '12px sans-serif'
  ctx.fillStyle = gs.overchargeCharges > 0 ? '#fde047' : 'rgba(255,255,255,0.4)'
  ctx.fillText(`Overcharge ×${gs.overchargeCharges} (X)`, VIEW_SIZE - 16, 46)
  if (gs.overchargeCharges < OVERCHARGE_MAX_CHARGES) {
    const w = 120
    const x = VIEW_SIZE - 16 - w
    const y = 54
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.fillRect(x, y, w, 5)
    ctx.fillStyle = '#fde047'
    ctx.fillRect(x, y, w * Math.min(1, gs.overchargeTimer / OVERCHARGE_RECHARGE_TIME), 5)
  }
  ctx.textAlign = 'left'
}

function SolarWard() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [bestScore, setBestScore] = useState<number | null>(null)
  const [finalScore, setFinalScore] = useState(0)
  const [waveBonus, setWaveBonus] = useState(0)
  const [clearedWaveNumber, setClearedWaveNumber] = useState(1)
  const [muted, setMuted] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const phaseRef = useRef<Phase>('intro')
  const gsRef = useRef<GameState>(newGame(1))
  const starsRef = useRef(makeStars(makeRng(11), 90))
  const keysRef = useRef({ left: false, right: false, fire: false, overcharge: false })
  const overchargePrevRef = useRef(false)

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    function onDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase()
      const k = keysRef.current
      if (key === 'arrowleft' || key === 'a') k.left = true
      else if (key === 'arrowright' || key === 'd') k.right = true
      else if (key === 'z') k.fire = true
      else if (key === 'x') k.overcharge = true
      else return
      e.preventDefault()
    }
    function onUp(e: KeyboardEvent) {
      const key = e.key.toLowerCase()
      const k = keysRef.current
      if (key === 'arrowleft' || key === 'a') k.left = false
      else if (key === 'arrowright' || key === 'd') k.right = false
      else if (key === 'z') k.fire = false
      else if (key === 'x') k.overcharge = false
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

  function endRun(gs: GameState) {
    audio.playGameOver()
    audio.setThrusterOn(false)
    const finalized = Math.floor(gs.score)
    setFinalScore(finalized)
    setBestScore((prev) => (prev === null || finalized > prev ? finalized : prev))
    setPhase('gameover')
  }

  function update(dt: number) {
    const gs = gsRef.current
    gs.cosmeticClock += dt

    const input: TurretInput = { left: keysRef.current.left, right: keysRef.current.right }
    const wasThrusting = gs.turret.thrustDir !== 0
    gs.turret = stepTurret(gs.turret, input, dt)
    if ((gs.turret.thrustDir !== 0) !== wasThrusting) audio.setThrusterOn(gs.turret.thrustDir !== 0)

    gs.fireCooldown = Math.max(0, gs.fireCooldown - dt)
    if (keysRef.current.fire && gs.fireCooldown <= 0) {
      gs.shots.push(spawnShot(gs.idCounter++, gs.turret.angle, SHOT_SPEED))
      gs.fireCooldown = FIRE_COOLDOWN
      audio.playFire()
    }

    if (gs.overchargeCharges < OVERCHARGE_MAX_CHARGES) {
      gs.overchargeTimer += dt
      if (gs.overchargeTimer >= OVERCHARGE_RECHARGE_TIME) {
        gs.overchargeCharges += 1
        gs.overchargeTimer = 0
      }
    }
    gs.overchargeFlashTimer = Math.max(0, gs.overchargeFlashTimer - dt)

    const overchargePressed = keysRef.current.overcharge && !overchargePrevRef.current
    overchargePrevRef.current = keysRef.current.overcharge
    if (overchargePressed && gs.overchargeCharges > 0) {
      gs.overchargeCharges -= 1
      gs.overchargeFlashTimer = OVERCHARGE_FLASH_DURATION
      const turretPos = pointOnCircle(gs.turret.angle, ORBIT_RADIUS)
      const within = (angle: number, radius: number) => {
        const p = pointOnCircle(angle, radius)
        return Math.hypot(p.x - turretPos.x, p.y - turretPos.y) < OVERCHARGE_RADIUS
      }
      const caughtBeams = gs.beams.filter((b) => within(b.angle, b.radius))
      const caughtFighters = gs.fighters.filter((f) => within(f.angle, f.radius))
      let kill = 0
      for (const b of caughtBeams) {
        const p = pointOnCircle(b.angle, b.radius)
        gs.explosions.push(spawnExplosion(gs.rng, p.x, p.y, gs.idCounter++, 'overcharge'))
        const mult = kill === 0 ? 1 : OVERCHARGE_BONUS_MULT
        gs.score += BEAM_POINTS * gs.combo * mult
        gs.combo = nextCombo(gs.combo)
        kill++
      }
      for (const f of caughtFighters) {
        const p = pointOnCircle(f.angle, f.radius)
        gs.explosions.push(spawnExplosion(gs.rng, p.x, p.y, gs.idCounter++, 'overcharge'))
        const mult = kill === 0 ? 1 : OVERCHARGE_BONUS_MULT
        gs.score += FIGHTER_POINTS * gs.combo * mult
        gs.combo = nextCombo(gs.combo)
        kill++
      }
      gs.beams = gs.beams.filter((b) => !within(b.angle, b.radius))
      gs.fighters = gs.fighters.filter((f) => !within(f.angle, f.radius))
      audio.playOvercharge()
    }

    const canFireMore = gs.waveEventsSpawned < gs.waveQuota
    const tuning = waveConfig(gs.waveIndex)
    const { dreadnoughts: nextDreadnoughts, events } = stepDreadnoughts(gs.dreadnoughts, dt, tuning, gs.rng, canFireMore)
    for (let i = 0; i < gs.dreadnoughts.length; i++) {
      if (gs.dreadnoughts[i].state === 'cooldown' && nextDreadnoughts[i].state === 'telegraph') {
        audio.playTelegraph()
      }
    }
    gs.dreadnoughts = nextDreadnoughts
    for (const ev of events) {
      gs.waveEventsSpawned++
      if (ev.kind === 'beam') {
        for (const angle of ev.angles) gs.beams.push(spawnBeam(gs.idCounter++, angle, tuning.beamSpeed))
      } else {
        gs.fighters.push(spawnFighter(gs.rng, gs.idCounter++, ev.angle, tuning.fighterSpeed))
      }
    }

    gs.beams = stepBeams(gs.beams, dt)
    gs.fighters = stepFighters(gs.fighters, gs.turret.angle, dt)
    gs.shots = stepShots(gs.shots, dt)
    gs.explosions = stepExplosions(gs.explosions, dt)

    // Player shots vs beams/fighters.
    const consumedShotIds = new Set<number>()
    const destroyedBeamIds = new Set<number>()
    const destroyedFighterIds = new Set<number>()
    for (const shot of gs.shots) {
      if (consumedShotIds.has(shot.id)) continue
      const sp = pointOnCircle(shot.angle, shot.radius)
      for (const b of gs.beams) {
        if (destroyedBeamIds.has(b.id)) continue
        const bp = pointOnCircle(b.angle, b.radius)
        if (Math.hypot(sp.x - bp.x, sp.y - bp.y) < HIT_DISTANCE) {
          consumedShotIds.add(shot.id)
          destroyedBeamIds.add(b.id)
          gs.explosions.push(spawnExplosion(gs.rng, bp.x, bp.y, gs.idCounter++, 'beam'))
          gs.score += BEAM_POINTS * gs.combo
          gs.combo = nextCombo(gs.combo)
          audio.playIntercept()
          break
        }
      }
    }
    for (const shot of gs.shots) {
      if (consumedShotIds.has(shot.id)) continue
      const sp = pointOnCircle(shot.angle, shot.radius)
      for (const f of gs.fighters) {
        if (destroyedFighterIds.has(f.id)) continue
        const fp = pointOnCircle(f.angle, f.radius)
        if (Math.hypot(sp.x - fp.x, sp.y - fp.y) < HIT_DISTANCE) {
          consumedShotIds.add(shot.id)
          destroyedFighterIds.add(f.id)
          gs.explosions.push(spawnExplosion(gs.rng, fp.x, fp.y, gs.idCounter++, 'fighter'))
          gs.score += FIGHTER_POINTS * gs.combo
          gs.combo = nextCombo(gs.combo)
          audio.playFighterKill()
          break
        }
      }
    }
    if (consumedShotIds.size > 0) gs.shots = gs.shots.filter((s) => !consumedShotIds.has(s.id))
    if (destroyedBeamIds.size > 0) gs.beams = gs.beams.filter((b) => !destroyedBeamIds.has(b.id))
    if (destroyedFighterIds.size > 0) gs.fighters = gs.fighters.filter((f) => !destroyedFighterIds.has(f.id))

    // Beams/fighters that reached the core.
    let coreWasHit = false
    const survivingBeams: Beam[] = []
    for (const b of gs.beams) {
      if (b.radius <= STAR_RADIUS) {
        const idx = segmentIndexForAngle(b.angle)
        gs.segments[idx] = { health: Math.max(0, gs.segments[idx].health - 1) }
        const p = pointOnCircle(b.angle, STAR_RADIUS)
        gs.explosions.push(spawnExplosion(gs.rng, p.x, p.y, gs.idCounter++, 'beam'))
        coreWasHit = true
      } else {
        survivingBeams.push(b)
      }
    }
    gs.beams = survivingBeams

    const survivingFighters: Fighter[] = []
    for (const f of gs.fighters) {
      if (f.radius <= STAR_RADIUS) {
        const idx = segmentIndexForAngle(f.angle)
        gs.segments[idx] = { health: Math.max(0, gs.segments[idx].health - 1) }
        const p = pointOnCircle(f.angle, STAR_RADIUS)
        gs.explosions.push(spawnExplosion(gs.rng, p.x, p.y, gs.idCounter++, 'fighter'))
        coreWasHit = true
      } else {
        survivingFighters.push(f)
      }
    }
    gs.fighters = survivingFighters

    if (coreWasHit) {
      gs.combo = COMBO_START
      audio.playSegmentHit()
    }

    if (allSegmentsDestroyed(gs.segments)) {
      endRun(gs)
      return
    }

    if (gs.waveEventsSpawned >= gs.waveQuota && gs.beams.length === 0 && gs.fighters.length === 0) {
      const bonus = endOfWaveBonus(totalRemainingHealth(gs.segments))
      gs.score += bonus
      gs.lastWaveBonus = bonus
      audio.playWaveClear()
      audio.setThrusterOn(false)
      setClearedWaveNumber(gs.waveIndex + 1)
      setWaveBonus(bonus)
      setPhase('wave-cleared')
    }
  }

  function draw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const gs = gsRef.current

    ctx.fillStyle = '#03040a'
    ctx.fillRect(0, 0, VIEW_SIZE, VIEW_SIZE)

    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    for (const s of starsRef.current) {
      const tw = 0.5 + 0.5 * Math.sin(gs.cosmeticClock * 1.5 + s.phase)
      ctx.globalAlpha = 0.3 + tw * 0.5
      ctx.fillRect(s.x, s.y, s.r, s.r)
    }
    ctx.globalAlpha = 1

    // Orbit guide ring.
    ctx.beginPath()
    ctx.arc(CENTER.x, CENTER.y, ORBIT_RADIUS, 0, Math.PI * 2)
    ctx.setLineDash([4, 8])
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.setLineDash([])

    drawStar(ctx, gs.cosmeticClock)
    drawSegments(ctx, gs.segments)

    for (const d of gs.dreadnoughts) drawDreadnought(ctx, d)
    for (const b of gs.beams) drawBeam(ctx, b)
    for (const f of gs.fighters) drawFighter(ctx, f)
    for (const s of gs.shots) drawShot(ctx, s)
    for (const ex of gs.explosions) drawExplosion(ctx, ex)

    drawTurret(ctx, gs.turret)
    drawHud(ctx, gs)

    if (gs.overchargeFlashTimer > 0) {
      const alpha = (gs.overchargeFlashTimer / OVERCHARGE_FLASH_DURATION) * 0.4
      ctx.fillStyle = `rgba(253,224,71,${alpha})`
      ctx.fillRect(0, 0, VIEW_SIZE, VIEW_SIZE)
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
    keysRef.current = { left: false, right: false, fire: false, overcharge: false }
    overchargePrevRef.current = false
    setPhase('playing')
  }

  function nextWave() {
    const gs = gsRef.current
    startWaveState(gs, gs.waveIndex + 1)
    setPhase('playing')
  }

  function toggleMute() {
    audio.init()
    const next = !muted
    audio.setMuted(next)
    setMuted(next)
  }

  return (
    <div className="solar-ward fullscreen">
      <div className="sw2-game-area">
        <canvas ref={canvasRef} width={VIEW_SIZE} height={VIEW_SIZE} className="sw2-canvas" />

        <button type="button" className="sw2-mute" onClick={toggleMute} aria-label={muted ? 'Unmute sound' : 'Mute sound'}>
          {muted ? '🔇' : '🔊'}
        </button>

        {phase === 'intro' && (
          <div className="sw2-overlay">
            <h1>Solar Ward</h1>
            <p className="sw2-tagline">
              Orbit the dying star, intercept photon beams and diving fighters, and keep all five
              of the core's sectors alive. There's no final wave — only a score to chase.
            </p>
            <ul className="sw2-controls">
              <li><kbd>&larr;</kbd>/<kbd>&rarr;</kbd> orbital thrusters (momentum-based)</li>
              <li><kbd>Z</kbd> fire</li>
              <li><kbd>X</kbd> Overcharge Pulse — clears everything nearby</li>
            </ul>
            <button type="button" className="sw2-primary" onClick={start}>
              Launch
            </button>
          </div>
        )}

        {phase === 'wave-cleared' && (
          <div className="sw2-overlay">
            <h1>Wave {clearedWaveNumber} Cleared</h1>
            <p className="sw2-tagline">
              Integrity bonus: <strong>+{Math.floor(waveBonus)}</strong>
              {' '}
              <span className="sw2-dim">(max {maxPossibleWaveBonus(5)})</span>
            </p>
            <p className="sw2-tagline">Score: {Math.floor(gsRef.current.score)}</p>
            <button type="button" className="sw2-primary" onClick={nextWave}>
              Next Wave
            </button>
          </div>
        )}

        {phase === 'gameover' && (
          <div className="sw2-overlay">
            <h1>Core Lost</h1>
            <p className="sw2-tagline">
              Final score: <strong>{finalScore}</strong>
              {bestScore !== null && bestScore === finalScore && <span className="sw2-new-best"> New best!</span>}
            </p>
            {bestScore !== null && bestScore !== finalScore && (
              <p className="sw2-tagline">Best this session: {bestScore}</p>
            )}
            <button type="button" className="sw2-primary" onClick={start}>
              Defend Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default SolarWard
