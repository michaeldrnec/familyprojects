import { describe, expect, it } from 'vitest'
import { ABILITIES } from './config'
import { canCast, castSlot, slotAbility } from './abilities'
import { hazardAt } from './hazards'
import { canEnter } from './intruder'
import { IDLE, freeze, placeGhost, placeIntruder, quietWorld } from './testWorld'
import { stepWorld } from './world'
import type { World } from './types'

// The Conservatory's long east-west hallway is row 7 (x 1..17). The wall
// above x = 5 has open floor beyond it.
const tile = (w: World, x: number, y: number) => y * w.maze.w + x

function run(w: World, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 30) stepWorld(w, IDLE, 1 / 30)
}

describe('casting', () => {
  it('spends ecto, starts the cooldown and refuses a repeat', () => {
    const w = quietWorld()
    placeIntruder(w, 15, 7)
    freeze(w)
    const g = placeGhost(w, 'ember', 3, 7, 0)
    w.ecto = 60
    expect(castSlot(w, g, 0)).toBe(true)
    expect(w.ecto).toBe(60 - ABILITIES.swoop.cost)
    run(w, 0.5)
    expect(canCast(w, g, 0)).toBe('cooldown')
    run(w, ABILITIES.swoop.cooldown)
    expect(canCast(w, g, 0)).toBe(null)
  })

  it('needs enough ecto', () => {
    const w = quietWorld()
    const g = placeGhost(w, 'ember', 3, 7)
    w.ecto = 5
    expect(canCast(w, g, 0)).toBe('ecto')
    expect(castSlot(w, g, 0)).toBe(false)
    expect(w.events.some((e) => e.type === 'denied')).toBe(true)
  })

  it('keeps ultimates locked until the Conservatory', () => {
    const w = quietWorld(0)
    w.ecto = 100
    expect(slotAbility(w, w.ghosts[0], 2)).toBe(null)
    expect(canCast(w, w.ghosts[0], 2)).toBe('locked')
  })

  it('swaps every ghost to the defense set during a Sugar Rush', () => {
    const w = quietWorld()
    const g = placeGhost(w, 'marm', 3, 7)
    w.intruder.rush = 5
    w.intruder.state = 'rush'
    expect([0, 1, 2].map((s) => slotAbility(w, g, s))).toEqual(['slip', 'decoy', 'dash'])
    w.fear = 20
    w.ecto = 50
    expect(castSlot(w, g, 2)).toBe(true)
    expect(w.fear).toBe(10)
    expect(g.boost).toBeGreaterThan(0)
  })
})

describe('Ember', () => {
  it('Swoops through a wall to the open floor beyond', () => {
    const w = quietWorld()
    placeIntruder(w, 15, 7)
    freeze(w)
    const g = placeGhost(w, 'ember', 5, 7, -Math.PI / 2)
    castSlot(w, g, 0)
    run(w, 0.5)
    expect(Math.round(g.y)).toBeLessThanOrEqual(5)
    expect(g.noclip).toBe(0)
  })

  it('scares him point-blank with a Swoop from behind', () => {
    const w = quietWorld()
    placeIntruder(w, 9, 7, 1, 0)
    freeze(w)
    const g = placeGhost(w, 'ember', 7, 7, 0)
    castSlot(w, g, 0)
    run(w, 0.4)
    expect(w.fear).toBeGreaterThan(10)
    expect(w.intruder.state).toBe('spooked')
  })

  it('snuffs the hallway he’s in and freezes him', () => {
    const w = quietWorld()
    placeIntruder(w, 12, 7)
    const g = placeGhost(w, 'ember', 6, 7)
    castSlot(w, g, 1)
    expect(w.snuff[tile(w, 12, 7)]).toBeGreaterThan(0)
    expect(w.intruder.status.frozen).toBeGreaterThan(1)
    expect(w.fear).toBeGreaterThan(0)
  })

  it('tiptoes behind him, then sends him running blind', () => {
    const w = quietWorld()
    placeIntruder(w, 12, 7)
    freeze(w)
    const g = placeGhost(w, 'ember', 8, 7)
    w.ecto = 100
    expect(castSlot(w, g, 2)).toBe(true)
    run(w, 3)
    expect(g.invisible).toBeGreaterThan(0)
    expect(Math.hypot(g.x - 11.1, g.y - 7)).toBeLessThan(0.3)
    run(w, 3.5)
    expect(g.invisible).toBe(0)
    expect(w.intruder.status.blind).toBeGreaterThan(0)
    expect(w.fear).toBeGreaterThan(20)
  })
})

