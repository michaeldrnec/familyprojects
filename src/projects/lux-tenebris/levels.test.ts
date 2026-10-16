import { describe, expect, it } from 'vitest'
import { LEVELS } from './levels'
import { solve } from './solver'

describe('Lux Tenebris caverns', () => {
  it.each(LEVELS.map((l, i) => [i + 1, l.name, l] as const))('cavern %i (%s) can be reached', (_n, _name, level) => {
    const result = solve(level)
    expect(result.solvable).toBe(true)
    expect(result.steps).toBeGreaterThan(0)
  })
})
