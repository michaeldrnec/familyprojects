import { describe, expect, it } from 'vitest'
import { colorDistance, mixColor } from './colors'
import { LEVELS } from './levels'

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

describe('Rainglow', () => {
  it('mixes like a paint wheel', () => {
    expect(mixColor({ red: 0, yellow: 0, blue: 0 })).toEqual({ r: 255, g: 255, b: 255 })
    const green = mixColor({ red: 0, yellow: 1, blue: 1 })
    expect(green.g).toBeGreaterThan(green.r)
    expect(green.g).toBeGreaterThan(green.b)
    // Only the ratio matters.
    expect(colorDistance(mixColor({ red: 1, yellow: 2, blue: 0 }), mixColor({ red: 2, yellow: 4, blue: 0 }))).toBe(0)
  })

  it('makes level N need exactly N lenses, in a ratio no smaller count can make', () => {
    LEVELS.forEach((level, i) => {
      const { red, yellow, blue } = level.target
      expect(level.number).toBe(i + 1)
      expect(red + yellow + blue).toBe(level.number)
      expect(gcd(gcd(red, yellow), blue)).toBe(1)
    })
  })
})
