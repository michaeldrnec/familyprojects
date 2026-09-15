import { useEffect, useReducer, useRef, useState } from 'react'
import {
  PADS,
  CORE,
  CORE_RADIUS,
  VIEW_WIDTH,
  VIEW_HEIGHT,
  WAYPOINTS,
  type Pad,
  type Point,
} from './path'
import { ENEMY_DEFS, spawnEnemy, advanceEnemy, type Enemy, type EnemyId } from './enemies'
import {
  TOWER_DEFS,
  TOWER_ORDER,
  towerStats,
  SIEGE_COIL_BOSS_MULTIPLIER,
  type TowerInstance,
  type TowerId,
  type TowerDef,
  type TowerTierStats,
  type BranchId,
} from './towers'
import { WAVES, TOTAL_WAVES, type WaveDef, type WaveSpawnEntry } from './waves'
import { STARTING_CREDITS, CORE_INTEGRITY_MAX, sellRefund, killCredit, killScore, waveClearBonus } from './economy'
import { loadProgress, recordRun, isTowerUnlocked, isBranchUnlocked, type Progress } from './progress'
import { makeRng, type Rng } from './rng'
import { spawnExplosion, stepExplosions, type Explosion } from './explosions'
import {
  fireProjectile,
  stepProjectiles,
  stepFx,
  type Projectile,
  type BeamFx,
  type ChainFx,
} from './projectiles'
import * as audio from './audio'
import './IonPerimeter.css'

type Phase = 'start' | 'playing' | 'paused' | 'wave-cleared' | 'game-over' | 'victory'

interface WaveSummary {
  kills: number
  creditsEarned: number
  bonus: number
}

const WAVE_CLEAR_AUTO_ADVANCE = 7 // seconds before the next wave auto-starts
const PAD_HIT_RADIUS = 24
const TOWER_HIT_RADIUS = 22
const BOSS_WARN_LEAD = 2.6 // seconds of siren/banner before a boss actually spawns

// ---------------------------------------------------------------------------
// Drawing helpers (module scope, pure functions of a canvas + data) -- kept
// outside the component the same way gravity-well/starwarden do, since none
// of them need React state directly.
// ---------------------------------------------------------------------------

function makeStars(rng: Rng, count: number): Point[] {
  const stars: Point[] = []
  for (let i = 0; i < count; i++) stars.push({ x: rng.range(0, VIEW_WIDTH), y: rng.range(0, VIEW_HEIGHT) })
  return stars
}

function drawStars(ctx: CanvasRenderingContext2D, stars: Point[]) {
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  for (const s of stars) ctx.fillRect(s.x, s.y, 1.4, 1.4)
}

function drawNebula(ctx: CanvasRenderingContext2D) {
  const blobs: [number, number, number, string][] = [
    [180, 120, 260, 'rgba(76,60,140,0.12)'],
    [820, 500, 300, 'rgba(20,90,110,0.14)'],
    [520, 80, 220, 'rgba(120,40,90,0.08)'],
  ]
  for (const [x, y, r, color] of blobs) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
    grad.addColorStop(0, color)
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
}

function strokePath(ctx: CanvasRenderingContext2D, points: Point[]) {
  ctx.beginPath()
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  ctx.stroke()
}

function drawLane(ctx: CanvasRenderingContext2D) {
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(76,175,63,0.14)'
  ctx.lineWidth = 48
  strokePath(ctx, WAYPOINTS)
  ctx.strokeStyle = 'rgba(14,20,28,0.95)'
  ctx.lineWidth = 34
  strokePath(ctx, WAYPOINTS)
  ctx.strokeStyle = 'rgba(110,180,255,0.3)'
  ctx.lineWidth = 34
  strokePath(ctx, WAYPOINTS)
  ctx.strokeStyle = 'rgba(180,220,255,0.22)'
  ctx.lineWidth = 2
  ctx.setLineDash([10, 14])
  strokePath(ctx, WAYPOINTS)
  ctx.setLineDash([])
  ctx.restore()
}

function drawPad(ctx: CanvasRenderingContext2D, pad: Pad, occupied: boolean, hoverValid: boolean | null) {
  if (occupied) return
  ctx.save()
  ctx.translate(pad.x, pad.y)
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6
    const px = Math.cos(a) * 16
    const py = Math.sin(a) * 16
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = hoverValid ? 'rgba(76,175,63,0.22)' : 'rgba(255,255,255,0.045)'
  ctx.fill()
  ctx.strokeStyle = hoverValid ? 'rgba(76,175,63,0.85)' : 'rgba(255,255,255,0.16)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.restore()
}

function drawCore(ctx: CanvasRenderingContext2D, integrity: number, t: number) {
  const frac = integrity / CORE_INTEGRITY_MAX
  const color = frac > 0.3 ? '#4cd3ff' : '#f87171'
  ctx.save()
  ctx.translate(CORE.x, CORE.y)
  const pulse = 1 + Math.sin(t * 2) * 0.04
  const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, CORE_RADIUS * pulse)
  grad.addColorStop(0, frac > 0.3 ? 'rgba(140,225,255,0.9)' : 'rgba(255,140,140,0.9)')
  grad.addColorStop(1, 'rgba(20,40,60,0.15)')
  ctx.beginPath()
  ctx.arc(0, 0, CORE_RADIUS * pulse, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.shadowColor = color
  ctx.shadowBlur = 22
  ctx.fill()
  ctx.beginPath()
  ctx.arc(0, 0, CORE_RADIUS + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac)
  ctx.strokeStyle = color
  ctx.lineWidth = 4
  ctx.shadowBlur = 10
  ctx.stroke()
  ctx.restore()
}

