import { describe, expect, it } from 'vitest'
import type { Body } from './physics'
import { LANDING_SCORE, LAUNCHES_PER_LEVEL, scoreLanding } from './scoring'

const planet: Body = { x: 0, y: 0, radius: 30, mass: 3000, kind: 'planet' }

describe('Gravity Well scoring', () => {
  it('gives three stars for a first-try landing with all the stardust', () => {
    const score = scoreLanding([planet], [Infinity], { stardustCollected: 3, stardustTotal: 3, launchesUsed: 1 })
    expect(score.stars).toBe(3)
    expect(score.total).toBe(LANDING_SCORE + 3 * 25 + (LAUNCHES_PER_LEVEL - 1) * 20)
  })

  it('gives one star for a late landing that missed stardust', () => {
    const score = scoreLanding([planet], [Infinity], {
      stardustCollected: 1,
      stardustTotal: 3,
      launchesUsed: LAUNCHES_PER_LEVEL,
    })
    expect(score.stars).toBe(1)
    expect(score.bonuses.map((b) => b.label)).toEqual(['Stardust ×1'])
  })

  it('still rewards skimming close to a body', () => {
    const near = scoreLanding([planet], [5], { stardustCollected: 0, stardustTotal: 0, launchesUsed: 3 })
    const far = scoreLanding([planet], [Infinity], { stardustCollected: 0, stardustTotal: 0, launchesUsed: 3 })
    expect(near.total).toBeGreaterThan(far.total)
    expect(near.stars).toBe(2) // nothing to collect counts as all of it
  })
})
