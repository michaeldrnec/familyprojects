import type { BodyKind } from './physics'

/** A difficulty tier's *shape* -- how many bodies of each kind, how tightly
 * they may be packed, and whether any of them orbit. The actual positions
 * are randomly generated per playthrough by `levelGen.ts`; this file only
 * defines the knobs that make each tier progressively harder. */
export interface TierConfig {
  name: string
  bounds: { width: number; height: number }
  bodyCounts: Partial<Record<BodyKind, number>>
  /** Minimum required gap (px) between any two placed circles (bodies,
   * rocket start, earth) -- smaller means a tighter, harder-to-thread level. */
  minGap: number
  /** How many of this tier's bodies orbit a fixed point instead of sitting
   * still. 0 for early tiers; ramps up from the "moving" tier onward. */
  movingCount: number
}

const BOUNDS = { width: 800, height: 600 }

/** Levels 10+ (index 9+) introduce orbiting bodies, per the user's request. */
const MOVING_FROM_TIER = 9

function moversFor(tierIndex: number, totalBodies: number): number {
  if (tierIndex < MOVING_FROM_TIER) return 0
  return Math.min(totalBodies, 1 + Math.floor((tierIndex - MOVING_FROM_TIER) / 3))
}

function totalOf(counts: Partial<Record<BodyKind, number>>): number {
  return Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0)
}

// Body-count progression across the 20 tiers -- ramps from a single gentle
// asteroid up to a dense multi-body gauntlet. minGap shrinks in step so
// later tiers require genuinely tighter threading, not just more clutter.
const BODY_PROGRESSION: Array<{ name: string; counts: Partial<Record<BodyKind, number>>; minGap: number }> = [
  { name: 'First Flight', counts: { asteroid: 1 }, minGap: 110 },
  { name: 'Around the Planet', counts: { planet: 1 }, minGap: 110 },
  { name: 'Pebble Field', counts: { asteroid: 2 }, minGap: 100 },
  { name: 'Threading the Needle', counts: { asteroid: 1, planet: 1 }, minGap: 95 },
  { name: 'Stellar Slingshot', counts: { star: 1 }, minGap: 100 },
  { name: 'Twin Worlds', counts: { planet: 2 }, minGap: 90 },
  { name: 'The Gauntlet', counts: { asteroid: 1, planet: 1, star: 1 }, minGap: 85 },
  { name: 'Rocky Approach', counts: { asteroid: 2, planet: 1 }, minGap: 85 },
  { name: 'The Gap', counts: { planet: 2, star: 1 }, minGap: 80 },
  { name: 'Orbital Drift', counts: { asteroid: 1, planet: 1 }, minGap: 90 },
  { name: 'Spinning Rocks', counts: { asteroid: 2, planet: 1 }, minGap: 85 },
  { name: 'Wandering Star', counts: { planet: 1, star: 1 }, minGap: 85 },
  { name: 'Moving Targets', counts: { asteroid: 2, planet: 1, star: 1 }, minGap: 80 },
  { name: 'Chaos Belt', counts: { asteroid: 3, planet: 1 }, minGap: 75 },
  { name: 'Binary System', counts: { planet: 2, star: 1 }, minGap: 75 },
  { name: 'The Long Way Home', counts: { asteroid: 2, planet: 2 }, minGap: 70 },
  { name: 'Stellar Chaos', counts: { asteroid: 1, planet: 1, star: 2 }, minGap: 70 },
  { name: 'Debris Run', counts: { asteroid: 3, planet: 1, star: 1 }, minGap: 65 },
  { name: 'The Final Approach', counts: { asteroid: 2, planet: 2, star: 1 }, minGap: 65 },
  { name: 'Homecoming', counts: { asteroid: 2, planet: 2, star: 2 }, minGap: 60 },
]

export const TIERS: TierConfig[] = BODY_PROGRESSION.map(({ name, counts, minGap }, i) => ({
  name,
  bounds: BOUNDS,
  bodyCounts: counts,
  minGap,
  movingCount: moversFor(i, totalOf(counts)),
}))
