import { describe, expect, it } from 'vitest'
import { isFamilySafe } from '../../shared/familySafe'
import { buildGraph, isOneLetterOff, isValidWord, randomPuzzleFromGraph, shortestPath, wordsForLength, type WordLength } from './words'

describe('Letter Ladder words', () => {
  it('only accepts real, family-safe words', () => {
    expect(isValidWord('cat')).toBe(true)
    expect(isValidWord('COLD')).toBe(true)
    expect(isValidWord('QXZ')).toBe(false)
    for (const w of ['CRAP', 'HELL', 'PISS', 'DAMN']) expect(isValidWord(w)).toBe(false)
    for (const len of [3, 4, 5] as WordLength[]) expect(wordsForLength(len).every(isFamilySafe)).toBe(true)
  })

  it('detects a single-letter change', () => {
    expect(isOneLetterOff('COLD', 'CORD')).toBe(true)
    expect(isOneLetterOff('COLD', 'COLD')).toBe(false)
    expect(isOneLetterOff('COLD', 'CARD')).toBe(false)
    expect(isOneLetterOff('COLD', 'COLDS')).toBe(false)
  })

  it('finds a shortest ladder made of valid one-letter steps', () => {
    const graph = buildGraph(wordsForLength(4))
    const path = shortestPath(graph, 'COLD', 'WARM')!
    expect(path[0]).toBe('COLD')
    expect(path[path.length - 1]).toBe('WARM')
    for (let i = 1; i < path.length; i++) {
      expect(isOneLetterOff(path[i - 1], path[i])).toBe(true)
      expect(isValidWord(path[i])).toBe(true)
    }
  })

  it('generates puzzles that can be solved', () => {
    for (const len of [3, 4, 5] as WordLength[]) {
      const graph = buildGraph(wordsForLength(len))
      for (let i = 0; i < 5; i++) {
        const { start, end } = randomPuzzleFromGraph(graph)
        expect(start).not.toBe(end)
        expect(shortestPath(graph, start, end)).not.toBeNull()
      }
    }
  })
})
