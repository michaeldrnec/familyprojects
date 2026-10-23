import { describe, expect, it } from 'vitest'
import { isFamilySafe } from '../../shared/familySafe'
import * as content from './content'
import { NIGHTS, UPGRADES } from './sim/config'

// Every string the game can show, gathered from the content module and the
// night briefings.
function allText(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(allText)
  if (value && typeof value === 'object') return Object.values(value).flatMap(allText)
  return []
}

describe('content', () => {
  it('is family-safe, word by word', () => {
    const text = [...allText(content), ...NIGHTS.flatMap((n) => n.briefing), ...UPGRADES.flatMap((u) => [u.name, u.blurb])]
    expect(text.length).toBeGreaterThan(100)
    for (const line of text) {
      for (const word of line.split(/[^A-Za-z]+/).filter(Boolean)) expect(isFamilySafe(word), `"${word}" in "${line}"`).toBe(true)
    }
  })

  it('has bug titles for every severity and mini-game', () => {
    for (const sev of ['P3', 'P1', 'P0'] as const) {
      expect(content.TITLES[sev].hunt.length).toBeGreaterThan(0)
      expect(content.TITLES[sev].unravel.length).toBeGreaterThan(0)
      expect(content.COMPLAINTS[sev].length).toBeGreaterThan(0)
    }
  })
})