function drawTower(ctx: CanvasRenderingContext2D, tower: TowerInstance) {
  const def = TOWER_DEFS[tower.defId]
  ctx.save()
  ctx.translate(tower.x, tower.y)
  const size = 12 + tower.tier * 2.4
  ctx.shadowColor = def.color
  ctx.shadowBlur = 9 + tower.fxTimer * 45
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6
    const px = Math.cos(a) * size
    const py = Math.sin(a) * size
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = 'rgba(8,12,20,0.92)'
  ctx.fill()
  ctx.strokeStyle = def.color
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.save()
  ctx.rotate(tower.angle)
  ctx.strokeStyle = def.color
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(size + 9, 0)
  ctx.stroke()
  ctx.restore()
  // tier pips
  for (let i = 0; i <= tower.tier; i++) {
    ctx.beginPath()
    ctx.arc(-size + i * 6 + 3, size + 7, 1.8, 0, Math.PI * 2)
    ctx.fillStyle = def.color
    ctx.fill()
  }
  // branch ring once specialized
  if (tower.branch) {
    ctx.beginPath()
    ctx.arc(0, 0, size + 5, 0, Math.PI * 2)
    ctx.strokeStyle = tower.branch === 'a' ? '#fbbf24' : '#f472b6'
    ctx.lineWidth = 1.4
    ctx.stroke()
  }
  ctx.restore()
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy) {
  const def = ENEMY_DEFS[enemy.defId]
  const r = def.radius
  ctx.save()
  ctx.translate(enemy.x, enemy.y)
  ctx.rotate(enemy.angle)
  ctx.globalAlpha = enemy.cloaked ? 0.26 : 1
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(-r * 0.8, r * 0.7)
  ctx.lineTo(-r * 0.4, 0)
  ctx.lineTo(-r * 0.8, -r * 0.7)
  ctx.closePath()
  ctx.fillStyle = def.color
  ctx.shadowColor = def.color
  ctx.shadowBlur = def.boss ? 20 : 7
  ctx.fill()
  if (enemy.hitFlash > 0) {
    ctx.globalAlpha = Math.min(0.85, enemy.hitFlash * 8)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
  }
  ctx.restore()

  if (enemy.shield > 0) {
    ctx.save()
    ctx.globalAlpha = enemy.cloaked ? 0.22 : 0.55
    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(enemy.x, enemy.y, r + 6, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  if (enemy.hp < enemy.maxHp) {
    const w = def.boss ? 44 : 20
    const frac = Math.max(0, enemy.hp / enemy.maxHp)
    ctx.save()
    ctx.globalAlpha = enemy.cloaked ? 0.3 : 0.9
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(enemy.x - w / 2, enemy.y - r - 10, w, 4)
    ctx.fillStyle = frac > 0.5 ? '#4ade80' : frac > 0.25 ? '#fbbf24' : '#f87171'
    ctx.fillRect(enemy.x - w / 2, enemy.y - r - 10, w * frac, 4)
    ctx.restore()
  }

  if (def.boss) {
    ctx.save()
    ctx.globalAlpha = 0.7
    ctx.strokeStyle = def.color
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(enemy.x, enemy.y, r + 12, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile) {
  ctx.save()
  ctx.shadowColor = p.color
  ctx.shadowBlur = 8
  ctx.fillStyle = p.color
  ctx.beginPath()
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawBeamFx(ctx: CanvasRenderingContext2D, fx: BeamFx) {
  ctx.save()
  ctx.globalAlpha = fx.life / fx.maxLife
  ctx.strokeStyle = fx.color
  ctx.lineWidth = 3
  ctx.shadowColor = fx.color
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.moveTo(fx.x1, fx.y1)
  ctx.lineTo(fx.x2, fx.y2)
  ctx.stroke()
  ctx.restore()
}

function drawChainFx(ctx: CanvasRenderingContext2D, fx: ChainFx) {
  ctx.save()
  ctx.globalAlpha = fx.life / fx.maxLife
  ctx.strokeStyle = fx.color
  ctx.lineWidth = 2
  ctx.shadowColor = fx.color
  ctx.shadowBlur = 8
  ctx.setLineDash([3, 4])
  strokePath(ctx, fx.points)
  ctx.setLineDash([])
  ctx.restore()
}

function drawExplosion(ctx: CanvasRenderingContext2D, ex: Explosion) {
  const progress = ex.age / ex.duration
  const alpha = 1 - progress
  ctx.save()
  for (const p of ex.particles) {
    const dist = p.speed * ex.age
    const x = ex.x + Math.cos(p.angle) * dist
    const y = ex.y + Math.sin(p.angle) * dist
    ctx.globalAlpha = Math.max(0, alpha)
    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.arc(x, y, p.size * (1 - progress * 0.4), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawRangeRing(ctx: CanvasRenderingContext2D, x: number, y: number, range: number, valid: boolean) {
  ctx.save()
  ctx.setLineDash([5, 6])
  ctx.strokeStyle = valid ? 'rgba(76,175,63,0.6)' : 'rgba(248,113,113,0.6)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(x, y, range, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Wave scheduling
// ---------------------------------------------------------------------------

interface ScheduledSpawn {
  time: number
  defId: EnemyId
}

function buildSpawnQueue(waveDef: WaveDef): { queue: ScheduledSpawn[]; bossWarnAt: number | null } {
  const entries: ScheduledSpawn[] = []
  let lastRegularTime = 0
  for (const s of waveDef.spawns as WaveSpawnEntry[]) {
    for (let i = 0; i < s.count; i++) {
      const time = s.delay + i * s.interval
      entries.push({ time, defId: s.defId })
      lastRegularTime = Math.max(lastRegularTime, time)
    }
  }
  entries.sort((a, b) => a.time - b.time)
  let bossWarnAt: number | null = null
  if (waveDef.boss) {
    const bossTime = lastRegularTime + waveDef.bossDelay
    entries.push({ time: bossTime, defId: waveDef.boss })
    bossWarnAt = Math.max(0, bossTime - BOSS_WARN_LEAD)
  }
  return { queue: entries, bossWarnAt }
}

// ---------------------------------------------------------------------------

function IonPerimeter() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [phase, setPhase] = useState<Phase>('start')
  const [credits, setCredits] = useState(STARTING_CREDITS)
  const [coreIntegrity, setCoreIntegrity] = useState(CORE_INTEGRITY_MAX)
  const [waveNumber, setWaveNumber] = useState(0)
  const [score, setScore] = useState(0)
  const [selectedTowerType, setSelectedTowerType] = useState<TowerId | null>(null)
  const [selectedTowerId, setSelectedTowerId] = useState<number | null>(null)
  const [muted, setMuted] = useState(audio.isMuted())
  const [speed, setSpeed] = useState<1 | 2>(1)
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [isNewBest, setIsNewBest] = useState(false)
  const [waveSummary, setWaveSummary] = useState<WaveSummary | null>(null)
  const [bossWarning, setBossWarning] = useState(false)

  // Forces a re-render after a ref-only mutation (e.g. choosing a tier-3
  // branch) that doesn't otherwise touch any React state.
  const [, forceUpdate] = useReducer((c: number) => c + 1, 0)

  const enemiesRef = useRef<Enemy[]>([])
  const towersRef = useRef<TowerInstance[]>([])
  const projectilesRef = useRef<Projectile[]>([])
  const beamFxRef = useRef<BeamFx[]>([])
  const chainFxRef = useRef<ChainFx[]>([])
  const explosionsRef = useRef<Explosion[]>([])
  const nextIdRef = useRef(1)
  const worldTimeRef = useRef(0)
  const rngRef = useRef<Rng>(makeRng((Date.now() % 2147483647) >>> 0))
  const starsRef = useRef<Point[]>(makeStars(rngRef.current, 90))

  const creditsRef = useRef(STARTING_CREDITS)
  const coreRef = useRef(CORE_INTEGRITY_MAX)
  const scoreRef = useRef(0)

  const spawnQueueRef = useRef<ScheduledSpawn[]>([])
  const waveTimerRef = useRef(0)
  const waveKillsRef = useRef(0)
  const waveCreditsRef = useRef(0)
  const bossWarnAtRef = useRef<number | null>(null)
  const bossWarnedRef = useRef(false)
  const bossWarningRemainingRef = useRef(0)
  const waveClearedTimerRef = useRef(0)

  const hoveredPadRef = useRef<string | null>(null)

  function addCredits(amount: number) {
    creditsRef.current += amount
    setCredits(creditsRef.current)
  }

  function trySpend(amount: number): boolean {
    if (creditsRef.current < amount) return false
    creditsRef.current -= amount
    setCredits(creditsRef.current)
    return true
  }

  function addScore(amount: number) {
    scoreRef.current += amount
    setScore(scoreRef.current)
  }

  function damageCore(amount: number) {
    coreRef.current = Math.max(0, coreRef.current - amount)
    setCoreIntegrity(coreRef.current)
  }

  function resetRun() {
    enemiesRef.current = []
    towersRef.current = []
    projectilesRef.current = []
    beamFxRef.current = []
    chainFxRef.current = []
    explosionsRef.current = []
    spawnQueueRef.current = []
    nextIdRef.current = 1
    creditsRef.current = STARTING_CREDITS
    coreRef.current = CORE_INTEGRITY_MAX
    scoreRef.current = 0
    waveKillsRef.current = 0
    waveCreditsRef.current = 0
    bossWarnAtRef.current = null
    bossWarnedRef.current = false
    bossWarningRemainingRef.current = 0
    setCredits(STARTING_CREDITS)
    setCoreIntegrity(CORE_INTEGRITY_MAX)
    setScore(0)
    setSelectedTowerType(null)
    setSelectedTowerId(null)
    setWaveSummary(null)
    setBossWarning(false)
    setIsNewBest(false)
    forceUpdate()
  }

  function launchWave(index: number) {
    const waveDef = WAVES[index - 1]
    const { queue, bossWarnAt } = buildSpawnQueue(waveDef)
    spawnQueueRef.current = queue
    bossWarnAtRef.current = bossWarnAt
    bossWarnedRef.current = false
    waveTimerRef.current = 0
    waveKillsRef.current = 0
    waveCreditsRef.current = 0
    setWaveNumber(index)
    setWaveSummary(null)
    setPhase('playing')
  }

  function handleStart() {
    audio.init()
    resetRun()
    launchWave(1)
  }

  function endRun(won: boolean) {
    const { progress: nextProgress, isNewBest: best } = recordRun(waveNumber, scoreRef.current)
    setProgress(nextProgress)
    setIsNewBest(best)
    setPhase(won ? 'victory' : 'game-over')
    if (won) audio.playVictory()
    else audio.playGameOver()
  }

  function completeWave() {
    const waveDef = WAVES[waveNumber - 1]
    const wasBoss = !!waveDef?.boss
    const bonus = waveClearBonus(coreRef.current, waveNumber, wasBoss)
    addCredits(bonus)
    addScore(bonus)
    audio.playWaveClear()
    if (waveNumber >= TOTAL_WAVES) {
      endRun(true)
      return
    }
    setWaveSummary({ kills: waveKillsRef.current, creditsEarned: waveCreditsRef.current, bonus })
    waveClearedTimerRef.current = WAVE_CLEAR_AUTO_ADVANCE
    setPhase('wave-cleared')
  }

  function applyDamage(enemy: Enemy, amount: number, ignoresArmor: boolean, armor: number, now: number) {
    enemy.lastHitAt = now
    enemy.hitFlash = 0.1
    let remaining = amount
    if (enemy.shield > 0) {
      const absorbed = Math.min(enemy.shield, remaining)
      enemy.shield -= absorbed
      remaining -= absorbed
    }
    if (remaining > 0) {
      enemy.hp -= ignoresArmor ? remaining : Math.max(1, remaining - armor)
    }
  }

  function enemiesInRangeSorted(x: number, y: number, range: number): Enemy[] {
    const r2 = range * range
    return enemiesRef.current
      .filter((e) => {
        const dx = e.x - x
        const dy = e.y - y
        return dx * dx + dy * dy <= r2
      })
      .sort((a, b) => b.distance - a.distance)
  }

  function fireBeam(tower: TowerInstance, def: TowerDef, stats: TowerTierStats, targets: Enemy[], now: number) {
    const primary = targets[0]
    const angle = Math.atan2(primary.y - tower.y, primary.x - tower.x)
    tower.angle = angle
    let hit: Enemy[] = [primary]
    if (stats.pierce > 1) {
      const dirX = Math.cos(angle)
      const dirY = Math.sin(angle)
      const extra = targets
        .slice(1)
        .map((e) => {
          const vx = e.x - tower.x
          const vy = e.y - tower.y
          return { e, along: vx * dirX + vy * dirY, perp: Math.abs(vx * dirY - vy * dirX) }
        })
        .filter((v) => v.along > 0 && v.perp < 16)
        .sort((a, b) => a.along - b.along)
        .map((v) => v.e)
      hit = hit.concat(extra.slice(0, stats.pierce - 1))
    }
    let maxAlong = 30
    for (const enemy of hit) {
      const targetDef = ENEMY_DEFS[enemy.defId]
      let dmg = stats.damage
      if (tower.defId === 'railgun' && tower.tier === 2 && tower.branch === 'b' && targetDef.boss) {
        dmg *= SIEGE_COIL_BOSS_MULTIPLIER
      }
      applyDamage(enemy, dmg, def.ignoresArmor, targetDef.armor, now)
      explosionsRef.current.push(spawnExplosion(rngRef.current, enemy.x, enemy.y, nextIdRef.current++, 'hit'))
      const vx = enemy.x - tower.x
      const vy = enemy.y - tower.y
      maxAlong = Math.max(maxAlong, vx * Math.cos(angle) + vy * Math.sin(angle) + 14)
    }
    beamFxRef.current.push({
      id: nextIdRef.current++,
      x1: tower.x,
      y1: tower.y,
      x2: tower.x + Math.cos(angle) * maxAlong,
      y2: tower.y + Math.sin(angle) * maxAlong,
      color: def.color,
      life: 0.12,
      maxLife: 0.12,
    })
    if (tower.defId === 'railgun') audio.playFireRailgun()
    else audio.playFireLaser()
  }

  function doChainDamage(tower: TowerInstance, stats: TowerTierStats, now: number) {
    const inRange = enemiesRef.current
      .map((e) => ({ e, d: Math.hypot(e.x - tower.x, e.y - tower.y) }))
      .filter((v) => v.d <= stats.range)
    if (!inRange.length) return
    const pool = inRange.sort((a, b) => a.d - b.d).map((v) => v.e)
    const chain: Enemy[] = []
    let cursor: Point = { x: tower.x, y: tower.y }
    for (let i = 0; i < stats.chainCount && pool.length; i++) {
      pool.sort((a, b) => Math.hypot(a.x - cursor.x, a.y - cursor.y) - Math.hypot(b.x - cursor.x, b.y - cursor.y))
      const next = pool.shift()!
      chain.push(next)
      cursor = { x: next.x, y: next.y }
    }
    const points: Point[] = [{ x: tower.x, y: tower.y }, ...chain.map((e) => ({ x: e.x, y: e.y }))]
    for (const enemy of chain) {
      const targetDef = ENEMY_DEFS[enemy.defId]
      applyDamage(enemy, stats.damage, true, targetDef.armor, now)
    }
    chainFxRef.current.push({ id: nextIdRef.current++, points, color: TOWER_DEFS.disruptor.color, life: 0.25, maxLife: 0.25 })
    audio.playFireDisruptor()
  }

  function applyProjectileImpact(impact: { x: number; y: number; targetId: number | null; damage: number; splashRadius: number; ignoresArmor: boolean }, now: number) {
    if (impact.splashRadius > 0) {
      const hits = enemiesRef.current.filter((e) => Math.hypot(e.x - impact.x, e.y - impact.y) <= impact.splashRadius)
      for (const enemy of hits) {
        const targetDef = ENEMY_DEFS[enemy.defId]
        applyDamage(enemy, impact.damage, impact.ignoresArmor, targetDef.armor, now)
      }
      explosionsRef.current.push(spawnExplosion(rngRef.current, impact.x, impact.y, nextIdRef.current++, 'kill'))
      audio.playExplosion('kill')
    } else if (impact.targetId !== null) {
      const enemy = enemiesRef.current.find((e) => e.id === impact.targetId)
      if (enemy) {
        const targetDef = ENEMY_DEFS[enemy.defId]
        applyDamage(enemy, impact.damage, impact.ignoresArmor, targetDef.armor, now)
        explosionsRef.current.push(spawnExplosion(rngRef.current, enemy.x, enemy.y, nextIdRef.current++, 'hit'))
      }
    }
  }

  function stepTower(tower: TowerInstance, dt: number, now: number) {
    const def = TOWER_DEFS[tower.defId]
    const stats = towerStats(tower)
    tower.cooldown = Math.max(0, tower.cooldown - dt)
    if (tower.fxTimer > 0) tower.fxTimer = Math.max(0, tower.fxTimer - dt)

    if (def.fireMode === 'chain') {
      let anyInRange = false
      for (const enemy of enemiesRef.current) {
        const dx = enemy.x - tower.x
        const dy = enemy.y - tower.y
        if (dx * dx + dy * dy <= stats.range * stats.range) {
          enemy.slowUntil = now + 0.3
          enemy.slowFactor = stats.slowFactor
          anyInRange = true
        }
      }
      if (anyInRange && tower.cooldown <= 0) {
        tower.cooldown = stats.fireInterval
        tower.fxTimer = 0.15
        doChainDamage(tower, stats, now)
      }
      return
    }

    if (tower.cooldown > 0) return
    const targets = enemiesInRangeSorted(tower.x, tower.y, stats.range)
    if (!targets.length) return
    tower.cooldown = stats.fireInterval
    tower.fxTimer = 0.1
    const primary = targets[0]
    tower.angle = Math.atan2(primary.y - tower.y, primary.x - tower.x)

    if (def.fireMode === 'projectile') {
      projectilesRef.current.push(
        fireProjectile(
          nextIdRef.current++,
          tower.x,
          tower.y,
          primary.x,
          primary.y,
          primary.id,
          stats.projectileSpeed,
          stats.damage,
          stats.splashRadius,
          def.ignoresArmor,
          def.color,
        ),
      )
      if (tower.defId === 'flak') audio.playFireFlak()
      else audio.playFireCannon()
    } else {
      fireBeam(tower, def, stats, targets, now)
    }
  }

  function stepFrame(dtRaw: number) {
    if (phase === 'wave-cleared') {
      waveClearedTimerRef.current -= dtRaw
      if (waveClearedTimerRef.current <= 0) launchWave(waveNumber + 1)
      return
    }

    if (bossWarningRemainingRef.current > 0) {
      bossWarningRemainingRef.current -= dtRaw
      if (bossWarningRemainingRef.current <= 0) setBossWarning(false)
    }

    if (phase !== 'playing') return
    const dt = dtRaw * speed
    const now = worldTimeRef.current

    waveTimerRef.current += dt
    if (bossWarnAtRef.current !== null && !bossWarnedRef.current && waveTimerRef.current >= bossWarnAtRef.current) {
      bossWarnedRef.current = true
      setBossWarning(true)
      bossWarningRemainingRef.current = BOSS_WARN_LEAD + 0.4
      audio.playBossIncoming()
    }
    while (spawnQueueRef.current.length && spawnQueueRef.current[0].time <= waveTimerRef.current) {
      const next = spawnQueueRef.current.shift()!
      enemiesRef.current.push(spawnEnemy(next.defId, nextIdRef.current++, waveNumber, now))
    }

    const survivors: Enemy[] = []
    const escorts: Enemy[] = []
    for (const enemy of enemiesRef.current) {
      const def = ENEMY_DEFS[enemy.defId]
      if (def.cloak) {
        enemy.cloakPhase += dt
        enemy.cloaked = enemy.cloakPhase % 4.4 < 1.6
      }
      if (enemy.shield < def.shield && now - enemy.lastHitAt > def.shieldRegenDelay) enemy.shield = def.shield
      if (enemy.hitFlash > 0) enemy.hitFlash = Math.max(0, enemy.hitFlash - dt)
      if (enemy.defId === 'harbinger' && !enemy.escortSpawned && enemy.hp <= enemy.maxHp * 0.6) {
        enemy.escortSpawned = true
        for (let i = 0; i < 3; i++) escorts.push(spawnEnemy('scout', nextIdRef.current++, waveNumber, now))
      }
      const speedNow = def.speed * (now < enemy.slowUntil ? enemy.slowFactor : 1)
      const reachedCore = enemy.hp > 0 && advanceEnemy(enemy, speedNow * dt)
      if (reachedCore) {
        damageCore(def.coreDamage)
        explosionsRef.current.push(spawnExplosion(rngRef.current, CORE.x, CORE.y, nextIdRef.current++, 'leak'))
        audio.playLeak()
        continue
      }
      survivors.push(enemy)
    }
    enemiesRef.current = survivors.concat(escorts)

    if (coreRef.current <= 0) {
      endRun(false)
      return
    }

    for (const tower of towersRef.current) stepTower(tower, dt, now)

    const { alive, impacts } = stepProjectiles(projectilesRef.current, dt, (id) => {
      const e = enemiesRef.current.find((x) => x.id === id)
      return e ? { x: e.x, y: e.y, radius: ENEMY_DEFS[e.defId].radius } : null
    })
    projectilesRef.current = alive
    for (const impact of impacts) applyProjectileImpact(impact, now)

    beamFxRef.current = stepFx(beamFxRef.current, dt)
    chainFxRef.current = stepFx(chainFxRef.current, dt)
    explosionsRef.current = stepExplosions(explosionsRef.current, dt)

    const stillAlive: Enemy[] = []
    for (const enemy of enemiesRef.current) {
      if (enemy.hp <= 0) {
        const def = ENEMY_DEFS[enemy.defId]
        addCredits(killCredit(def))
        addScore(killScore(def))
        waveKillsRef.current += 1
        waveCreditsRef.current += killCredit(def)
        explosionsRef.current.push(spawnExplosion(rngRef.current, enemy.x, enemy.y, nextIdRef.current++, 'kill'))
        audio.playExplosion('kill')
        continue
      }
      stillAlive.push(enemy)
    }
    enemiesRef.current = stillAlive

    if (spawnQueueRef.current.length === 0 && enemiesRef.current.length === 0) {
      completeWave()
    }
  }

  function draw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const t = worldTimeRef.current

    ctx.fillStyle = '#05070f'
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
    drawNebula(ctx)
    drawStars(ctx, starsRef.current)
    drawLane(ctx)

    const hoveredValidPad =
      selectedTowerType && hoveredPadRef.current
        ? !towersRef.current.some((tw) => tw.padId === hoveredPadRef.current)
        : null
    for (const pad of PADS) {
      const occupied = towersRef.current.some((tw) => tw.padId === pad.id)
      const hovered = hoveredPadRef.current === pad.id
      drawPad(ctx, pad, occupied, hovered ? hoveredValidPad : null)
    }
    drawCore(ctx, coreIntegrity, t)

    for (const tower of towersRef.current) drawTower(ctx, tower)
    for (const enemy of enemiesRef.current) drawEnemy(ctx, enemy)
    for (const p of projectilesRef.current) drawProjectile(ctx, p)
    for (const fx of beamFxRef.current) drawBeamFx(ctx, fx)
    for (const fx of chainFxRef.current) drawChainFx(ctx, fx)
    for (const ex of explosionsRef.current) drawExplosion(ctx, ex)

    if (selectedTowerType && hoveredPadRef.current) {
      const pad = PADS.find((p) => p.id === hoveredPadRef.current)
      if (pad) {
        const def = TOWER_DEFS[selectedTowerType]
        drawRangeRing(ctx, pad.x, pad.y, def.tiers[0].range, !!hoveredValidPad)
      }
    }
    if (selectedTowerId !== null) {
      const tower = towersRef.current.find((tw) => tw.id === selectedTowerId)
      if (tower) drawRangeRing(ctx, tower.x, tower.y, towerStats(tower).range, true)
    }
  }

  const stepRef = useRef(stepFrame)
  const drawRef = useRef(draw)
  useEffect(() => {
    stepRef.current = stepFrame
    drawRef.current = draw
    draw()
  })

  useEffect(() => {
    let raf: number
    let last = performance.now()
    function tick(now: number) {
      const dtRaw = Math.min((now - last) / 1000, 0.05)
      last = now
      worldTimeRef.current += dtRaw
      stepRef.current(dtRaw)
      drawRef.current()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  function canvasPoint(e: { clientX: number; clientY: number }): Point {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  function handleCanvasPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (phase !== 'playing' && phase !== 'wave-cleared' && phase !== 'paused') return
    const pt = canvasPoint(e)
    const hitTower = towersRef.current.find((t) => Math.hypot(t.x - pt.x, t.y - pt.y) <= TOWER_HIT_RADIUS)
    if (hitTower) {
      setSelectedTowerType(null)
      setSelectedTowerId(hitTower.id)
      return
    }
    if (selectedTowerType) {
      const pad = PADS.find((p) => Math.hypot(p.x - pt.x, p.y - pt.y) <= PAD_HIT_RADIUS)
      if (pad) {
        const occupied = towersRef.current.some((t) => t.padId === pad.id)
        const def = TOWER_DEFS[selectedTowerType]
        if (!occupied && isTowerUnlocked(def, progress) && trySpend(def.cost)) {
          towersRef.current.push({
            id: nextIdRef.current++,
            defId: selectedTowerType,
            padId: pad.id,
            x: pad.x,
            y: pad.y,
            tier: 0,
            branch: null,
            cooldown: 0,
            totalSpent: def.cost,
            angle: 0,
            fxTimer: 0,
            fxTargetX: pad.x,
            fxTargetY: pad.y,
          })
          audio.playPlace()
          setSelectedTowerType(null)
          forceUpdate()
        } else {
          audio.playDenied()
        }
        return
      }
    }
    setSelectedTowerType(null)
    setSelectedTowerId(null)
  }

  function handleCanvasPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const pt = canvasPoint(e)
    const pad = PADS.find((p) => Math.hypot(p.x - pt.x, p.y - pt.y) <= PAD_HIT_RADIUS)
    hoveredPadRef.current = pad ? pad.id : null
  }

  function handleShopSelect(id: TowerId) {
    const def = TOWER_DEFS[id]
    if (!isTowerUnlocked(def, progress)) {
      audio.playDenied()
      return
    }
    setSelectedTowerId(null)
    setSelectedTowerType((prev) => (prev === id ? null : id))
  }

  function handleUpgrade() {
    const tower = towersRef.current.find((t) => t.id === selectedTowerId)
    if (!tower || tower.tier >= 2) return
    const def = TOWER_DEFS[tower.defId]
    const cost = def.upgradeCost[tower.tier]
    if (!trySpend(cost)) {
      audio.playDenied()
      return
    }
    tower.tier += 1
    tower.totalSpent += cost
    audio.playUpgrade()
    forceUpdate()
  }

  function handleChooseBranch(branchId: BranchId) {
    const tower = towersRef.current.find((t) => t.id === selectedTowerId)
    if (!tower || tower.tier < 2 || tower.branch) return
    const def = TOWER_DEFS[tower.defId]
    const branch = def.branches.find((b) => b.id === branchId)
    if (!branch || !isBranchUnlocked(branch, progress)) {
      audio.playDenied()
      return
    }
    tower.branch = branchId
    audio.playUpgrade()
    forceUpdate()
  }

  function handleSell() {
    const tower = towersRef.current.find((t) => t.id === selectedTowerId)
    if (!tower) return
    towersRef.current = towersRef.current.filter((t) => t.id !== tower.id)
    addCredits(sellRefund(tower.totalSpent))
    audio.playSell()
    setSelectedTowerId(null)
    forceUpdate()
  }

  function handlePauseToggle() {
    if (phase === 'playing') setPhase('paused')
    else if (phase === 'paused') setPhase('playing')
  }

  function handleSpeedToggle() {
    setSpeed((s) => (s === 1 ? 2 : 1))
  }

  function handleMuteToggle() {
    const next = !muted
    setMuted(next)
    audio.setMuted(next)
  }

  function handleStartNextWave() {
    if (phase !== 'wave-cleared') return
    launchWave(waveNumber + 1)
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === ' ' && (phase === 'playing' || phase === 'paused')) {
        e.preventDefault()
        handlePauseToggle()
        return
      }
      if (phase !== 'playing' && phase !== 'wave-cleared') return
      const n = Number(e.key)
      if (n >= 1 && n <= TOWER_ORDER.length) {
        handleShopSelect(TOWER_ORDER[n - 1])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, progress])

  const hudVisible = phase === 'playing' || phase === 'paused' || phase === 'wave-cleared'
  const selectedTower = selectedTowerId !== null ? towersRef.current.find((t) => t.id === selectedTowerId) : undefined
  const bossDefForWarning = bossWarning ? WAVES[waveNumber - 1]?.boss : undefined

  return (
    <div className="ion-perimeter fullscreen">
      <button className="ip-mute" onClick={handleMuteToggle} aria-label={muted ? 'Unmute' : 'Mute'}>
        {muted ? '🔇' : '🔊'}
      </button>
      <div className="ip-game-area">
        {/* The map is wide (1000x640) like the lane it depicts, so a narrow
           phone held upright letterboxes it down to a thin strip -- this
           hint (CSS-only, see the coarse-pointer/portrait media query) is
           the whole fix: it costs nothing to build and portrait phone play
           is still fully playable, just cramped. */}
        <p className="ip-rotate-hint">↻ Rotate your device to landscape for a bigger view</p>
        {/* Overlays are children of this wrap (not .ip-game-area) and sized
           to match its aspect-ratio box exactly, so they hug the canvas's
           real edges under any letterboxing direction -- width-constrained
           on a narrow/mobile viewport as much as height-constrained on a
           wide desktop one -- instead of drifting relative to empty
           letterbox space the way an overlay pinned to the outer flex
           container would. */}
        <div className="ip-canvas-wrap">
          <canvas
            ref={canvasRef}
            width={VIEW_WIDTH}
            height={VIEW_HEIGHT}
            className={`ip-canvas ${selectedTowerType ? 'targeting' : ''}`}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerLeave={() => {
              hoveredPadRef.current = null
            }}
          />

          {hudVisible && (
          <>
            <div className="ip-hud-top">
              <div className="ip-hud-stat ip-credits">⬡ {credits}</div>
              <div className="ip-hud-core">
                <span className="ip-hud-core-label">Core</span>
                <div className="ip-core-bar">
                  <div className="ip-core-bar-fill" style={{ width: `${(coreIntegrity / CORE_INTEGRITY_MAX) * 100}%` }} />
                </div>
              </div>
              <div className="ip-hud-stat">
                Wave {waveNumber}/{TOTAL_WAVES}
              </div>
              <div className="ip-hud-stat ip-score">{score.toLocaleString()} pts</div>
              <div className="ip-hud-buttons">
                <button onClick={handleSpeedToggle} title="Toggle speed">
                  {speed}×
                </button>
                <button onClick={handlePauseToggle} title="Pause">
                  {phase === 'paused' ? '▶' : '⏸'}
                </button>
              </div>
            </div>

            <div className="ip-shop-bar">
              {TOWER_ORDER.map((id, i) => {
                const def = TOWER_DEFS[id]
                const unlocked = isTowerUnlocked(def, progress)
                return (
                  <button
                    key={id}
                    className={`ip-shop-btn ${selectedTowerType === id ? 'selected' : ''} ${!unlocked ? 'locked' : ''}`}
                    style={{ borderColor: unlocked ? def.color : undefined }}
                    disabled={!unlocked}
                    onClick={() => handleShopSelect(id)}
                    title={def.description}
                  >
                    <span className="ip-shop-key">{i + 1}</span>
                    <span className="ip-shop-name">{def.name}</span>
                    <span className="ip-shop-cost">{unlocked ? `⬡${def.cost}` : `🔒 Wave ${def.unlockWave}`}</span>
                  </button>
                )
              })}
            </div>

            {selectedTower &&
              (() => {
                const def = TOWER_DEFS[selectedTower.defId]
                const stats = towerStats(selectedTower)
                const branchName = selectedTower.branch ? def.branches.find((b) => b.id === selectedTower.branch)?.name : null
                return (
                  <div className="ip-tower-panel">
                    <div className="ip-panel-header">
                      <span>
                        {def.name}
                        {branchName ? ` — ${branchName}` : ''}
                      </span>
                      <span className="ip-panel-tier">Tier {selectedTower.tier + 1}/3</span>
                    </div>
                    <div className="ip-panel-stats">
                      <span>DMG {Math.round(stats.damage)}</span>
                      <span>RNG {Math.round(stats.range)}</span>
                      <span>RATE {(1 / stats.fireInterval).toFixed(1)}/s</span>
                    </div>
                    <div className="ip-panel-actions">
                      {selectedTower.tier < 2 && (
                        <button className="ip-panel-upgrade" onClick={handleUpgrade} disabled={credits < def.upgradeCost[selectedTower.tier]}>
                          Upgrade — ⬡{def.upgradeCost[selectedTower.tier]}
                        </button>
                      )}
                      {selectedTower.tier === 2 && !selectedTower.branch && (
                        <div className="ip-branch-choice">
                          {def.branches.map((b) => {
                            const unlocked = isBranchUnlocked(b, progress)
                            return (
                              <button key={b.id} disabled={!unlocked} onClick={() => handleChooseBranch(b.id)} title={b.description}>
                                {unlocked ? b.name : `🔒 Wave ${b.unlockWave}`}
                              </button>
                            )
                          })}
                        </div>
                      )}
                      <button className="ip-panel-sell" onClick={handleSell}>
                        Sell — ⬡{sellRefund(selectedTower.totalSpent)}
                      </button>
                    </div>
                  </div>
                )
              })()}

            {bossDefForWarning && (
              <div className="ip-banner ip-boss-warning">⚠ BOSS INCOMING: {ENEMY_DEFS[bossDefForWarning].name} ⚠</div>
            )}

            {phase === 'wave-cleared' && waveSummary && (
              <div className="ip-banner ip-wave-cleared">
                <div>
                  Wave {waveNumber} cleared — {waveSummary.kills} kills, +⬡{waveSummary.creditsEarned + waveSummary.bonus}
                </div>
                <button onClick={handleStartNextWave}>Start Wave {waveNumber + 1} now</button>
              </div>
            )}

            {phase === 'paused' && (
              <div className="ip-overlay">
                <h2>Paused</h2>
                <button className="ip-primary" onClick={handlePauseToggle}>
                  Resume
                </button>
              </div>
            )}
          </>
        )}

        {phase === 'start' && (
          <div className="ip-overlay">
            <h1>Ion Perimeter</h1>
            <p className="ip-tagline">
              Build weapon platforms along the lane, hold the outpost core for twenty waves, and break two dreadnoughts
              before it gives out.
            </p>
            {progress.bestWave > 0 && (
              <p className="ip-best">
                Best wave reached: {progress.bestWave} · High score: {progress.highScore.toLocaleString()}
              </p>
            )}
            <ul className="ip-controls-list">
              <li>Tap a tower type, then tap a pad to build it</li>
              <li>Tap a built tower to upgrade, specialize, or sell it</li>
              <li>
                <kbd>1</kbd>-<kbd>5</kbd> select a tower · <kbd>Space</kbd> pause
              </li>
            </ul>
            <button className="ip-primary" onClick={handleStart}>
              Start Run
            </button>
          </div>
        )}

        {(phase === 'game-over' || phase === 'victory') && (
          <div className="ip-overlay">
            <h1>{phase === 'victory' ? 'Perimeter Held' : 'Core Breached'}</h1>
            <p className="ip-tagline">
              {phase === 'victory' ? 'The Harbinger falls. The outpost survives.' : `The core gave out on wave ${waveNumber}.`}
            </p>
            <p>Score: {score.toLocaleString()}</p>
            {isNewBest && <p className="ip-new-best">New best!</p>}
            <p className="ip-best">
              Best wave: {progress.bestWave} · High score: {progress.highScore.toLocaleString()}
            </p>
            <button className="ip-primary" onClick={handleStart}>
              Restart
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

export default IonPerimeter
