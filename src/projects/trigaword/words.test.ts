import { describe, expect, it } from 'vitest'
import { isFamilySafe } from '../../shared/familySafe'
import { buildPuzzle, ROW_LENGTHS, wordsForLength } from './words'

describe('Trigaword puzzles', () => {
  it('never uses words blocked by the family-safe filter', () => {
    for (const len of ROW_LENGTHS) expect(wordsForLength(len).every(isFamilySafe)).toBe(true)
  })

  it('builds one row per length, with exactly the missing letters in the pool', () => {
    for (let i = 0; i < 20; i++) {
      const puzzle = buildPuzzle()
      expect(puzzle.rows.map((r) => r.word.length)).toEqual(ROW_LENGTHS)
      for (const row of puzzle.rows) expect(row.given).toBe(row.word[0])
      const needed = puzzle.rows.flatMap((r) => r.word.slice(1).split('')).sort()
      expect(puzzle.pool.map((t) => t.char).sort()).toEqual(needed)
      expect(new Set(puzzle.pool.map((t) => t.id)).size).toBe(puzzle.pool.length)
    }
  })
})
