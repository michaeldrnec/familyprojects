import { describe, expect, it } from 'vitest'
import { makeRng, shuffle } from './rng'

describe('makeRng', () => {
  it('reproduces the exact mulberry32 sequence (seeded layouts and dailies depend on it)', () => {
    const rng = makeRng(42)
    expect(rng.next()).toBe(0.6011037519201636)
    expect(rng.next()).toBe(0.44829055899754167)
    expect(rng.next()).toBe(0.8524657934904099)
    expect(makeRng(0).next()).toBe(0.26642920868471265)
  })

  it('gives the same sequence for the same seed', () => {
    const a = makeRng(1234)
    const b = makeRng(1234)
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next())
  })

  it('keeps int() and range() inside their bounds', () => {
    const rng = makeRng(7)
    for (let i = 0; i < 1000; i++) {
      const n = rng.int(3, 9)
      expect(Number.isInteger(n)).toBe(true)
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThan(9)
      const x = rng.range(-2, 2)
      expect(x).toBeGreaterThanOrEqual(-2)
      expect(x).toBeLessThan(2)
    }
  })
})

describe('shuffle', () => {
  it('returns a reproducible permutation without touching the input', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    const a = shuffle(makeRng(5), items)
    expect(shuffle(makeRng(5), items)).toEqual(a)
    expect([...a].sort()).toEqual(items)
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
})
