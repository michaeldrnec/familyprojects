import { useEffect, useRef, useState } from 'react'
import {
  BEAM_HALF_ANGLE,
  BEAM_RANGE,
  MAX_TICKS,
  TICK_DT,
  checkOutcome,
  effectivePosition,
  simulateTrajectory,
  stepRocket,
  surfaceDistance,
  velocityFromAngle,
  type Alien,
  type Body,
  type RocketState,
  type Vec2,
} from './physics'
import { TIERS } from './levels'
import { generateSolvableLevel, type Level } from './levelGen'
import { scoreLanding, type LevelScore } from './scoring'
import './GravityWell.css'

// Playback runs faster than real-time (a full simulated flight can be many
// seconds of sim-time) so retries stay snappy rather than making the
// player wait out a slow, realistic-speed flight every attempt.
const TICKS_PER_FRAME = 6
const CRASH_PAUSE_MS = 900
// Same cap simulateTrajectory uses -- a safety net so a flight can't run
// forever if something (most plausibly the alien's tractor beam) drains the
// rocket's velocity to a near-standstill with nothing else around to
// perturb it back out.
const MAX_FLIGHT_SECONDS = MAX_TICKS * TICK_DT
const DEFAULT_ANGLE = 45
const DEFAULT_POWER = 150
const ANGLE_MAX = 359
const ANGLE_STEP = 3
const POWER_MIN = 40
const POWER_MAX = 420
const POWER_STEP = 10

// Drag-to-launch tuning: how far (in canvas px) a full-power pull needs to
// travel, and the minimum pull distance that counts as an intentional shot
// rather than an accidental tap.
const DRAG_MAX_PX = 260
const MIN_DRAG_PX = 30

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

// A deterministic per-body "random" seed, from the body's spawn point, so
// each asteroid's jagged shape and craters stay stable across redraws (and
// while it orbits) instead of flickering or reshaping as it moves.
function bodySeed(body: { x: number; y: number }): number {
  return body.x * 0.13 + body.y * 0.7
}

