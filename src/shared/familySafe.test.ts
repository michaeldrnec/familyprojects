import { describe, expect, it } from 'vitest'
import { isFamilySafe } from './familySafe'

describe('isFamilySafe', () => {
  it('blocks listed words in any case', () => {
    for (const w of ['crap', 'HELL', 'Damn', 'FETISH', 'SEXUAL', 'NAKED']) expect(isFamilySafe(w)).toBe(false)
  })

  it('blocks longer words built on a blocked root', () => {
    for (const w of ['SHITTY', 'BULLSHIT', 'FUCKER', 'BITCHES', 'PORNO']) expect(isFamilySafe(w)).toBe(false)
  })

  it('allows innocent words that contain a blocked whole word', () => {
    for (const w of ['CLASS', 'GRAPE', 'DRAPE', 'SEXTANT', 'PEACOCK', 'SALTWATER', 'SWANK', 'SHELL', 'HELLO', 'SCRAPE']) {
      expect(isFamilySafe(w)).toBe(true)
    }
  })

  it('does not treat ordinary or identity words as unsafe', () => {
    for (const w of ['DRUG', 'KILL', 'CASINO', 'GAY', 'LESBIAN', 'CAT']) expect(isFamilySafe(w)).toBe(true)
  })
})
