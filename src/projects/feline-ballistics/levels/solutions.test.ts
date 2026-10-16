// Replays the recorded solutions through the real physics -- the regression
// check to run after any physics or level change.
import { describe, expect, it } from 'vitest'
import { GameWorld } from '../game/world'
import { ALL_LEVELS } from './index'
import { SOLUTIONS } from './solutions'

describe('Feline Ballistics recorded solutions', () => {
  it('has a recorded solution for every level', () => {
    expect(ALL_LEVELS.filter((l) => !SOLUTIONS[l.id]).map((l) => l.id)).toEqual([])
  })

  it.each(ALL_LEVELS.map((l) => [l.id, l] as const))('%s is won by its recorded shots', (id, level) => {
    const world = new GameWorld(level)
    for (const shot of SOLUTIONS[id] ?? []) {
      expect(world.launch(shot)).toBe(true)
      world.runShot()
      if (world.phase === 'won') break
    }
    expect(world.phase).toBe('won')
    expect(world.stars).toBeGreaterThan(0)
  })
})
