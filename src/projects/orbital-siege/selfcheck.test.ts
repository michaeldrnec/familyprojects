import { describe, expect, it } from 'vitest'
import { dailyProblems, levelProblems } from './selfcheck'

describe('Orbital Siege', () => {
  it('wins every campaign level with its reference solution, without collateral damage', () => {
    expect(levelProblems()).toEqual([])
  })

  it('generates and verifies the next 30 daily puzzles', () => {
    const start = new Date()
    const problems: string[] = []
    for (let i = 0; i < 30; i++) {
      const day = new Date(start)
      day.setDate(day.getDate() + i)
      problems.push(...dailyProblems(day))
    }
    expect(problems).toEqual([])
  })
})