function drawAsteroid(
  ctx: CanvasRenderingContext2D,
  pos: { x: number; y: number; radius: number },
  seed: number,
) {
  const { x, y, radius } = pos
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

function drawPlanet(ctx: CanvasRenderingContext2D, pos: { x: number; y: number; radius: number }) {
  const { x, y, radius } = pos
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

function drawStar(ctx: CanvasRenderingContext2D, pos: { x: number; y: number; radius: number }) {
  const { x, y, radius } = pos
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

// Earth is the one fixed, always-present body every level shares, so unlike
// the procedurally varied asteroids/planets/stars it's drawn with a single
// hand-designed look (oceans, continents, ice caps, clouds) rather than a
// seeded/randomized one -- it should always be recognizably "home."
function drawEarth(ctx: CanvasRenderingContext2D, earth: { x: number; y: number; radius: number }) {
  const { x, y, radius } = earth

  function blob(cx: number, cy: number, scale: number, rot: number) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(rot)
    ctx.beginPath()
    ctx.moveTo(-0.5 * scale, 0)
    ctx.bezierCurveTo(-0.5 * scale, -0.6 * scale, 0.3 * scale, -0.7 * scale, 0.6 * scale, -0.2 * scale)
    ctx.bezierCurveTo(0.8 * scale, 0.1 * scale, 0.4 * scale, 0.6 * scale, -0.1 * scale, 0.5 * scale)
    ctx.bezierCurveTo(-0.5 * scale, 0.4 * scale, -0.6 * scale, 0.3 * scale, -0.5 * scale, 0)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  // Soft atmospheric glow behind the sphere.
  ctx.save()
  ctx.shadowColor = 'rgba(96,165,250,0.65)'
  ctx.shadowBlur = radius * 0.9
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = '#1b3f73'
  ctx.fill()
  ctx.restore()

  // Ocean base, lit from the upper-left like the other bodies.
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  const ocean = ctx.createRadialGradient(
    x - radius * 0.35,
    y - radius * 0.35,
    radius * 0.1,
    x,
    y,
    radius * 1.05,
  )
  ocean.addColorStop(0, '#8ec9f0')
  ocean.addColorStop(0.45, '#3d7dc9')
  ocean.addColorStop(1, '#1b3f73')
  ctx.fillStyle = ocean
  ctx.fill()

  // Continents, ice caps, and clouds, clipped to the sphere.
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.clip()

  ctx.fillStyle = '#4b8f3e'
  blob(x - radius * 0.25, y - radius * 0.15, radius * 0.9, 0.3)
  blob(x + radius * 0.4, y + radius * 0.25, radius * 0.55, -0.6)
  blob(x - radius * 0.1, y + radius * 0.55, radius * 0.4, 1.1)
  ctx.fillStyle = '#3a7030'
  blob(x - radius * 0.35, y - radius * 0.1, radius * 0.35, 0.9)

  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.beginPath()
  ctx.ellipse(x, y - radius * 0.88, radius * 0.55, radius * 0.25, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(x, y + radius * 0.88, radius * 0.5, radius * 0.22, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ;[
    [x + radius * 0.1, y - radius * 0.3, radius * 0.5, radius * 0.14, 0.4],
    [x - radius * 0.45, y + radius * 0.1, radius * 0.4, radius * 0.11, -0.3],
    [x + radius * 0.3, y + radius * 0.45, radius * 0.35, radius * 0.09, 0.8],
  ].forEach(([cx, cy, w, h, rot]) => {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(rot)
    ctx.beginPath()
    ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  })
  ctx.restore()

  // Thin atmosphere rim.
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(147,197,253,0.7)'
  ctx.lineWidth = Math.max(1.5, radius * 0.08)
  ctx.stroke()
}

function drawBody(ctx: CanvasRenderingContext2D, body: Body, t: number) {
  const p = effectivePosition(body, t)
  const renderPos = { x: p.x, y: p.y, radius: body.radius }
  if (body.kind === 'asteroid') drawAsteroid(ctx, renderPos, bodySeed(body))
  else if (body.kind === 'planet') drawPlanet(ctx, renderPos)
  else drawStar(ctx, renderPos)
}

// The funnel is drawn straight from BEAM_RANGE/BEAM_HALF_ANGLE -- the exact
// constants the physics uses -- so the visible danger zone never lies about
// where the drag actually applies.
function drawAlien(ctx: CanvasRenderingContext2D, alien: Alien) {
  const { x, y, beamAngle } = alien

  // Funnel: a pie-slice from the ship out to BEAM_RANGE, brightest near the
  // source and fading to nothing at the rim.
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.arc(x, y, BEAM_RANGE, beamAngle - BEAM_HALF_ANGLE, beamAngle + BEAM_HALF_ANGLE)
  ctx.closePath()
  const beamGradient = ctx.createRadialGradient(x, y, 0, x, y, BEAM_RANGE)
  beamGradient.addColorStop(0, 'rgba(163,230,53,0.55)')
  beamGradient.addColorStop(0.5, 'rgba(163,230,53,0.22)')
  beamGradient.addColorStop(1, 'rgba(163,230,53,0)')
  ctx.fillStyle = beamGradient
  ctx.fill()

  // Ship: a small saucer with a dome and running lights, facing the beam.
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(beamAngle)

  ctx.beginPath()
  ctx.ellipse(0, 0, 15, 6, 0, 0, Math.PI * 2)
  const hullGradient = ctx.createLinearGradient(0, -6, 0, 6)
  hullGradient.addColorStop(0, '#a1a8b3')
  hullGradient.addColorStop(1, '#4b5563')
  ctx.fillStyle = hullGradient
  ctx.fill()
  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(0, -2, 7, Math.PI, Math.PI * 2)
  ctx.fillStyle = 'rgba(163,230,53,0.9)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(190,242,100,0.9)'
  ctx.stroke()

  ctx.fillStyle = '#fde047'
  for (const lx of [-9, 0, 9]) {
    ctx.beginPath()
    ctx.arc(lx, 3, 1.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function GravityWell() {
  const [levelIndex, setLevelIndex] = useState(0)
  const [runSeed, setRunSeed] = useState(() => Math.floor(Math.random() * 1_000_000_000))
  const [level, setLevel] = useState<Level | null>(null)
  const [phase, setPhase] = useState<Phase>('aiming')
  const [angle, setAngle] = useState(DEFAULT_ANGLE)
  const [power, setPower] = useState(DEFAULT_POWER)
  const [showPreview, setShowPreview] = useState(true)
  // Best score recorded per level so far (null = not yet landed). Retrying
  // an already-passed level can only ever improve this -- a worse attempt
  // just doesn't overwrite the kept best.
  const [levelScores, setLevelScores] = useState<(LevelScore | null)[]>(() =>
    TIERS.map(() => null),
  )
  const [lastResult, setLastResult] = useState<LevelScore | null>(null)
  const [isNewBest, setIsNewBest] = useState(false)
  // The canvas's actual on-screen width (it's height-constrained and
  // centered, so it's rarely the full page width) -- tracked so the
  // progress row above it can match that width and right-align flush with
  // the canvas's real right edge instead of the far edge of the page.
  const [canvasWidth, setCanvasWidth] = useState<number | null>(null)

  const totalScore = levelScores.reduce((sum, s) => sum + (s?.total ?? 0), 0)
  const finished = levelIndex >= TIERS.length

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rocketRef = useRef<RocketState>({ pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } })
  const trailRef = useRef<Vec2[]>([])
  const rafRef = useRef<number | null>(null)
  // Closest surface distance the rocket ever got to each of the level's
  // bodies during the current flight, used to score "gravity well escaped"
  // bonuses -- the nearer you skim to a crash without actually crashing,
  // the bigger the bonus for that body.
  const closestApproachRef = useRef<number[]>([])
  // Every generated layout is cached per (run, tier) so retrying a level
  // reuses the exact same layout -- a fresh one only appears on the next
  // full run or the first time a tier is reached.
  const levelCacheRef = useRef<Map<string, Level>>(new Map())
  const starsRef = useRef<Vec2[]>([])
  // A free-running clock (seconds) that keeps advancing whether the player
  // is aiming, flying, or watching a crash -- this is what makes orbiting
  // bodies visibly drift during aiming, not just mid-flight.
  const worldTimeRef = useRef(0)
  // The time value actually used to render body positions right now: tied
  // to worldTimeRef while aiming/idle, but driven by the flight loop's own
  // elapsed-since-launch clock while flying, so a flight's physics and its
  // rendering never disagree about where a mover is.
  const clockRef = useRef(0)
  const phaseRef = useRef<Phase>('aiming')
  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  const isDraggingRef = useRef(false)
  const dragPointRef = useRef<Vec2 | null>(null)
  const dragStartPointRef = useRef<Vec2 | null>(null)

  // Generate (or reuse a cached) layout whenever the tier or run changes.
  // Generation runs a real solvability search, so it's deferred a tick
  // behind a "Generating level..." state rather than blocking the render
  // that shows that state.
  useEffect(() => {
    if (finished) return
    const tier = TIERS[levelIndex]
    const cacheKey = `${runSeed}:${levelIndex}`
    const cached = levelCacheRef.current.get(cacheKey)
    if (cached) {
      applyNewLevel(cached)
      return
    }
    setLevel(null)
    const timer = window.setTimeout(() => {
      const generated = generateSolvableLevel(tier, runSeed + levelIndex * 7919)
      levelCacheRef.current.set(cacheKey, generated)
      applyNewLevel(generated)
    }, 20)
    return () => window.clearTimeout(timer)

    function applyNewLevel(lvl: Level) {
      rocketRef.current = { pos: { ...lvl.rocketStart }, vel: { x: 0, y: 0 } }
      trailRef.current = []
      starsRef.current = makeStars(lvl.bounds.width, lvl.bounds.height, 80)
      setPhase('aiming')
      setLevel(lvl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelIndex, runSeed, finished])

  function draw() {
    const canvas = canvasRef.current
    if (!canvas || !level) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const t = clockRef.current

    ctx.fillStyle = '#05070f'
    ctx.fillRect(0, 0, level.bounds.width, level.bounds.height)

    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    for (const s of starsRef.current) ctx.fillRect(s.x, s.y, 1.5, 1.5)

    // Earth (target)
    drawEarth(ctx, level.earth)

    // Bodies (at their current, possibly orbiting, position)
    for (const body of level.bodies) drawBody(ctx, body, t)

    if (level.alien) drawAlien(ctx, level.alien)

    // Trajectory preview -- recomputed every frame off the current angle,
    // power, and the bodies' current orbital phase, so it never lies about
    // "if I launched right now."
    if (phase === 'aiming' && showPreview) {
      const vel = velocityFromAngle(angle, power)
      const preview = simulateTrajectory(
        level.rocketStart,
        vel,
        level.bodies,
        level.earth,
        level.bounds,
        4,
        t,
        undefined,
        level.alien,
      )
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

    // Slingshot rubber-band while dragging
    if (phase === 'aiming' && isDraggingRef.current && dragPointRef.current) {
      ctx.setLineDash([3, 5])
      ctx.strokeStyle = 'rgba(248,113,113,0.85)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(level.rocketStart.x, level.rocketStart.y)
      ctx.lineTo(dragPointRef.current.x, dragPointRef.current.y)
      ctx.stroke()
      ctx.setLineDash([])
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

  // Always-running clock/redraw loop -- independent of the flight loop --
  // so orbiting bodies visibly drift while the player is still aiming (or
  // watching a crash/win screen), not just during an active flight.
  useEffect(() => {
    let raf: number
    let last = performance.now()
    function tick(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      worldTimeRef.current += dt
      if (phaseRef.current !== 'flying') clockRef.current = worldTimeRef.current
      drawRef.current()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Track the canvas's real rendered width (it's height-constrained and
  // centered within `.game-area`, so it's usually narrower than the page)
  // so the progress row above it can be sized to match, keeping the score
  // flush with the canvas's actual right edge at any viewport size.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) setCanvasWidth(width)
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [level])

  // Keyboard aiming: A/D adjust angle, W/S adjust power -- a precise
  // fallback alongside the drag-to-launch control. Only while aiming.
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

  function canvasPoint(e: { clientX: number; clientY: number }): Vec2 {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  function updateDrag(point: Vec2) {
    dragPointRef.current = point
    if (!level) return
    const dx = level.rocketStart.x - point.x
    const dy = level.rocketStart.y - point.y
    const dist = Math.hypot(dx, dy)
    if (dist < 4) return
    const angleDeg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
    const pull = Math.min(dist, DRAG_MAX_PX)
    const nextPower = POWER_MIN + (pull / DRAG_MAX_PX) * (POWER_MAX - POWER_MIN)
    setAngle(Math.round(angleDeg))
    setPower(Math.round(nextPower))
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!level || phase !== 'aiming') return
    e.currentTarget.setPointerCapture(e.pointerId)
    isDraggingRef.current = true
    dragStartPointRef.current = canvasPoint(e)
    updateDrag(canvasPoint(e))
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDraggingRef.current) return
    updateDrag(canvasPoint(e))
  }

  function handlePointerUp() {
    if (!isDraggingRef.current) return
    const point = dragPointRef.current
    const startPoint = dragStartPointRef.current
    isDraggingRef.current = false
    dragPointRef.current = null
    dragStartPointRef.current = null
    if (!level || !point || !startPoint) return
    // Require the pointer to have actually travelled -- not just to have
    // landed far from the rocket -- so a plain click/tap anywhere on the
    // canvas doesn't accidentally fire a shot with no real drag gesture.
    const travelled = Math.hypot(point.x - startPoint.x, point.y - startPoint.y)
    if (travelled >= MIN_DRAG_PX) launch()
  }

  function resetAim() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    trailRef.current = []
    if (level) rocketRef.current = { pos: { ...level.rocketStart }, vel: { x: 0, y: 0 } }
    setPhase('aiming')
  }

  function launch() {
    if (!level || phase !== 'aiming') return
    const activeLevel = level
    const vel = velocityFromAngle(angle, power)
    const startWorldTime = worldTimeRef.current
    rocketRef.current = { pos: { ...activeLevel.rocketStart }, vel }
    trailRef.current = [{ ...activeLevel.rocketStart }]
    closestApproachRef.current = activeLevel.bodies.map(() => Infinity)
    let flightElapsed = 0
    setPhase('flying')

    function frame() {
      for (let i = 0; i < TICKS_PER_FRAME; i++) {
        flightElapsed += TICK_DT
        const t = startWorldTime + flightElapsed
        rocketRef.current = stepRocket(rocketRef.current, activeLevel.bodies, TICK_DT, t, activeLevel.alien)
        clockRef.current = t
        trailRef.current.push(rocketRef.current.pos)
        activeLevel.bodies.forEach((body, bi) => {
          const d = surfaceDistance(rocketRef.current.pos, body, t)
          if (d < closestApproachRef.current[bi]) closestApproachRef.current[bi] = d
        })
        const outcome = checkOutcome(rocketRef.current.pos, activeLevel.bodies, activeLevel.earth, activeLevel.bounds, t)
        const strandedTimeout = flightElapsed >= MAX_FLIGHT_SECONDS
        if (outcome !== 'flying' || strandedTimeout) {
          drawRef.current()
          if (outcome === 'hit-earth') {
            const result = scoreLanding(activeLevel.bodies, closestApproachRef.current)
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
    setLastResult(null)
  }

  // Replay the level just won, for a shot at a better score -- keeps the
  // best score already recorded for it (only a strictly better attempt
  // will ever replace it), keeps the current angle/power, and reuses the
  // exact same generated layout (see the level-cache effect above).
  function retryLevel() {
    if (level) rocketRef.current = { pos: { ...level.rocketStart }, vel: { x: 0, y: 0 } }
    trailRef.current = []
    setLastResult(null)
    setPhase('aiming')
  }

  function restart() {
    setLevelIndex(0)
    setRunSeed(Math.floor(Math.random() * 1_000_000_000))
    setAngle(DEFAULT_ANGLE)
    setPower(DEFAULT_POWER)
    setLastResult(null)
    setLevelScores(TIERS.map(() => null))
    levelCacheRef.current.clear()
  }

  return (
    <div className="gravity-well fullscreen">
      {finished ? (
        <div className="results">
          <p className="score">🎉 You made it home through all {TIERS.length} levels!</p>
          <p className="stat-line">Final score: {totalScore}</p>
          <button type="button" onClick={restart}>Play Again</button>
        </div>
      ) : (
        <>
          <div className="progress" style={canvasWidth ? { width: canvasWidth } : undefined}>
            <span className="score-badge">Score: {totalScore}</span>
            <span className="level-badge">Level {levelIndex + 1} of {TIERS.length}</span>
          </div>

          {!level ? (
            <div className="generating">Generating level…</div>
          ) : (
            <>
              <div className="game-area">
                <canvas
                  ref={canvasRef}
                  width={level.bounds.width}
                  height={level.bounds.height}
                  className={'gw-canvas' + (phase === 'aiming' ? ' aimable' : '')}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                />

                {/* Overlaid on the canvas (not stacked below it) so winning
                    or crashing never changes the canvas's own size -- it
                    used to sit below as a sibling, and its appearing /
                    disappearing shifted how much flex space the canvas got. */}
                {phase === 'won' && lastResult && (
                  <div className="win overlay">
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
                        {levelIndex + 1 === TIERS.length ? 'Finish' : 'Next Level'}
                      </button>
                    </div>
                  </div>
                )}
                {phase === 'crashed' && (
                  <div className="feedback bad overlay">💥 Lost contact — resetting…</div>
                )}
              </div>

              <p className="keyboard-hint">
                Drag on the canvas like a slingshot to aim &amp; launch — or use A/D/W/S then Launch.
              </p>

              <div className="controls">
                <div className="control readout">
                  <span>Angle: {angle}°</span>
                  <span>Power: {power}</span>
                </div>
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
        </>
      )}
    </div>
  )
}

export default GravityWell
