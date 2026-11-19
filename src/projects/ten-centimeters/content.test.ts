import { describe, expect, it } from 'vitest'
import { isFamilySafe } from '../../shared/familySafe'
import * as content from './content'
import { STORK_STEPS } from './minigames/stork'
import { SHIFTS } from './sim/config'

// Every string the game can show: the content module (message templates are
// filled in with a sample name), the shift names and briefings, and the
// surgery steps.
function allText(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (typeof value === 'function') return allText((value as (name: string, n: number) => unknown)('Maya', 2))
  if (Array.isArray(value)) return value.flatMap(allText)
  if (value && typeof value === 'object') return Object.values(value).flatMap(allText)
  return []
}

describe('content', () => {
  it('is family-safe, word by word', () => {
    const text = [...allText(content), ...SHIFTS.flatMap((s) => [s.name, ...s.briefing]), ...allText(STORK_STEPS)]
    expect(text.length).toBeGreaterThan(80)
    for (const line of text) {
      for (const word of line.split(/[^A-Za-z]+/).filter(Boolean)) expect(isFamilySafe(word), `"${word}" in "${line}"`).toBe(true)
    }
  })

  it('has more names than the floor can ever hold at once', () => {
    expect(new Set(content.NAMES).size).toBe(content.NAMES.length)
    expect(content.NAMES.length).toBeGreaterThan(20)
  })
})
