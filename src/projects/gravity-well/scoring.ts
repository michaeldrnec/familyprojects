import type { Body, BodyKind } from './physics'

/** Points awarded just for landing safely, regardless of route taken. */
export const LANDING_SCORE = 100

/** Ceiling on the "escaped its gravity well" bonus per body kind -- bigger,
 * more massive bodies are riskier to fly close to, so they're worth more. */
const MAX_ESCAPE_BONUS: Record<BodyKind, number> = {
  asteroid: 20,
  planet: 50,
  star: 150,
}

const BODY_LABELS: Record<BodyKind, string> = {
  asteroid: 'Asteroid graze',
  planet: 'Planet flyby',
  star: 'Star slingshot',
}

/** How far beyond a body's surface its "gravity well" is considered to
 * extend, for scoring purposes -- get closer than this and you start
 * earning a bonus for it, scaling up the nearer you skim to a crash. */
function influenceRadius(body: Body): number {
  return body.radius * 4
}

/**
 * Bonus for having passed within `closestSurfaceDist` of `body` at some
 * point during a successful flight -- 0 once you never entered its
 * influence zone, ramping up to the body's max bonus the closer you got
 * to actually crashing into it.
 */
export function escapeBonusFor(body: Body, closestSurfaceDist: number): number {
  const radius = influenceRadius(body)
  if (closestSurfaceDist >= radius) return 0
  const proximity = 1 - closestSurfaceDist / radius
  return Math.round(MAX_ESCAPE_BONUS[body.kind] * proximity)
}

export interface EscapeBonus {
  kind: BodyKind
  label: string
  points: number
}

export interface LevelScore {
  landingScore: number
  bonuses: EscapeBonus[]
  total: number
}

/** Full score breakdown for a successful landing, given the closest
 * surface distance ever reached to each of the level's bodies. */
export function scoreLanding(bodies: Body[], closestSurfaceDistances: number[]): LevelScore {
  const bonuses: EscapeBonus[] = []
  bodies.forEach((body, i) => {
    const points = escapeBonusFor(body, closestSurfaceDistances[i] ?? Infinity)
    if (points > 0) bonuses.push({ kind: body.kind, label: BODY_LABELS[body.kind], points })
  })
  const bonusTotal = bonuses.reduce((sum, b) => sum + b.points, 0)
  return { landingScore: LANDING_SCORE, bonuses, total: LANDING_SCORE + bonusTotal }
}
