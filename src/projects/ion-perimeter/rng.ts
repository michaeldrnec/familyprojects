// Deterministic PRNG (mulberry32), copied per this repo's established
// per-project convention (gravity-well/rng.ts, starwarden/rng.ts,
// solar-ward/rng.ts all carry the same implementation). Ion Perimeter's
// wave schedule is hand-authored rather than procedurally generated, so
// this is only used for cosmetic variation -- starfield placement, particle
// spread/color, swarm spawn jitter -- never for anything that needs to be
// reproducible run to run.

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
