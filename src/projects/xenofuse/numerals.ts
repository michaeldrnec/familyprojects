// Base/number-conversion stage (spec.md 4.2): alien numerals use a
// non-decimal counting system, one glyph per digit, read left-to-right like
// normal positional notation. The player converts the glyph string back to
// the base-10 defuse code.
import { GLYPHS } from './glyphs'
import { shuffle, type Rng } from './rng'

export interface NumeralPuzzle {
  kind: 'numerals'
  base: number
  clueText: string
  code: string // the glyph string, e.g. "◆◐◈"
  answer: string // the base-10 defuse code, e.g. "482"
  digitGlyphs: string[] // digitGlyphs[d] is the glyph for digit d, 0..base-1
  given: number[] // digit values revealed from the start
  revealOrder: number[] // remaining digit values, in hint-reveal order
}

export function generateNumerals(
  rng: Rng,
  base: number,
  decimalDigits: number,
  revealFraction: number,
): NumeralPuzzle {
  const digitGlyphs = shuffle(rng, [...GLYPHS]).slice(0, base)

  const low = Math.pow(10, decimalDigits - 1)
  const high = Math.pow(10, decimalDigits)
  const value = rng.int(low, high)
  const answer = String(value)

  const digits: number[] = []
  let v = value
  while (v > 0) {
    digits.unshift(v % base)
    v = Math.floor(v / base)
  }
  const code = digits.map((d) => digitGlyphs[d]).join('')

  const revealCount = Math.max(1, Math.min(base - 1, Math.round(base * revealFraction)))
  const digitValues = shuffle(
    rng,
    Array.from({ length: base }, (_, d) => d),
  )
  const given = digitValues.slice(0, revealCount).sort((a, b) => a - b)
  const revealOrder = digitValues.slice(revealCount)

  return {
    kind: 'numerals',
    base,
    clueText: `The aliens count in base ${base}: each glyph is one digit, 0 through ${base - 1}, read left to right by place value just like decimal.`,
    code,
    answer,
    digitGlyphs,
    given,
    revealOrder,
  }
}
