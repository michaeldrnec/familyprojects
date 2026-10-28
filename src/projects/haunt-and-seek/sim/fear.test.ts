import { describe, expect, it } from 'vitest'
import { TUNING } from './config'
import { decayFear, dropSweets, loseFear, scare } from './fear'
import { freeze, placeIntruder, quietWorld } from './testWorld'

function setup() {
  const w = quietWorld()
  placeIntruder(w, 9, 7)
  freeze(w)
  w.active = 0 // Ember
  return w
}

const at = { x: 9, y: 7 }

describe('scares', () => {
  it('count in full from out of sight, with nothing eaten yet', () => {
    const w = setup()
    expect(scare(w, 'ember', 'swoop', 15, at)).toBeCloseTo(15)
    expect(w.fear).toBeCloseTo(15)
    expect(w.events.some((e) => e.type === 'scare')).toBe(true)
  })

  it('count half when he saw the ghost coming', () => {
    const w = setup()
    w.ghosts[0].seen = 1.5
    expect(scare(w, 'ember', 'swoop', 15, at)).toBeCloseTo(15 * TUNING.seenMul)
  })

  it('count less from a helper the player isn’t flying', () => {
    const w = setup()
    expect(scare(w, 'blush', 'wallflower', 10, at)).toBeCloseTo(10 * TUNING.helperScare)
  })

  it('wear off when the same trick is repeated', () => {
    const w = setup()
    scare(w, 'ember', 'swoop', 10, at)
    w.time += 5
    expect(scare(w, 'ember', 'swoop', 10, at)).toBeCloseTo(10 * TUNING.habitMul)
    w.time += 5
    expect(scare(w, 'ember', 'swoop', 10, at)).toBeCloseTo(10 * TUNING.habitMul ** 2)
    w.time += 60
    expect(scare(w, 'ember', 'swoop', 10, at)).toBeCloseTo(10)
  })

  it('make a Boo-Combo when a second ghost follows up quickly', () => {
    const w = setup()
    scare(w, 'blush', 'wallflower', 10, at)
    w.time += 1
    expect(scare(w, 'ember', 'swoop', 10, at)).toBeCloseTo(10 * TUNING.comboMul)
    expect(w.bestCombo).toBe(2)
    w.time += 10
    expect(scare(w, 'blush', 'mirror', 10, at)).toBeCloseTo(10 * TUNING.helperScare)
  })

  it('work less as he fills up', () => {
    const w = setup()
    w.sweetsLeft = w.sweetsTotal / 2
    expect(scare(w, 'ember', 'swoop', 10, at)).toBeCloseTo(10 * (1 - TUNING.bigResist / 2))
    expect(scare(w, 'ember', 'snuff', 10, { ...at, subtle: true })).toBeCloseTo(10 * (1 - TUNING.subtleResist / 2))
  })

  it('send him running for the door at 100%', () => {
    const w = setup()
    w.fear = 95
    scare(w, 'ember', 'swoop', 15, at)
    expect(w.fear).toBe(100)
    expect(w.intruder.state).toBe('flee')
    expect(scare(w, 'ember', 'snuff', 15, at)).toBe(0)
  })
})

describe('fear decay', () => {
  it('waits, then slides, but never below the last 25% step', () => {
    const w = setup()
    scare(w, 'ember', 'swoop', 30, at)
    expect(w.fearFloor).toBe(25)
    decayFear(w, 1)
    expect(w.fear).toBeCloseTo(30)
    w.time += TUNING.decayDelay + 1
    for (let i = 0; i < 100; i++) decayFear(w, 0.1)
    expect(w.fear).toBe(25)
  })

  it('can be spent past the step by a Desperation Dash, but not by a bonk', () => {
    const w = setup()
    w.fear = 30
    w.fearFloor = 25
    loseFear(w, 10, true)
    expect(w.fear).toBe(25)
    loseFear(w, 10, false)
    expect(w.fear).toBe(15)
    expect(w.fearFloor).toBe(0)
  })
})

describe('dropped sweets', () => {
  it('go back on empty floor nearby, but never more than he ate', () => {
    const w = setup()
    expect(w.sweetsLeft).toBe(w.sweetsTotal)
    dropSweets(w, 3, 9, 7)
    expect(w.sweetsLeft).toBe(w.sweetsTotal)
    // Pretend he ate the five sweets nearest him.
    const eaten = [6, 7, 8, 10, 11].map((x) => 7 * w.maze.w + x)
    for (const i of eaten) w.sweets[i] = 0
    w.sweetsLeft -= eaten.length
    dropSweets(w, 3, 9, 7)
    expect(w.sweetsLeft).toBe(w.sweetsTotal - 2)
    const drop = w.events.find((e) => e.type === 'drop')
    expect(drop?.type === 'drop' && drop.tiles.every((i) => Math.abs((i % w.maze.w) - 9) <= 3)).toBe(true)
  })
})
