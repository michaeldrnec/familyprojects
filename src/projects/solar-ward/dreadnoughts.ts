// Dreadnoughts (spec.md section 4): fixed posts around the rim that cycle
// telegraph -> fire -> cooldown. This module only decides *when* and *what
// kind* of thing fires (a beam, a fan of beams, or a fighter launch) --
// turning that into actual Beam/Fighter entities is the caller's job (see
// SolarWard.tsx), which keeps this module ignorant of those shapes.
import type { Rng } from './rng'

export const RIM_POST_COUNT = 8

export type DreadnoughtType = 'lancer' | 'siege'

export interface Dreadnought {
  id: number
  angle: number // fixed rim post angle
  type: DreadnoughtType
  state: 'telegraph' | 'cooldown'
  timer: number
}

export interface WaveTuning {
  telegraphTime: number
  fireIntervalMin: number
  fireIntervalMax: number
  fighterChance: number
}

// A siege dreadnought's 3-beam fan is one FireEvent carrying multiple
// angles, not three separate events -- so it counts once toward a wave's
// spawn quota (a siege shot is one "threat event" that happens to be
// harder to fully dodge), not three.
export type FireEvent = { kind: 'beam'; angles: number[] } | { kind: 'fighter'; angle: number }

export function rimPostAngle(index: number): number {
  return (index / RIM_POST_COUNT) * Math.PI * 2
}

export function spawnDreadnought(
  rng: Rng,
  id: number,
  postIndex: number,
  type: DreadnoughtType,
  tuning: WaveTuning,
): Dreadnought {
  return {
    id,
    angle: rimPostAngle(postIndex),
    type,
    state: 'cooldown',
    // Staggered initial cooldowns so a wave's dreadnoughts don't all fire
    // in lockstep the moment they spawn.
    timer: rng.range(0.4, tuning.fireIntervalMax),
  }
}

const SIEGE_FAN_SPREAD = 0.22 // radians between adjacent beams in a siege fan

// Advances every dreadnought by dt. `canFireMore` gates whether a
// dreadnought that finishes its cooldown is allowed to start a new
// telegraph -- once a wave's spawn quota is reached, dreadnoughts already
// mid-telegraph still finish (so a beam already "charging" always fires),
// but nothing new gets scheduled, so the board can actually go quiet and
// the wave can be marked cleared once it's empty.
export function stepDreadnoughts(
  dreadnoughts: Dreadnought[],
  dt: number,
  tuning: WaveTuning,
  rng: Rng,
  canFireMore: boolean,
): { dreadnoughts: Dreadnought[]; events: FireEvent[] } {
  const events: FireEvent[] = []
  const next = dreadnoughts.map((d) => {
    let { state, timer } = d
    timer -= dt
    if (timer > 0) return { ...d, timer }

    if (state === 'cooldown') {
      if (!canFireMore) {
        // Park indefinitely -- this wave is done scheduling new fire.
        return { ...d, timer: 999 }
      }
      state = 'telegraph'
      timer = tuning.telegraphTime
      return { ...d, state, timer }
    }

    // Telegraph finished: fire.
    if (rng.next() < tuning.fighterChance) {
      events.push({ kind: 'fighter', angle: d.angle })
    } else if (d.type === 'siege') {
      events.push({
        kind: 'beam',
        angles: [d.angle - SIEGE_FAN_SPREAD, d.angle, d.angle + SIEGE_FAN_SPREAD],
      })
    } else {
      events.push({ kind: 'beam', angles: [d.angle] })
    }
    state = 'cooldown'
    timer = rng.range(tuning.fireIntervalMin, tuning.fireIntervalMax)
    return { ...d, state, timer }
  })
  return { dreadnoughts: next, events }
}
