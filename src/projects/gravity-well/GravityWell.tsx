import { useEffect, useRef, useState } from 'react'
import {
  BEAM_HALF_ANGLE,
  BEAM_RANGE,
  MAX_TICKS,
  STARDUST_RADIUS,
  TICK_DT,
  checkOutcome,
  distance,
  effectivePosition,
  simulateTrajectory,
  stepRocket,
  surfaceDistance,
  touchesStardust,
  velocityFromAngle,
  type Alien,
  type Body,
  type RocketState,
  type Vec2,
} from './physics'
import { TIERS } from './levels'
import { generateSolvableLevel, type Level } from './levelGen'
import { LAUNCHES_PER_LEVEL, scoreLanding, type LevelScore } from './scoring'
import { loadProgress, runTotal, saveRun, type SavedScore } from './progress'
import * as audio from './audio'
import { logicalPoint, scaledContext, useHiDpiCanvas } from '../../shared/hiDpiCanvas'
import { useMuted } from '../../shared/audio'
import { prefersReducedMotion } from '../../shared/motion'
import './GravityWell.css'

// Playback runs a bit faster than real-time (a typical landing is about 3s
// of sim-time, so ~2s on screen): snappy enough for retries, slow enough to
// time a mid-flight boost. Time-based, so a 120Hz screen doesn't play
// flights twice as fast.
const PLAYBACK_SPEED = 1.5
const TICKS_PER_SECOND = PLAYBACK_SPEED / TICK_DT
const CRASH_PAUSE_MS = 900
const OUT_OF_LAUNCHES_PAUSE_MS = 1800
// The aiming preview shows only the start of the path -- how the shot
// leaves the pad and begins to bend -- never the whole route, and it always
// stops well short of Earth, so the player still has to read the gravity.
const PREVIEW_LENGTH = 180
const PREVIEW_EARTH_CLEARANCE = 70
// The once-per-flight boost: a short push along the direction of travel.
const BOOST_ACCEL = 260 // px/s^2
const BOOST_SECONDS = 0.4 // sim-time
// Speed (px/s) at which the engine sound is at its loudest and brightest.
const ENGINE_FULL_SPEED = 450
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

interface Boost {
  used: boolean
  remaining: number // sim-seconds of thrust left while burning
}

const newSeed = () => Math.floor(Math.random() * 1_000_000_000)

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

