import { describe, expect, it } from 'vitest'
import { generateSolvableLevel, isSolvable } from './levelGen'
import { TIERS } from './levels'

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
})
