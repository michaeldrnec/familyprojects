// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { loadProgress, recordShift } from './progress'
import type { ShiftResult } from './sim/shift'

function result(stars: number, score: number, outcome: ShiftResult['outcome'] = 'complete'): ShiftResult {
  return {
    outcome,
    score,
    stars,
    deliveries: 0,
    csections: 0,
    midwife: 0,
    transfers: 0,
    complications: 0,
    babyStars: 0,
    ledger: { babies: 0, skill: 0, codeStork: 0, midwife: 0, transfers: 0, stress: 0, waiting: 0 },
    log: [],
  }
}

beforeEach(() => localStorage.clear())

describe('progress', () => {
  it('starts with only the first shift open', () => {
    expect(loadProgress()).toMatchObject({ unlocked: 0, bestStars: [0, 0, 0, 0, 0] })
  })

  it('a star opens the next shift and keeps the best', () => {
    let p = recordShift(loadProgress(), 0, result(2, 1600))
    expect(p.unlocked).toBe(1)
    p = recordShift(p, 0, result(1, 1000))
    expect(p.bestStars[0]).toBe(2)
    expect(p.bestScore[0]).toBe(1600)
    expect(loadProgress()).toEqual(p)
  })

  it('no stars, or a shift ended by the specialists, opens nothing', () => {
    let p = recordShift(loadProgress(), 0, result(0, 500))
    expect(p.unlocked).toBe(0)
    p = recordShift(p, 0, result(0, 1200, 'sentHome'))
    expect(p.unlocked).toBe(0)
  })

  it('shrugs off a corrupt save', () => {
    localStorage.setItem('ten-centimeters:progress', JSON.stringify({ __v: 1, data: { unlocked: 'lots', bestStars: [9, -1] } }))
    expect(loadProgress()).toMatchObject({ unlocked: 0, bestStars: [3, 0, 0, 0, 0] })
  })
})
