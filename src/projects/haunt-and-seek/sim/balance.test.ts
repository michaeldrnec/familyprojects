// The balance check, like graveyard-patch's night bot. Every manor must be:
//   - lost when no ghost does anything (Snaxley eats everything, never stuck),
//   - mostly lost when the player sits idle and only the helpers haunt,
//   - won on Spooky by the bot (helpers plus one ghost played like a person,
//     swapping ghost every 20 s), and won comfortably on Little Ghost.
// The bot is a floor, not the target: a person aiming Swoops and using
// ultimates on purpose does better.
import { describe, expect, it } from 'vitest'
import { MANORS, type DifficultyId } from './config'
import { IDLE } from './testWorld'
import { newWorld, roundResult, stepWorld } from './world'

const SEEDS = [1, 2, 3, 4, 5]
const LIMIT = 900

function play(manor: number, difficulty: DifficultyId, seed: number, mode: 'nobody' | 'helpers' | 'bot') {
  const w = newWorld(manor, difficulty, seed)
  if (mode === 'nobody') w.helpers = false
  let stall = 0
  let since = 0
  let last = -1
  while (!w.over && w.time < LIMIT) {
    if (mode === 'bot') w.active = Math.floor(w.time / 20) % w.ghosts.length
    stepWorld(w, mode === 'bot' ? null : IDLE, 1 / 30)
    const it = w.intruder
    since = it.cur === last ? since + 1 / 30 : 0
    last = it.cur
    if (it.state === 'forage' && it.rush <= 0) stall = Math.max(stall, since)
  }
  return { ...roundResult(w), stall, over: w.over }
}

describe.each(MANORS.map((m, i) => [m.name, i] as const))('%s', (_, manor) => {
  it('is lost if no ghost lifts a finger, with Snaxley never stuck', () => {
    const r = play(manor, 'spooky', 1, 'nobody')
    expect(r.over).toBe('lost')
    expect(r.time).toBeLessThan(400)
    expect(r.stall).toBeLessThan(5)
  })

  it('needs the player: helpers alone mostly lose', () => {
    const wins = SEEDS.slice(0, 4).filter((s) => play(manor, 'spooky', s, 'helpers').outcome === 'won').length
    expect(wins).toBeLessThanOrEqual(1)
  })

  it('is won on Spooky by the bot', () => {
    const rs = SEEDS.map((s) => play(manor, 'spooky', s, 'bot'))
    expect(rs.filter((r) => r.outcome === 'won').length).toBeGreaterThanOrEqual(4)
  })

  it('is won comfortably on Little Ghost', () => {
    const rs = SEEDS.map((s) => play(manor, 'little', s, 'bot'))
    expect(rs.every((r) => r.outcome === 'won')).toBe(true)
    expect(rs.reduce((a, r) => a + r.stars, 0) / rs.length).toBeGreaterThanOrEqual(2)
  })
})
