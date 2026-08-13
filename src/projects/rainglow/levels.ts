import type { LensCounts } from './colors'

export interface Level {
  number: number
  target: LensCounts
}

// Each level's target lens counts sum to `number` (the level number) and
// have a greatest common divisor of 1 — meaning that exact color ratio
// cannot be reproduced with fewer lenses (no smaller integer triple in the
// same proportion exists), so "level N requires N lenses" is a real,
// checkable constraint rather than just a label.
export const LEVELS: Level[] = [
  { number: 1, target: { red: 0, yellow: 1, blue: 0 } },
  { number: 2, target: { red: 0, yellow: 1, blue: 1 } },
  { number: 3, target: { red: 2, yellow: 1, blue: 0 } },
  { number: 4, target: { red: 1, yellow: 0, blue: 3 } },
  { number: 5, target: { red: 2, yellow: 2, blue: 1 } },
  { number: 6, target: { red: 1, yellow: 4, blue: 1 } },
  { number: 7, target: { red: 3, yellow: 2, blue: 2 } },
  { number: 8, target: { red: 2, yellow: 3, blue: 3 } },
  { number: 9, target: { red: 4, yellow: 3, blue: 2 } },
  { number: 10, target: { red: 3, yellow: 4, blue: 3 } },
]
