import { useEffect, useMemo, useRef, useState } from 'react'
import {
  TICK_DT,
  checkOutcome,
  simulateTrajectory,
  stepRocket,
  surfaceDistance,
  velocityFromAngle,
  type RocketState,
  type Vec2,
} from './physics'
import { LEVELS } from './levels'
import { scoreLanding, type LevelScore } from './scoring'
import './GravityWell.css'

// Playback runs faster than real-time (a full simulated flight can be many
// seconds of sim-time) so retries stay snappy rather than making the
// player wait out a slow, realistic-speed flight every attempt.
const TICKS_PER_FRAME = 6
const CRASH_PAUSE_MS = 900
const DEFAULT_ANGLE = 45
const DEFAULT_POWER = 150
const ANGLE_MIN = 0
const ANGLE_MAX = 359
const ANGLE_STEP = 3
const POWER_MIN = 40
const POWER_MAX = 420
const POWER_STEP = 10

type Phase = 'aiming' | 'flying' | 'crashed' | 'won'

// A fixed starfield per level size, generated once (not re-randomized every
// render) purely for background flavor.
function makeStars(width: number, height: number, count: number): Vec2[] {
  const stars: Vec2[] = []
  for (let i = 0; i < count; i++) {
    stars.push({ x: Math.random() * width, y: Math.random() * height })
  }
  return stars
}

// A deterministic per-body "random" seed so each asteroid's jagged shape
// and craters stay stable across redraws (every animation frame) instead
// of flickering, without needing to store extra state per body.
function bodySeed(body: { x: number; y: number }): number {
  return body.x * 0.13 + body.y * 0.7
}

