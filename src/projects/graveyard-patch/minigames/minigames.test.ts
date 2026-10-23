import { describe, expect, it } from 'vitest'
import { makeRng } from '../../../shared/rng'
import { huntTally, makeHunt, squash, stepHunt, type Hunt } from './hunt'
import { crossings, makePuzzle } from './unravel'

const SEVERITIES = ['P3', 'P1', 'P0'] as const
const DT = 1 / 60

// Plays a hunt to the end. `reaction` is how long a bug has been on screen
// before the player taps it (null: never taps).
function playHunt(h: Hunt, seed: number, reaction: number | null) {
  const rng = makeRng(seed)
  for (let i = 0; i < 60 * 60 && !huntTally(h).done; i++) {
    stepHunt(h, DT, rng)
    for (const b of h.bugs) {
      const inside = b.x >= 0 && b.x <= 1 && b.y >= 0 && b.y <= 1
      if (reaction !== null && b.state === 'crawling' && inside && b.since >= reaction) squash(b)
    }
  }
}

describe('Bug Hunt', () => {
  it('gives every bug a fair stretch on screen, even with the jitters', () => {
    for (let seed = 0; seed < 100; seed++) {
      for (const sev of SEVERITIES) {
        const h = makeHunt(makeRng(seed), sev, 1.2)
        const rng = makeRng(seed + 1)
        const seen = new Map<number, number>()
        for (let i = 0; i < 60 * 40 && !h.bugs.every((b) => b.state === 'escaped'); i++) {
          stepHunt(h, DT, rng, 1.35, 1)
          for (const b of h.bugs) if (b.state === 'crawling' && b.x >= 0 && b.x <= 1 && b.y >= 0 && b.y <= 1) seen.set(b.id, (seen.get(b.id) ?? 0) + DT)
        }
        for (const b of h.bugs) expect(seen.get(b.id) ?? 0, `seed ${seed} ${sev} bug ${b.id}`).toBeGreaterThan(1)
      }
    }
  })

  it('passes a quick player and fails an idle one', () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const sev of SEVERITIES) {
        const quick = makeHunt(makeRng(seed), sev, 1)
        playHunt(quick, seed, 0.6)
        expect(huntTally(quick).pass, `seed ${seed} ${sev}`).toBe(true)

        const idle = makeHunt(makeRng(seed), sev, 1)
        playHunt(idle, seed, null)
        const t = huntTally(idle)
        expect(t.done).toBe(true)
        expect(t.pass).toBe(false)
      }
    }
  })

  it('ends as soon as too many bugs get away', () => {
    const h = makeHunt(makeRng(3), 'P1', 1)
    playHunt(h, 3, null)
    const t = huntTally(h)
    expect(t.escaped).toBe(t.total - t.needed + 1)
  })
})

describe('Spaghetti Unravel', () => {
  it('always starts tangled and always has an untangled solution', () => {
    for (let seed = 0; seed < 300; seed++) {
      for (const sev of SEVERITIES) {
        const p = makePuzzle(makeRng(seed), sev)
        expect(crossings(p.solution, p.edges).count, `seed ${seed} ${sev}`).toBe(0)
        expect(crossings(p.nodes, p.edges).count, `seed ${seed} ${sev}`).toBeGreaterThanOrEqual(2)
        for (const pt of p.nodes) {
          expect(pt.x).toBeGreaterThan(0)
          expect(pt.x).toBeLessThan(1)
        }
      }
    }
  })

  it('never repeats an edge', () => {
    for (let seed = 0; seed < 100; seed++) {
      const p = makePuzzle(makeRng(seed), 'P0')
      const keys = p.edges.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })
})
