// Assembles one bomb: a sequence of stages (spec.md 8) whose puzzle-type
// mix and difficulty scale with how many bombs the player has already
// cleared this run, mirroring how gravity-well separates tier definitions
// from procedural generation (levels.ts / levelGen.ts).
import { generateCipher, type CipherPuzzle } from './cipher'
import { generateNumerals, type NumeralPuzzle } from './numerals'
import { generateSequence, type SeqRule, type SequencePuzzle } from './sequences'
import { shuffle, type Rng } from './rng'

export type Puzzle = CipherPuzzle | NumeralPuzzle | SequencePuzzle

export interface Bomb {
  stages: Puzzle[]
  timeLimit: number // seconds
}

const SEQ_RULES: SeqRule[] = ['arithmetic', 'doubling', 'alternating']
const PUZZLE_KINDS = ['cipher', 'numerals', 'sequence'] as const

function pickStageKinds(rng: Rng, count: number): (typeof PUZZLE_KINDS)[number][] {
  const kinds: (typeof PUZZLE_KINDS)[number][] = []
  let last: (typeof PUZZLE_KINDS)[number] | null = null
  for (let i = 0; i < count; i++) {
    const options = PUZZLE_KINDS.filter((k) => k !== last)
    const pick = shuffle(rng, options)[0]
    kinds.push(pick)
    last = pick
  }
  return kinds
}

export function generateBomb(rng: Rng, bombIndex: number): Bomb {
  // Stage count ramps from 2 up to a cap of 4 as the run progresses.
  const stageCount = Math.min(4, 2 + Math.floor(bombIndex / 2))

  // Reveal fraction shrinks (less of the mapping given away up front) as
  // the run progresses, floored so a stage is never truly unsolvable.
  const revealFraction = Math.max(0.3, 0.65 - bombIndex * 0.06)

  const kinds = pickStageKinds(rng, stageCount)
  const stages: Puzzle[] = kinds.map((kind) => {
    switch (kind) {
      case 'cipher': {
        const length = Math.min(7, 4 + Math.floor(bombIndex / 2))
        return generateCipher(rng, length, revealFraction)
      }
      case 'numerals': {
        const base = Math.min(8, 4 + Math.floor(bombIndex / 2))
        const decimalDigits = Math.min(4, 2 + Math.floor(bombIndex / 3))
        return generateNumerals(rng, base, decimalDigits, revealFraction)
      }
      case 'sequence': {
        const rule = shuffle(rng, SEQ_RULES)[0]
        const length = bombIndex >= 3 ? 5 : 4
        return generateSequence(rng, rule, length, revealFraction)
      }
    }
  })

  // Base time budget per stage, tapering down (but floored) as the run
  // progresses so later bombs feel tighter, not just longer.
  const perStageTime = Math.max(35, 55 - bombIndex * 3)
  const timeLimit = stageCount * perStageTime

  return { stages, timeLimit }
}
