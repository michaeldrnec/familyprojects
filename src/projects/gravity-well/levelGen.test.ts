import { describe, expect, it } from 'vitest'
import { generateSolvableLevel, isSolvable, type Level } from './levelGen'
import { TIERS } from './levels'
import { simulateTrajectory, touchesStardust, velocityFromAngle } from './physics'

// The same angle/power grid the generator searches (whole-number powers,
// like the player's controls produce).
function collectsEverything(level: Level): boolean {
  for (let angle = 0; angle < 360; angle += 9) {
    for (let p = 0; p <= 14; p++) {
      const power = Math.round(40 + (p * (420 - 40)) / 14)
      const { points, outcome } = simulateTrajectory(
        level.rocketStart,
        velocityFromAngle(angle, power),
        level.bodies,
        level.earth,
        level.bounds,
        1,
        0,
        1500,
        level.alien,
      )
      if (outcome === 'hit-earth' && level.stardust.every((sd) => points.some((pt) => touchesStardust(pt, sd)))) {
        return true
      }
    }
  }
  return false
}

describe('Gravity Well level generator', () => {
  it('is deterministic for a seed', () => {
    expect(generateSolvableLevel(TIERS[3], 99)).toEqual(generateSolvableLevel(TIERS[3], 99))
  })

  it('produces a level you can actually land on for every tier', () => {
    TIERS.forEach((tier, i) => {
      for (const seed of [1, 2, 3]) {
        const level = generateSolvableLevel(tier, seed * 1000 + i)
        expect(isSolvable(level), `${tier.name} seed ${seed}`).toBe(true)
      }
    })
  })

  it('places stardust that one landing flight can collect in full', () => {
    TIERS.forEach((tier, i) => {
      for (const seed of [1, 2]) {
        const level = generateSolvableLevel(tier, seed * 1000 + i)
        expect(level.stardust.length, `${tier.name} seed ${seed}`).toBeGreaterThan(0)
        expect(level.stardust.length).toBeLessThanOrEqual(3)
        expect(collectsEverything(level), `${tier.name} seed ${seed}`).toBe(true)
      }
    })
  })
})
