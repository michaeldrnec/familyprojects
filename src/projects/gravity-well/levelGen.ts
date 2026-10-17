import type { Alien, Body, BodyKind, Vec2 } from './physics'
import { TICK_DT, distance, simulateTrajectory, surfaceDistance, velocityFromAngle } from './physics'
import { makeRng, type Rng } from '../../shared/rng'
import type { TierConfig } from './levels'
import { escapeBonusFor } from './scoring'

export interface Level {
  name: string
  bounds: { width: number; height: number }
  rocketStart: { x: number; y: number }
  earth: { x: number; y: number; radius: number }
  bodies: Body[]
  alien?: Alien
  /** Pickups along one landing route (see placeStardust). */
  stardust: Vec2[]
}

// Same power range the UI's drag/keyboard controls expose -- the
// solvability search only trusts a layout if a shot reachable by the
// player can actually land, not just any theoretical velocity.
const SEARCH_POWER_MIN = 40
const SEARCH_POWER_MAX = 420
const SEARCH_ANGLE_STEP = 9
const SEARCH_POWER_STEPS = 14
const SEARCH_MAX_TICKS = 1500 // 12.5s of simulated flight -- plenty for the tuned power range
const MAX_GENERATION_ATTEMPTS = 40

const STARDUST_COUNT = 3
// Keeps pickups clear of the launch pad and of Earth, and apart from each
// other, so each one is its own small target.
const STARDUST_START_CLEARANCE = 70
const STARDUST_EARTH_CLEARANCE = 45
const STARDUST_MIN_SPACING = 60

const EDGE_MARGIN = 70
const START_EARTH_X_MARGIN = 60

const BODY_RANGES: Record<BodyKind, { radius: [number, number]; mass: [number, number] }> = {
  asteroid: { radius: [12, 20], mass: [300, 700] },
  planet: { radius: [26, 38], mass: [2500, 4800] },
  star: { radius: [40, 48], mass: [15000, 22000] },
}

const ORBIT_RADIUS_RANGE: [number, number] = [30, 70]
const ORBIT_SPEED_RANGE: [number, number] = [0.3, 0.7]

// Nominal "footprint" radius used only for spacing the alien away from the
// rocket start, Earth, and every body -- the ship itself has no collision
// (its beam is the hazard), this just keeps it from spawning on top of
// something else.
const ALIEN_FOOTPRINT_RADIUS = 18

interface Placed {
  x: number
  y: number
  radius: number
}

function fits(candidate: Placed, others: Placed[], minGap: number): boolean {
  return others.every((o) => {
    const dx = candidate.x - o.x
    const dy = candidate.y - o.y
    return Math.hypot(dx, dy) - candidate.radius - o.radius >= minGap
  })
}

/** Try to place a circle of `radius` somewhere in bounds that respects
 * `minGap` from everything already placed. Falls back to the best of a
 * generous attempt budget if nothing fits perfectly -- an occasional tight
 * fit is fine, an outright unsolvable layout is caught later by the
 * solvability search and thrown away instead. */
function placeCircle(
  rng: Rng,
  bounds: { width: number; height: number },
  radius: number,
  minGap: number,
  avoid: Placed[],
): Placed {
  let best: Placed | null = null
  let bestSlack = -Infinity
  for (let attempt = 0; attempt < 300; attempt++) {
    const candidate: Placed = {
      x: rng.range(EDGE_MARGIN + radius, bounds.width - EDGE_MARGIN - radius),
      y: rng.range(EDGE_MARGIN + radius, bounds.height - EDGE_MARGIN - radius),
      radius,
    }
    if (fits(candidate, avoid, minGap)) return candidate
    const slack = Math.min(...avoid.map((o) => Math.hypot(candidate.x - o.x, candidate.y - o.y) - candidate.radius - o.radius))
    if (slack > bestSlack) {
      bestSlack = slack
      best = candidate
    }
  }
  return best ?? { x: bounds.width / 2, y: bounds.height / 2, radius }
}