// A four-pointed sparkle for an uncollected bit of stardust (a faint ring
// once collected), gently twinkling unless the player prefers less motion.
function drawStardust(ctx: CanvasRenderingContext2D, pos: Vec2, collected: boolean, t: number, still: boolean) {
  ctx.save()
  ctx.translate(pos.x, pos.y)
  if (collected) {
    ctx.strokeStyle = 'rgba(253, 230, 138, 0.25)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(0, 0, STARDUST_RADIUS * 0.6, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    return
  }
  const twinkle = still ? 1 : 0.85 + 0.15 * Math.sin(t * 5 + pos.x)
  const r = STARDUST_RADIUS * twinkle
  ctx.shadowColor = 'rgba(253, 224, 71, 0.9)'
  ctx.shadowBlur = 12
  ctx.fillStyle = '#fde68a'
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2
    const len = i % 2 === 0 ? r : r * 0.35
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function GravityWell() {
  // The saved run (if any) is resumed exactly: same seed, level, layout and
  // launches used, so reloading the page is never a way to refill launches.
  const [saved] = useState(() => loadProgress())
  const [levelIndex, setLevelIndex] = useState(saved.run?.levelIndex ?? 0)
  const [runSeed, setRunSeed] = useState(() => saved.run?.seed ?? newSeed())
  // A run saved just after its final launch crashed resumes on the fresh
  // layout it was about to get.
  const [resumedOut] = useState(() => (saved.run?.launchesUsed ?? 0) >= LAUNCHES_PER_LEVEL)
  const [layout, setLayout] = useState((saved.run?.layout ?? 0) + (resumedOut ? 1 : 0))
  const [launchesUsed, setLaunchesUsed] = useState(resumedOut ? 0 : (saved.run?.launchesUsed ?? 0))
  const [bestTotal, setBestTotal] = useState(saved.bestTotal)
  const [level, setLevel] = useState<Level | null>(null)
  const [phase, setPhase] = useState<Phase>('aiming')
  const [outOfLaunches, setOutOfLaunches] = useState(false)
  const [angle, setAngle] = useState(DEFAULT_ANGLE)
  const [power, setPower] = useState(DEFAULT_POWER)
  // Best result recorded per level so far (null = not yet landed). Retrying
  // an already-passed level can only ever improve this -- a worse attempt
  // just doesn't overwrite the kept best.
  const [levelScores, setLevelScores] = useState<(SavedScore | null)[]>(
    () => saved.run?.scores ?? TIERS.map(() => null),
  )
  const [lastResult, setLastResult] = useState<LevelScore | null>(null)
  const [isNewBest, setIsNewBest] = useState(false)
  // Re-rendered only when these change mid-flight (a pickup, the boost
  // gauge), not every frame.
  const [stardustCollected, setStardustCollected] = useState(0)
  const [boostLeft, setBoostLeft] = useState(1)
  // The canvas's actual on-screen width (it's height-constrained and
  // centered, so it's rarely the full page width) -- tracked so the
  // progress row above it can match that width and right-align flush with
  // the canvas's real right edge instead of the far edge of the page.
  const [canvasWidth, setCanvasWidth] = useState<number | null>(null)
  const [muted, toggleSiteMute] = useMuted()

  const totalScore = runTotal(levelScores)
  const totalStars = levelScores.reduce((sum, s) => sum + (s?.stars ?? 0), 0)
  const finished = levelIndex >= TIERS.length

  const canvasRef = useRef<HTMLCanvasElement>(null)
  useHiDpiCanvas(canvasRef, level?.bounds.width ?? 0, level?.bounds.height ?? 0, { capToLogical: true })
  const rocketRef = useRef<RocketState>({ pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } })
  const trailRef = useRef<Vec2[]>([])
  // The previous flight on this layout, drawn faintly while aiming so each
  // attempt can learn from the last one.
  const ghostTrailRef = useRef<Vec2[]>([])
  const collectedRef = useRef<Set<number>>(new Set())
  const boostRef = useRef<Boost>({ used: false, remaining: 0 })
  const crashTimerRef = useRef<number | null>(null)
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
    const cacheKey = `${runSeed}:${levelIndex}:${layout}`
    const cached = levelCacheRef.current.get(cacheKey)
    if (cached) {
      applyNewLevel(cached)
      return
    }
    setLevel(null)
    const timer = window.setTimeout(() => {
      const generated = generateSolvableLevel(tier, runSeed + levelIndex * 7919 + layout * 104_729)
      levelCacheRef.current.set(cacheKey, generated)
      applyNewLevel(generated)
    }, 20)
    return () => window.clearTimeout(timer)

    function applyNewLevel(lvl: Level) {
      rocketRef.current = { pos: { ...lvl.rocketStart }, vel: { x: 0, y: 0 } }
      trailRef.current = []
      ghostTrailRef.current = []
      collectedRef.current = new Set()
      setStardustCollected(0)
      starsRef.current = makeStars(lvl.bounds.width, lvl.bounds.height, 80)
      setOutOfLaunches(false)
      setPhase('aiming')
      setLevel(lvl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelIndex, runSeed, layout, finished])

  // Save the run whenever it moves on: a landing, a launch, a new layout or
  // a new level.
  useEffect(() => {
    const progress = saveRun({ seed: runSeed, levelIndex, layout, launchesUsed, scores: levelScores })
    setBestTotal(progress.bestTotal)
  }, [runSeed, levelIndex, layout, launchesUsed, levelScores])

  function draw() {
    const canvas = canvasRef.current
    if (!canvas || !level) return
    const ctx = scaledContext(canvas)
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

    const still = prefersReducedMotion()
    level.stardust.forEach((sd, i) =>
      drawStardust(ctx, sd, phase !== 'aiming' && collectedRef.current.has(i), t, still),
    )

    // The last flight on this layout, faint, so the next shot can adjust.
    if (phase === 'aiming' && ghostTrailRef.current.length > 1) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ghostTrailRef.current.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
      ctx.stroke()
    }

    // Trajectory preview -- recomputed every frame off the current angle,
    // power, and the bodies' current orbital phase, so it never lies about
    // "if I launched right now". Only the first PREVIEW_LENGTH px are shown,
    // fading out, and never the approach to Earth.
    if (phase === 'aiming') {
      const vel = velocityFromAngle(angle, power)
      const preview = simulateTrajectory(
        level.rocketStart,
        vel,
        level.bodies,
        level.earth,
        level.bounds,
        2,
        t,
        600,
        level.alien,
      )
      ctx.setLineDash([5, 6])
      ctx.lineWidth = 2
      let travelled = 0
      for (let i = 1; i < preview.points.length; i++) {
        const a = preview.points[i - 1]
        const b = preview.points[i]
        if (distance(b, level.earth) < level.earth.radius + PREVIEW_EARTH_CLEARANCE) break
        const step = distance(a, b)
        if (travelled + step > PREVIEW_LENGTH) break
        ctx.lineDashOffset = -travelled
        ctx.strokeStyle = `rgba(96, 165, 250, ${0.95 - 0.7 * (travelled / PREVIEW_LENGTH)})`
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
        travelled += step
      }
      ctx.setLineDash([])
      ctx.lineDashOffset = 0
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
    // flame -- a long, bright plume while the boost burns
    const boosting = phase === 'flying' && boostRef.current.remaining > 0
    if (boosting) {
      ctx.beginPath()
      ctx.moveTo(-6, 13)
      ctx.lineTo(0, 40 + (still ? 0 : Math.random() * 8))
      ctx.lineTo(6, 13)
      ctx.closePath()
      ctx.fillStyle = 'rgba(251, 146, 60, 0.85)'
      ctx.fill()
    }
    ctx.beginPath()
    ctx.moveTo(-4, 14)
    ctx.lineTo(0, boosting ? 28 : 22)
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
      if (crashTimerRef.current !== null) window.clearTimeout(crashTimerRef.current)
      audio.stopEngine(true)
    }
  }, [])

  // A hidden tab stops drawing frames, which freezes the flight -- so the
  // engine shouldn't keep roaring in the background.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) audio.stopEngine(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
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

  // The key handler below is bound once per phase, so it reaches launch()
  // and boost() through a ref that always holds this render's versions.
  const actionsRef = useRef({ launch, boost })
  actionsRef.current = { launch, boost }

  // Keyboard: A/D adjust angle, W/S adjust power -- a precise fallback
  // alongside the drag-to-launch control -- and Space launches, then boosts
  // mid-flight.
  useEffect(() => {
    if (phase !== 'aiming' && phase !== 'flying') return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === ' ') {
        e.preventDefault()
        if (e.repeat) return
        if (phase === 'aiming') actionsRef.current.launch()
        else actionsRef.current.boost()
        return
      }
      if (phase !== 'aiming') return
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
    if (!canvas || !level) return { x: 0, y: 0 }
    return logicalPoint(e, canvas, level.bounds.width, level.bounds.height)
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
    if (phase === 'flying') {
      boost()
      return
    }
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
    if (!level || phase !== 'aiming' || launchesUsed >= LAUNCHES_PER_LEVEL) return
    audio.init()
    audio.startEngine()
    const activeLevel = level
    const used = launchesUsed + 1
    setLaunchesUsed(used)
    const vel = velocityFromAngle(angle, power)
    const startWorldTime = worldTimeRef.current
    rocketRef.current = { pos: { ...activeLevel.rocketStart }, vel }
    trailRef.current = [{ ...activeLevel.rocketStart }]
    closestApproachRef.current = activeLevel.bodies.map(() => Infinity)
    collectedRef.current = new Set()
    setStardustCollected(0)
    boostRef.current = { used: false, remaining: 0 }
    setBoostLeft(1)
    let flightElapsed = 0
    let ticksOwed = 0
    let last = performance.now()
    setPhase('flying')

    function frame(now: number) {
      ticksOwed += (Math.min(now - last, 50) / 1000) * TICKS_PER_SECOND
      last = now
      while (ticksOwed >= 1) {
        ticksOwed -= 1
        flightElapsed += TICK_DT
        const t = startWorldTime + flightElapsed
        const boostState = boostRef.current
        const thrust = boostState.remaining > 0 ? BOOST_ACCEL : 0
        boostState.remaining = Math.max(0, boostState.remaining - TICK_DT)
        rocketRef.current = stepRocket(rocketRef.current, activeLevel.bodies, TICK_DT, t, activeLevel.alien, thrust)
        clockRef.current = t
        trailRef.current.push(rocketRef.current.pos)
        activeLevel.bodies.forEach((body, bi) => {
          const d = surfaceDistance(rocketRef.current.pos, body, t)
          if (d < closestApproachRef.current[bi]) closestApproachRef.current[bi] = d
        })
        activeLevel.stardust.forEach((sd, si) => {
          if (collectedRef.current.has(si) || !touchesStardust(rocketRef.current.pos, sd)) return
          collectedRef.current.add(si)
          setStardustCollected(collectedRef.current.size)
          audio.playStardust()
        })
        const outcome = checkOutcome(rocketRef.current.pos, activeLevel.bodies, activeLevel.earth, activeLevel.bounds, t)
        const strandedTimeout = flightElapsed >= MAX_FLIGHT_SECONDS
        if (outcome !== 'flying' || strandedTimeout) {
          ghostTrailRef.current = trailRef.current
          drawRef.current()
          if (outcome === 'hit-earth') {
            audio.stopEngine()
            audio.playWin()
            const result = scoreLanding(activeLevel.bodies, closestApproachRef.current, {
              stardustCollected: collectedRef.current.size,
              stardustTotal: activeLevel.stardust.length,
              launchesUsed: used,
            })
            const existingBest = levelScores[levelIndex]
            setLastResult(result)
            setIsNewBest(!existingBest || result.total > existingBest.total)
            setLevelScores((prev) => {
              const next = [...prev]
              const best = prev[levelIndex]
              next[levelIndex] = {
                total: Math.max(best?.total ?? 0, result.total),
                stars: Math.max(best?.stars ?? 0, result.stars),
              }
              return next
            })
            setPhase('won')
          } else {
            audio.stopEngine(true)
            audio.playCrash()
            const out = used >= LAUNCHES_PER_LEVEL
            setOutOfLaunches(out)
            setPhase('crashed')
            crashTimerRef.current = window.setTimeout(
              () => {
                crashTimerRef.current = null
                if (!out) {
                  resetAim()
                  return
                }
                // Out of launches: a fresh layout of the same level.
                setLaunchesUsed(0)
                setLayout((l) => l + 1)
              },
              out ? OUT_OF_LAUNCHES_PAUSE_MS : CRASH_PAUSE_MS,
            )
          }
          return
        }
      }
      const { used: boostUsed, remaining } = boostRef.current
      setBoostLeft(boostUsed ? remaining / BOOST_SECONDS : 1)
      const { x: vx, y: vy } = rocketRef.current.vel
      audio.updateEngine(Math.hypot(vx, vy) / ENGINE_FULL_SPEED, remaining > 0)
      drawRef.current()
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
  }

  // The once-per-flight boost (Space, a tap on the canvas, or the Boost
  // button): a short push along the direction of travel.
  function boost() {
    if (phaseRef.current !== 'flying' || boostRef.current.used) return
    boostRef.current = { used: true, remaining: BOOST_SECONDS }
    audio.playBoost()
  }

  function nextLevel() {
    audio.playClick()
    setLevelIndex((i) => i + 1)
    setLayout(0)
    setLaunchesUsed(0)
    setAngle(DEFAULT_ANGLE)
    setPower(DEFAULT_POWER)
    setLastResult(null)
  }

  // Replay the level just won, for a shot at a better score -- keeps the
  // best score already recorded for it (only a strictly better attempt
  // will ever replace it), keeps the current angle/power, and reuses the
  // exact same generated layout (see the level-cache effect above) with a
  // full set of launches.
  function retryLevel() {
    audio.playClick()
    if (level) rocketRef.current = { pos: { ...level.rocketStart }, vel: { x: 0, y: 0 } }
    trailRef.current = []
    setLaunchesUsed(0)
    setLastResult(null)
    setPhase('aiming')
  }

  function restart() {
    audio.playClick()
    setLevelIndex(0)
    setRunSeed(newSeed())
    setLayout(0)
    setLaunchesUsed(0)
    setAngle(DEFAULT_ANGLE)
    setPower(DEFAULT_POWER)
    setLastResult(null)
    setLevelScores(TIERS.map(() => null))
    levelCacheRef.current.clear()
  }

  function toggleMute() {
    audio.init()
    toggleSiteMute()
  }

  return (
    <div className="gravity-well fullscreen">
      <button type="button" className="gw-mute" onClick={toggleMute} aria-label={muted ? 'Unmute sound' : 'Mute sound'}>
        {muted ? '🔇' : '🔊'}
      </button>

      {finished ? (
        <div className="results">
          <p className="score">🎉 You made it home through all {TIERS.length} levels!</p>
          <p className="stat-line">Final score: {totalScore}</p>
          <p className="stat-line">
            {'★'.repeat(totalStars)} {totalStars} of {TIERS.length * 3} stars · best run {bestTotal}
          </p>
          <button type="button" onClick={restart}>Play Again</button>
        </div>
      ) : (
        <>
          <div className="progress" style={canvasWidth ? { width: canvasWidth } : undefined}>
            <span className="score-badge">Score: {totalScore}</span>
            <span className="flight-badges">
              <span
                className="launches-badge"
                aria-label={`${LAUNCHES_PER_LEVEL - launchesUsed} of ${LAUNCHES_PER_LEVEL} launches left`}
              >
                {Array.from({ length: LAUNCHES_PER_LEVEL }, (_, i) => (
                  <span key={i} className={i < LAUNCHES_PER_LEVEL - launchesUsed ? 'pip on' : 'pip'} />
                ))}
              </span>
              {level && level.stardust.length > 0 && (
                <span className="stardust-badge" aria-label="Stardust collected">
                  ✦ {stardustCollected}/{level.stardust.length}
                </span>
              )}
            </span>
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
                      <span className="win-stars" aria-label={`${lastResult.stars} of 3 stars`}>
                        {[1, 2, 3].map((n) => (
                          <span key={n} className={n <= lastResult.stars ? 'on' : ''}>★</span>
                        ))}
                      </span>
                      <span className="win-star-key">
                        ★ landed · ★ all stardust · ★ within 2 launches
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
                  <div className="feedback bad overlay">
                    {outOfLaunches
                      ? '💥 Out of launches — charting a new course…'
                      : `💥 Lost contact — ${LAUNCHES_PER_LEVEL - launchesUsed} ${LAUNCHES_PER_LEVEL - launchesUsed === 1 ? 'launch' : 'launches'} left`}
                  </div>
                )}
              </div>

              <p className="keyboard-hint">
                Drag on the canvas like a slingshot to aim &amp; launch — or use A/D/W/S then Space. Mid-flight,
                tap or press Space once to boost. Grab the ✦ stardust on the way home.
              </p>

              <div className="controls">
                <div className="control readout">
                  <span>Angle: {angle}°</span>
                  <span>Power: {power}</span>
                </div>
                {/* Separate elements (keys) so a Space press that launches
                    can't also click the Boost button that replaces Launch. */}
                {phase === 'flying' ? (
                  <button
                    key="boost"
                    type="button"
                    className="launch-button boost-button"
                    onClick={boost}
                    disabled={boostLeft < 1}
                    style={{ '--fuel': boostLeft } as React.CSSProperties}
                  >
                    {boostLeft < 1 ? (boostLeft > 0 ? 'Boosting!' : 'Boost used') : 'Boost'}
                  </button>
                ) : (
                  <button
                    key="launch"
                    type="button"
                    className="launch-button"
                    onClick={launch}
                    disabled={phase !== 'aiming'}
                  >
                    Launch
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default GravityWell
