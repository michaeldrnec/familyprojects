import { describe, expect, it } from 'vitest'
import { canSee } from './intruder'
import { IDLE, placeGhost, placeIntruder, quietWorld } from './testWorld'
import { newWorld, roundResult, stepWorld } from './world'

describe('Snaxley', () => {
  it('sees what’s in front of him, not what’s behind', () => {
    const w = quietWorld()
    placeIntruder(w, 9, 7, 1, 0)
    expect(canSee(w, 12, 7)).toBe(true)
    expect(canSee(w, 6, 7)).toBe(false)
    expect(canSee(w, 9, 5)).toBe(false) // round the corner
  })

  it('notices a ghost lingering in his headlamp', () => {
    const w = quietWorld()
    placeIntruder(w, 9, 7, 1, 0)
    w.intruder.status.frozen = 10
    const g = placeGhost(w, 'blush', 12, 7)
    w.active = 0
    for (let t = 0; t < 1.5; t += 1 / 30) stepWorld(w, IDLE, 1 / 30)
    expect(g.seen).toBeGreaterThan(1)
    expect(g.spotted).toBe(true)
  })

  it('heads for the front door at 100% fear, and the ghosts win', () => {
    const w = quietWorld()
    w.fear = 100
    for (let t = 0; t < 120 && !w.over; t += 1 / 30) stepWorld(w, IDLE, 1 / 30)
    expect(w.over).toBe('won')
    expect(roundResult(w).stars).toBe(3)
  })

  it('plays out the same round from the same seed', () => {
    const a = newWorld(3, 'spooky', 42)
    const b = newWorld(3, 'spooky', 42)
    for (let i = 0; i < 60 * 40; i++) {
      stepWorld(a, null, 1 / 60)
      stepWorld(b, null, 1 / 60)
    }
    expect(b.fear).toBe(a.fear)
    expect(b.sweetsLeft).toBe(a.sweetsLeft)
    expect(b.intruder.cur).toBe(a.intruder.cur)
  })

  it('handles big frames the same as small ones (up to the step size)', () => {
    const w = newWorld(1, 'spooky', 3)
    stepWorld(w, null, 0.25)
    expect(w.time).toBeCloseTo(0.25)
  })
})
