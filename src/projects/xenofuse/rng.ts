// Deterministic PRNG (mulberry32), same approach as gravity-well/rng.ts --
// a given numeric seed always reproduces the same sequence, so a bomb's
// layout stays fixed for a given (run, bomb) pair while still varying
// from run to run.

export interface Rng {
  next(): number // [0, 1)
  range(min: number, max: number): number
  int(min: number, max: number): number // inclusive of min, exclusive of max
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0
  function next(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    range(min: number, max: number) {
      return min + next() * (max - min)
    },
    int(min: number, max: number) {
      return Math.floor(min + next() * (max - min))
    },
  }
}

// Fisher-Yates shuffle driven by the seeded rng, so glyph assignments etc.
// stay reproducible for a given seed instead of using Math.random.
export function shuffle<T>(rng: Rng, items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(0, i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
