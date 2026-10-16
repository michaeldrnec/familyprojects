import { describe, expect, it } from 'vitest'
import { isValidWord } from './words'

describe('Sentence Spin dictionary', () => {
  it('accepts real words that start with the spun letter', () => {
    expect(isValidWord('S', 'spoon')).toBe(true)
    expect(isValidWord('a', ' Aardvark ')).toBe(true)
  })

  it('rejects wrong letters, non-words, single letters and blocked words', () => {
    expect(isValidWord('B', 'spoon')).toBe(false)
    expect(isValidWord('Q', 'qxzzy')).toBe(false)
    expect(isValidWord('A', 'a')).toBe(false)
    expect(isValidWord('C', 'crap')).toBe(false)
  })
})