function drawAsteroid(ctx: CanvasRenderingContext2D, body: { x: number; y: number; radius: number }) {
  const { x, y, radius } = body
  const seed = bodySeed(body)
  const bumps = 9
  ctx.beginPath()
  for (let i = 0; i <= bumps; i++) {
    const angle = (i / bumps) * Math.PI * 2
    const r = radius * (0.8 + 0.25 * Math.sin(seed + i * 2.3) * Math.cos(seed * 1.7 + i))
    const px = x + Math.cos(angle) * r
    const py = y + Math.sin(angle) * r
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  const gradient = ctx.createRadialGradient(
    x - radius * 0.3,
    y - radius * 0.3,
    radius * 0.1,
    x,
    y,
    radius * 1.15,
  )
  gradient.addColorStop(0, '#b5b0a8')
  gradient.addColorStop(1, '#4a453e')
  ctx.fillStyle = gradient
  ctx.fill()

  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  const craters: [number, number, number][] = [
    [0.3, -0.2, 0.18],
    [-0.35, 0.3, 0.14],
    [0.05, 0.45, 0.1],
  ]
  for (const [ox, oy, craterRadius] of craters) {
    ctx.beginPath()
    ctx.arc(x + ox * radius, y + oy * radius, craterRadius * radius, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawPlanet(ctx: CanvasRenderingContext2D, body: { x: number; y: number; radius: number }) {
  const { x, y, radius } = body
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.clip()
  const gradient = ctx.createRadialGradient(
    x - radius * 0.35,
    y - radius * 0.35,
    radius * 0.1,
    x,
    y,
    radius * 1.1,
  )
  gradient.addColorStop(0, '#a8d1f0')
  gradient.addColorStop(0.6, '#5b9bd5')
  gradient.addColorStop(1, '#2c5a85')
  ctx.fillStyle = gradient
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  // surface bands
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fillRect(x - radius, y - radius * 0.6, radius * 2, radius * 0.25)
  ctx.fillRect(x - radius, y + radius * 0.1, radius * 2, radius * 0.18)
  ctx.fillStyle = 'rgba(0,0,0,0.15)'
  ctx.fillRect(x - radius, y - radius * 0.15, radius * 2, radius * 0.2)
  ctx.restore()
  // ring
  ctx.strokeStyle = 'rgba(230,220,200,0.8)'
  ctx.lineWidth = Math.max(2, radius * 0.1)
  ctx.beginPath()
  ctx.ellipse(x, y + radius * 0.1, radius * 1.5, radius * 0.32, 0, 0, Math.PI * 2)
  ctx.stroke()
}

function drawStar(ctx: CanvasRenderingContext2D, body: { x: number; y: number; radius: number }) {
  const { x, y, radius } = body
  ctx.shadowColor = '#ffb347'
  ctx.shadowBlur = 30
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    ctx.strokeStyle = 'rgba(255,200,100,0.5)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x + Math.cos(a) * radius * 1.05, y + Math.sin(a) * radius * 1.05)
    ctx.lineTo(x + Math.cos(a) * radius * 1.4, y + Math.sin(a) * radius * 1.4)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  const gradient = ctx.createRadialGradient(
    x - radius * 0.3,
    y - radius * 0.3,
    radius * 0.1,
    x,
    y,
    radius * 1.1,
  )
  gradient.addColorStop(0, '#fff8e1')
  gradient.addColorStop(0.5, '#ffcc66')
  gradient.addColorStop(1, '#ff8c00')
  ctx.fillStyle = gradient
  ctx.fill()
  ctx.shadowBlur = 0
}

function GravityWell() {
  const [levelIndex, setLevelIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('aiming')
  const [angle, setAngle] = useState(DEFAULT_ANGLE)
  const [power, setPower] = useState(DEFAULT_POWER)
  const [showPreview, setShowPreview] = useState(true)
  // Best score recorded per level so far (null = not yet landed there).
  // Retrying an already-passed level can only ever improve this -- a worse
  // attempt just doesn't overwrite the kept best.
  const [levelScores, setLevelScores] = useState<(LevelScore | null)[]>(() =>
    LEVELS.map(() => null),
  )
  const [lastResult, setLastResult] = useState<LevelScore | null>(null)
  const [isNewBest, setIsNewBest] = useState(false)

  const totalScore = levelScores.reduce((sum, s) => sum + (s?.total ?? 0), 0)

  const level = LEVELS[levelIndex]
  const finished = levelIndex >= LEVELS.length
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rocketRef = useRef<RocketState>({ pos: level?.rocketStart ?? { x: 0, y: 0 }, vel: { x: 0, y: 0 } })
  const trailRef = useRef<Vec2[]>([])
  const rafRef = useRef<number | null>(null)
  // Closest surface distance the rocket ever got to each of the level's
  // bodies during the current flight, used to score "gravity well escaped"
  // bonuses -- the nearer you skim to a crash without actually crashing,
  // the bigger the bonus for that body.
  const closestApproachRef = useRef<number[]>([])
  const stars = useMemo(
    () => (level ? makeStars(level.bounds.width, level.bounds.height, 80) : []),
    [levelIndex],
  )

  const preview = useMemo(() => {
    if (!level || !showPreview || phase !== 'aiming') return null
    const vel = velocityFromAngle(angle, power)
    return simulateTrajectory(level.rocketStart, vel, level.bodies, level.earth, level.bounds, 4)
  }, [level, showPreview, phase, angle, power])

  function draw() {
    const canvas = canvasRef.current
    if (!canvas || !level) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#05070f'
    ctx.fillRect(0, 0, level.bounds.width, level.bounds.height)

    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    for (const s of stars) ctx.fillRect(s.x, s.y, 1.5, 1.5)

    // Earth (target)
    ctx.beginPath()
    ctx.arc(level.earth.x, level.earth.y, level.earth.radius, 0, Math.PI * 2)
    ctx.fillStyle = '#4ade80'
    ctx.fill()
    ctx.strokeStyle = '#bbf7d0'
    ctx.lineWidth = 2
    ctx.stroke()

    // Bodies
    for (const body of level.bodies) {
      if (body.kind === 'asteroid') drawAsteroid(ctx, body)
      else if (body.kind === 'planet') drawPlanet(ctx, body)
      else drawStar(ctx, body)
    }

    // Trajectory preview
    if (preview) {
      ctx.setLineDash([5, 6])
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.8)'
      ctx.lineWidth = 2
      ctx.beginPath()
      preview.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Flight trail
    if (trailRef.current.length > 1) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.lineWidth = 2
      ctx.beginPath()
      trailRef.current.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
      ctx.stroke()
    }

    // Rocket
    const pos = phase === 'aiming' ? level.rocketStart : rocketRef.current.pos
    const heading =
      phase === 'aiming'
        ? (angle * Math.PI) / 180
        : Math.atan2(rocketRef.current.vel.y, rocketRef.current.vel.x) + Math.PI / 2
    ctx.save()
    ctx.translate(pos.x, pos.y)
    ctx.rotate(heading)
    ctx.scale(0.55, 0.55)
    const bodyColor = phase === 'crashed' ? '#f87171' : '#e5e7eb'
    // flame
    ctx.beginPath()
    ctx.moveTo(-4, 14)
    ctx.lineTo(0, 22)
    ctx.lineTo(4, 14)
    ctx.closePath()
    ctx.fillStyle = '#fbbf24'
    ctx.fill()
    // fins
    ctx.beginPath()
    ctx.moveTo(-6, 8)
    ctx.lineTo(-11, 16)
    ctx.lineTo(-4, 12)
    ctx.closePath()
    ctx.moveTo(6, 8)
    ctx.lineTo(11, 16)
    ctx.lineTo(4, 12)
    ctx.closePath()
    ctx.fillStyle = '#dc2626'
    ctx.fill()
    // body
    ctx.beginPath()
    ctx.moveTo(0, -18)
    ctx.quadraticCurveTo(7, -8, 6, 8)
    ctx.lineTo(-6, 8)
    ctx.quadraticCurveTo(-7, -8, 0, -18)
    ctx.closePath()
    ctx.fillStyle = bodyColor
    ctx.fill()
    ctx.strokeStyle = '#9ca3af'
    ctx.lineWidth = 0.7
    ctx.stroke()
    // window
    ctx.beginPath()
    ctx.arc(0, -3, 2.6, 0, Math.PI * 2)
    ctx.fillStyle = '#60a5fa'
    ctx.fill()
    ctx.restore()

    // Aim indicator
    if (phase === 'aiming') {
      const dir = velocityFromAngle(angle, 1)
      ctx.strokeStyle = 'rgba(229,231,235,0.5)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
      ctx.lineTo(pos.x + dir.x * 40, pos.y + dir.y * 40)
      ctx.stroke()
    }
  }

  // The animation loop started in launch() captures whichever `draw`
  // closure existed at the moment Launch was clicked -- still the
  // 'aiming'-phase version, since React hasn't committed the 'flying'
  // state yet at that point. Without this ref, every frame of the flight
  // would keep drawing the rocket at its stale aiming-phase position (the
  // trail still updates fine since it only reads the ever-current
  // trailRef). Routing every draw call through a ref that's reassigned
  // after each render guarantees the loop always runs the latest closure.
  const drawRef = useRef(draw)
  useEffect(() => {
    drawRef.current = draw
    draw()
  })

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Keyboard aiming: A/D adjust angle, W/S adjust power. Only while aiming
  // -- the sliders are disabled at other times, so this mirrors that.
  useEffect(() => {
    if (phase !== 'aiming') return
    function onKeyDown(e: KeyboardEvent) {
      switch (e.key.toLowerCase()) {
        case 'a':
          setAngle((a) => (a - ANGLE_STEP + (ANGLE_MAX + 1)) % (ANGLE_MAX + 1))
          break
        case 'd':
          setAngle((a) => (a + ANGLE_STEP) % (ANGLE_MAX + 1))
          break
        case 'w':
          setPower((p) => Math.min(POWER_MAX, p + POWER_STEP))
          break
        case 's':
          setPower((p) => Math.max(POWER_MIN, p - POWER_STEP))
          break
        default:
          return
      }
      e.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase])

  function resetAim() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    trailRef.current = []
    if (level) rocketRef.current = { pos: level.rocketStart, vel: { x: 0, y: 0 } }
    setPhase('aiming')
  }

  function launch() {
    if (!level || phase !== 'aiming') return
    const vel = velocityFromAngle(angle, power)
    rocketRef.current = { pos: { ...level.rocketStart }, vel }
    trailRef.current = [{ ...level.rocketStart }]
    closestApproachRef.current = level.bodies.map(() => Infinity)
    setPhase('flying')

    function frame() {
      for (let i = 0; i < TICKS_PER_FRAME; i++) {
        rocketRef.current = stepRocket(rocketRef.current, level.bodies, TICK_DT)
        trailRef.current.push(rocketRef.current.pos)
        level.bodies.forEach((body, bi) => {
          const d = surfaceDistance(rocketRef.current.pos, body)
          if (d < closestApproachRef.current[bi]) closestApproachRef.current[bi] = d
        })
        const outcome = checkOutcome(rocketRef.current.pos, level.bodies, level.earth, level.bounds)
        if (outcome !== 'flying') {
          drawRef.current()
          if (outcome === 'hit-earth') {
            const result = scoreLanding(level.bodies, closestApproachRef.current)
            const existingBest = levelScores[levelIndex]
            const newBest = !existingBest || result.total > existingBest.total
            setLastResult(result)
            setIsNewBest(newBest)
            if (newBest) {
              setLevelScores((prev) => {
                const next = [...prev]
                next[levelIndex] = result
                return next
              })
            }
            setPhase('won')
          } else {
            setPhase('crashed')
            setTimeout(resetAim, CRASH_PAUSE_MS)
          }
          return
        }
      }
      drawRef.current()
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
  }

  function nextLevel() {
    setLevelIndex((i) => i + 1)
    setAngle(DEFAULT_ANGLE)
    setPower(DEFAULT_POWER)
    trailRef.current = []
    setLastResult(null)
    setPhase('aiming')
  }

  // Replay the level just won, for a shot at a better score -- keeps the
  // best score already recorded for it (only a strictly better attempt
  // will ever replace it) and keeps the current angle/power so small
  // adjustments are easy, rather than resetting to the defaults.
  function retryLevel() {
    if (level) rocketRef.current = { pos: level.rocketStart, vel: { x: 0, y: 0 } }
    trailRef.current = []
    setLastResult(null)
    setPhase('aiming')
  }

  function restart() {
    setLevelIndex(0)
    setAngle(DEFAULT_ANGLE)
    setPower(DEFAULT_POWER)
    trailRef.current = []
    setLastResult(null)
    setLevelScores(LEVELS.map(() => null))
    setPhase('aiming')
  }

  return (
    <div className="gravity-well">
      <img src="/GravityWell.jpeg" alt="Gravity Well" className="banner" />
      <h1>Gravity Well</h1>
      <p>
        Aim your rocket home to Earth. Asteroids nudge your path, planets bend it more,
        and stars bend it a lot — use their gravity, don't just fight it.
      </p>

      {finished ? (
        <div className="results">
          <p className="score">🎉 You made it home through all {LEVELS.length} levels!</p>
          <p className="stat-line">Final score: {totalScore}</p>
          <button type="button" onClick={restart}>Play Again</button>
        </div>
      ) : (
        <>
          <p className="progress">
            Level {levelIndex + 1} of {LEVELS.length} — {level.name}
            <span className="score-badge">Score: {totalScore}</span>
          </p>

          <canvas
            ref={canvasRef}
            width={level.bounds.width}
            height={level.bounds.height}
            className="gw-canvas"
          />

          {phase === 'won' && lastResult && (
            <div className="win">
              <div className="win-summary">
                <span className="win-headline">
                  🎉 Landed safely! +{lastResult.total}
                  {isNewBest && <span className="new-best"> New best!</span>}
                </span>
                <span className="win-breakdown">
                  {lastResult.landingScore} for landing
                  {lastResult.bonuses.map((b, i) => (
                    <span key={i}> · {b.label} +{b.points}</span>
                  ))}
                  {!isNewBest && <> · best for this level: {levelScores[levelIndex]?.total}</>}
                </span>
              </div>
              <div className="win-buttons">
                <button type="button" onClick={retryLevel}>
                  Retry for a Better Score
                </button>
                <button type="button" onClick={nextLevel}>
                  {levelIndex + 1 === LEVELS.length ? 'Finish' : 'Next Level'}
                </button>
              </div>
            </div>
          )}
          {phase === 'crashed' && <div className="feedback bad">💥 Lost contact — resetting…</div>}

          <p className="keyboard-hint">Keyboard: A/D aim, W/S power</p>

          <div className="controls">
            <label className="control">
              <span>Angle: {angle}°</span>
              <input
                type="range"
                min={ANGLE_MIN}
                max={ANGLE_MAX}
                value={angle}
                disabled={phase !== 'aiming'}
                onChange={(e) => setAngle(Number(e.target.value))}
              />
            </label>
            <label className="control">
              <span>Power: {power}</span>
              <input
                type="range"
                min={POWER_MIN}
                max={POWER_MAX}
                value={power}
                disabled={phase !== 'aiming'}
                onChange={(e) => setPower(Number(e.target.value))}
              />
            </label>
            <label className="control checkbox">
              <input
                type="checkbox"
                checked={showPreview}
                onChange={(e) => setShowPreview(e.target.checked)}
              />
              <span>Show trajectory preview</span>
            </label>
            <button
              type="button"
              className="launch-button"
              onClick={launch}
              disabled={phase !== 'aiming'}
            >
              Launch
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default GravityWell
