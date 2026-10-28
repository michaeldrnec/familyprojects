import { describe, expect, it } from 'vitest'
import { isFamilySafe } from '../../shared/familySafe'
import * as content from './content'
import { ABILITIES, DIFFICULTIES, GHOSTS, MANORS } from './sim/config'

// Every string the game can show: Snaxley's barks, the tips, the manor
// briefings and every ability and difficulty description.
function allText(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(allText)
  if (value && typeof value === 'object') return Object.values(value).flatMap(allText)
  return []
}

describe('content', () => {
  it('is family-safe, word by word', () => {
    const text = [
      ...allText(content),
      ...MANORS.flatMap((m) => [m.name, ...m.briefing]),
      ...Object.values(ABILITIES).flatMap((a) => [a.name, a.blurb]),
      ...GHOSTS.flatMap((g) => [g.name, g.role]),
      ...DIFFICULTIES.flatMap((d) => [d.name, d.blurb]),
    ]
    expect(text.length).toBeGreaterThan(100)
    for (const line of text) {
      for (const word of line.split(/[^A-Za-z]+/).filter(Boolean)) expect(isFamilySafe(word), `"${word}" in "${line}"`).toBe(true)
    }
  })

  it('has something for Snaxley to say every time he barks', () => {
    for (const lines of Object.values(content.BARKS)) expect(lines.length).toBeGreaterThan(0)
  })
})
