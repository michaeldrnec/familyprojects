// Sequence/pattern stage (spec.md 4.3): a run of numbers follows a rule;
// the last one is hidden and is the code to find. Numbers are rendered in
// glyph-encoded decimal digits (reusing the digit-glyph idea from
// numerals.ts, but always base 10) so this stage still looks and feels
// alien, and revealing digit glyphs is the same hint mechanic as the other
// two puzzle types -- once the player can read the numbers, the always-
// visible rule clue is what lets them extrapolate the missing one.
import { GLYPHS, UNKNOWN_GLYPH } from './glyphs'
import { shuffle, type Rng } from './rng'

export type SeqRule = 'arithmetic' | 'doubling' | 'alternating'

export interface SequencePuzzle {
  kind: 'sequence'
  clueText: string
  code: string // glyph-encoded sequence, numbers separated by " · ", last is UNKNOWN_GLYPH
  answer: string // the missing (last) number, as a decimal string
  digitGlyphs: string[] // digitGlyphs[d] is the glyph for digit d, 0..9
  given: number[] // digit values (0-9) revealed from the start
  revealOrder: number[] // remaining digit values, in hint-reveal order
}

function buildSequence(rng: Rng, rule: SeqRule, length: number): number[] {
  switch (rule) {
    case 'arithmetic': {
      const start = rng.int(1, 50)
      const step = rng.int(2, 13)
      return Array.from({ length }, (_, i) => start + step * i)
    }
    case 'doubling': {
      const start = rng.int(1, 9)
      return Array.from({ length }, (_, i) => start * Math.pow(2, i))
    }
    case 'alternating': {
      const start = rng.int(1, 40)
      const up = rng.int(3, 12)
      const down = rng.int(2, 8)
      const seq = [start]
      for (let i = 1; i < length; i++) {
        seq.push(seq[i - 1] + (i % 2 === 1 ? up : -down))
      }
      return seq
    }
  }
}

const RULE_CLUES: Record<SeqRule, string> = {
  arithmetic: 'Each number in the sequence is a fixed amount more than the one before it.',
  doubling: 'Each number in the sequence is exactly double the one before it.',
  alternating: 'The sequence alternates: add an amount, then subtract a (different) amount.',
}

export function generateSequence(
  rng: Rng,
  rule: SeqRule,
  length: number,
  revealFraction: number,
): SequencePuzzle {
  const digitGlyphs = shuffle(rng, [...GLYPHS]).slice(0, 10)
  const numbers = buildSequence(rng, rule, length)
  const answer = String(numbers[numbers.length - 1])

  function encode(n: number): string {
    return String(n)
      .split('')
      .map((d) => digitGlyphs[Number(d)])
      .join('')
  }

  const shown = numbers.slice(0, -1).map(encode)
  shown.push(UNKNOWN_GLYPH)
  const code = shown.join(' · ')

  const revealCount = Math.max(1, Math.min(9, Math.round(10 * revealFraction)))
  const digitValues = shuffle(
    rng,
    Array.from({ length: 10 }, (_, d) => d),
  )
  const given = digitValues.slice(0, revealCount).sort((a, b) => a - b)
  const revealOrder = digitValues.slice(revealCount)

  return {
    kind: 'sequence',
    clueText: RULE_CLUES[rule],
    code,
    answer,
    digitGlyphs,
    given,
    revealOrder,
  }
}
