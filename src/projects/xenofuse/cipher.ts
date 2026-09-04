// Substitution-cipher stage (spec.md 4.1): the alien glyph set maps 1:1 to
// letters/digits. The player is given a partial mapping up front (and can
// reveal more, at a time cost) and has to deduce the rest to read the code.
import { GLYPHS } from './glyphs'
import { shuffle, type Rng } from './rng'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')

export interface CipherPuzzle {
  kind: 'cipher'
  clueText: string
  code: string // the glyph string to decode, e.g. "◆◐◈◐"
  answer: string // the decoded plaintext, e.g. "4B84"
  full: Record<string, string> // glyph -> plaintext char, every glyph in play (used to look up hint reveals)
  given: Record<string, string> // glyph -> plaintext char, revealed from the start
  revealOrder: string[] // remaining glyphs, in the order a hint reveals them
}

export function generateCipher(rng: Rng, length: number, revealFraction: number): CipherPuzzle {
  const plainChars = Array.from({ length }, () => ALPHABET[rng.int(0, ALPHABET.length)])
  const answer = plainChars.join('')

  const uniqueChars = Array.from(new Set(plainChars))
  const stageGlyphs = shuffle(rng, [...GLYPHS]).slice(0, uniqueChars.length)
  const glyphOf: Record<string, string> = {}
  uniqueChars.forEach((c, i) => {
    glyphOf[c] = stageGlyphs[i]
  })
  const code = plainChars.map((c) => glyphOf[c]).join('')

  // Reveal enough of the mapping up front to make the puzzle solvable by
  // deduction, holding back at least one glyph (unless there's only one
  // unique glyph in play, which the reveal loop below still handles).
  const revealCount = Math.max(1, Math.min(uniqueChars.length - 1, Math.round(uniqueChars.length * revealFraction)))
  const shuffledChars = shuffle(rng, uniqueChars)
  const givenChars = shuffledChars.slice(0, revealCount)
  const hiddenChars = shuffledChars.slice(revealCount)

  const full: Record<string, string> = {}
  uniqueChars.forEach((c) => {
    full[glyphOf[c]] = c
  })
  const given: Record<string, string> = {}
  givenChars.forEach((c) => {
    given[glyphOf[c]] = c
  })
  const revealOrder = hiddenChars.map((c) => glyphOf[c])

  return {
    kind: 'cipher',
    clueText: 'Each glyph stands for one letter or digit, the same way every time it appears.',
    code,
    answer,
    full,
    given,
    revealOrder,
  }
}