/** Generate one candidate layout for a tier, deterministically from `seed`. */
export function generateLevel(tier: TierConfig, seed: number): Level {
  const rng = makeRng(seed)
  const { bounds } = tier

  const rocketStart = {
    x: rng.range(EDGE_MARGIN, EDGE_MARGIN + START_EARTH_X_MARGIN),
    y: rng.range(EDGE_MARGIN, bounds.height - EDGE_MARGIN),
  }
  const earthRadius = 26
  const earth = {
    x: rng.range(bounds.width - EDGE_MARGIN - START_EARTH_X_MARGIN, bounds.width - EDGE_MARGIN),
    y: rng.range(EDGE_MARGIN, bounds.height - EDGE_MARGIN),
    radius: earthRadius,
  }

  const placed: Placed[] = [
    { ...rocketStart, radius: 20 },
    { ...earth, radius: earthRadius },
  ]

  const kinds: BodyKind[] = []
  ;(Object.entries(tier.bodyCounts) as [BodyKind, number | undefined][]).forEach(([kind, count]) => {
    for (let i = 0; i < (count ?? 0); i++) kinds.push(kind)
  })

  const bodies: Body[] = kinds.map((kind) => {
    const { radius: radiusRange, mass: massRange } = BODY_RANGES[kind]
    const radius = rng.range(radiusRange[0], radiusRange[1])
    const mass = rng.range(massRange[0], massRange[1])
    const spot = placeCircle(rng, bounds, radius, tier.minGap, placed)
    placed.push(spot)
    return { x: spot.x, y: spot.y, radius, mass, kind }
  })

  // Pick `movingCount` bodies (largest first, so a slingshot star is a
  // likelier mover than a tiny asteroid, though any kind can move) to orbit
  // their own spawn point instead of sitting still.
  const moverIndices = [...bodies.keys()]
    .sort((a, b) => bodies[b].radius - bodies[a].radius)
    .slice(0, tier.movingCount)
  for (const i of moverIndices) {
    const body = bodies[i]
    body.orbit = {
      cx: body.x,
      cy: body.y,
      radius: rng.range(ORBIT_RADIUS_RANGE[0], ORBIT_RADIUS_RANGE[1]),
      angularSpeed: rng.range(ORBIT_SPEED_RANGE[0], ORBIT_SPEED_RANGE[1]) * (rng.next() < 0.5 ? -1 : 1),
      phase: rng.range(0, Math.PI * 2),
    }
  }

  let alien: Alien | undefined
  if (rng.next() < tier.alienChance) {
    const spot = placeCircle(rng, bounds, ALIEN_FOOTPRINT_RADIUS, tier.minGap, placed)
    placed.push(spot)
    alien = { x: spot.x, y: spot.y, beamAngle: Math.atan2(earth.y - spot.y, earth.x - spot.x) }
  }

  return { name: tier.name, bounds, rocketStart, earth, bodies, alien, stardust: [] }
}

/** Coarse angle/power grid search reusing the exact physics the real flight
 * and the live preview use -- a shot only counts if it's within the
 * player's actual control range (SEARCH_POWER_MIN..MAX, whole-number powers
 * like the controls produce) and reaches Earth. Returns the landing
 * velocities found, or just the first one with `firstOnly`. */
function landingShots(level: Level, firstOnly: boolean): Vec2[] {
  const shots: Vec2[] = []
  const powerStep = (SEARCH_POWER_MAX - SEARCH_POWER_MIN) / SEARCH_POWER_STEPS
  for (let angle = 0; angle < 360; angle += SEARCH_ANGLE_STEP) {
    for (let p = 0; p <= SEARCH_POWER_STEPS; p++) {
      const power = Math.round(SEARCH_POWER_MIN + p * powerStep)
      const vel = velocityFromAngle(angle, power)
      const result = simulateTrajectory(
        level.rocketStart,
        vel,
        level.bodies,
        level.earth,
        level.bounds,
        1_000_000, // no need to sample intermediate points during the search
        0,
        SEARCH_MAX_TICKS,
        level.alien,
      )
      if (result.outcome === 'hit-earth') {
        shots.push(vel)
        if (firstOnly) return shots
      }
    }
  }
  return shots
}

export function isSolvable(level: Level): boolean {
  return landingShots(level, true).length > 0
}

/** Lays stardust along the riskiest landing route the search found -- the
 * one that skims closest to the level's bodies (the same measure the
 * flyby bonuses score) -- so collecting it all means flying a daring line,
 * and the pickups double as a breadcrumb hint toward a working shot.
 * Routes are traced from t=0, so on levels with orbiting bodies the line
 * through every pickup depends on when you launch. */
function placeStardust(level: Level): Vec2[] {
  let bestRoute: Vec2[] = []
  let bestRisk = -1
  for (const vel of landingShots(level, false)) {
    const { points } = simulateTrajectory(
      level.rocketStart,
      vel,
      level.bodies,
      level.earth,
      level.bounds,
      1,
      0,
      SEARCH_MAX_TICKS,
      level.alien,
    )
    const risk = level.bodies.reduce((sum, body) => {
      let closest = Infinity
      points.forEach((pt, i) => (closest = Math.min(closest, surfaceDistance(pt, body, i * TICK_DT))))
      return sum + escapeBonusFor(body, closest)
    }, 0)
    if (risk > bestRisk) {
      bestRisk = risk
      bestRoute = points
    }
  }

  const usable = bestRoute.filter(
    (pt) =>
      distance(pt, level.rocketStart) >= STARDUST_START_CLEARANCE &&
      distance(pt, level.earth) >= level.earth.radius + STARDUST_EARTH_CLEARANCE,
  )
  if (usable.length === 0) return []
  // Evenly spaced along the usable stretch, dropping any that would crowd
  // the previous one (a short route may only fit one or two).
  const picks: Vec2[] = []
  for (let i = 0; i < STARDUST_COUNT; i++) {
    const pt = usable[Math.round(((i + 0.5) / STARDUST_COUNT) * (usable.length - 1))]
    if (picks.every((p) => distance(p, pt) >= STARDUST_MIN_SPACING)) picks.push({ x: pt.x, y: pt.y })
  }
  return picks
}

/** Generate a layout for `tier` and keep re-rolling (new derived seed) until
 * one is actually solvable, bounded so a pathological tier config can't hang
 * the game -- falls back to the last candidate generated if the budget runs
 * out (should not happen in practice; the grid search is generous). */
export function generateSolvableLevel(tier: TierConfig, seed: number): Level {
  let candidate = generateLevel(tier, seed)
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    if (isSolvable(candidate)) break
    candidate = generateLevel(tier, seed + attempt + 1)
  }
  return { ...candidate, stardust: placeStardust(candidate) }
}