describe('Blush', () => {
  it('hides in the wall and bursts out as he passes, knocking sweets loose', () => {
    const w = quietWorld()
    placeIntruder(w, 12, 7)
    freeze(w)
    const g = placeGhost(w, 'blush', 5, 7)
    for (const x of [8, 9, 10]) w.sweets[tile(w, x, 7)] = 0
    w.sweetsLeft -= 3
    expect(castSlot(w, g, 0)).toBe(true)
    expect(g.hidden).toBeGreaterThan(0)
    expect(g.hideDir).toEqual({ x: 0, y: -1 })
    placeIntruder(w, 6, 7, -1, 0)
    freeze(w)
    run(w, 0.1)
    expect(g.hidden).toBe(0)
    expect(w.fear).toBeGreaterThan(15)
    expect(w.sweetsLeft).toBe(w.sweetsTotal)
  })

  it('puts up a mirror wall he won’t walk into', () => {
    const w = quietWorld()
    placeIntruder(w, 15, 7)
    const g = placeGhost(w, 'blush', 9, 7, 0)
    expect(castSlot(w, g, 1, tile(w, 10, 7))).toBe(true)
    expect(canEnter(w, tile(w, 10, 7))).toBe(false)
    expect(castSlot(w, g, 1, tile(w, 15, 7))).toBe(false) // too far, and he's standing there
  })

  it('traps him in an Endless Hallway', () => {
    const w = quietWorld()
    placeIntruder(w, 12, 7)
    const g = placeGhost(w, 'blush', 9, 7)
    w.ecto = 100
    castSlot(w, g, 2)
    const x = w.intruder.x
    run(w, 3)
    expect(w.intruder.x).toBe(x)
    expect(w.fear).toBeGreaterThan(5)
  })
})

describe('Drizzle', () => {
  it('slime sends him skidding into the wall', () => {
    const w = quietWorld()
    const g = placeGhost(w, 'drizzle', 2, 7)
    castSlot(w, g, 0, tile(w, 4, 7))
    expect(hazardAt(w, tile(w, 4, 7), 'slime')).toBeDefined()
    placeIntruder(w, 3, 7, 1, 0)
    w.intruder.next = tile(w, 4, 7)
    w.intruder.p = 0.9
    const seen: string[] = []
    for (let t = 0; t < 8 && !seen.includes('bump'); t += 1 / 30) for (const e of stepWorld(w, IDLE, 1 / 30)) seen.push(e.type)
    expect(seen).toContain('skid')
    expect(seen).toContain('bump')
    expect(Math.round(w.intruder.x)).toBe(17)
    expect(w.fear).toBeGreaterThan(0)
  })

  it('a Trick Treat fizzes and confuses him', () => {
    const w = quietWorld()
    const g = placeGhost(w, 'drizzle', 2, 7)
    castSlot(w, g, 1, tile(w, 4, 7))
    placeIntruder(w, 3, 7, 1, 0)
    w.intruder.next = tile(w, 4, 7)
    w.intruder.p = 0.95
    const seen: string[] = []
    for (const e of stepWorld(w, IDLE, 1 / 30)) seen.push(e.type)
    expect(seen).toContain('fizz')
    expect(w.intruder.status.confused).toBeGreaterThan(2)
  })
})

describe('Marm', () => {
  it('thumps through a wall and knocks the sweet out of his paws', () => {
    const w = quietWorld()
    placeIntruder(w, 5, 7)
    freeze(w)
    w.intruder.status.munch = 0.1
    w.intruder.munchTile = tile(w, 5, 7)
    const g = placeGhost(w, 'marm', 5, 5)
    castSlot(w, g, 0)
    expect(w.intruder.status.munch).toBe(0)
    expect(w.intruder.status.noEat).toBeGreaterThan(1)
    expect(w.fear).toBeGreaterThan(5)
  })

  it('wails to make him look and go the other way', () => {
    const w = quietWorld()
    placeIntruder(w, 12, 7)
    const g = placeGhost(w, 'marm', 7, 7, 0)
    castSlot(w, g, 1)
    expect(w.intruder.alert).toBeGreaterThan(0)
    expect(w.danger[tile(w, 11, 7)]).toBeGreaterThan(0)
  })

  it('turns a crossroads into Gloom Goo that holds him', () => {
    const w = quietWorld()
    placeIntruder(w, 7, 7)
    const g = placeGhost(w, 'marm', 6, 7)
    w.ecto = 100
    castSlot(w, g, 2)
    expect(hazardAt(w, tile(w, 7, 7), 'goo')).toBeDefined()
    run(w, 3)
    expect(w.intruder.cur).toBe(tile(w, 7, 7))
    expect(w.fear).toBeGreaterThan(10)
  })
})
