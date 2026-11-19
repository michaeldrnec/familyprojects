import { describe, expect, it } from 'vitest'
import { makeRng } from '../../../shared/rng'
import { CONTRACTION_SECONDS, MAX_PUSHES, canPush, makePush, push, pushQuality, rate, stepPush, type PushGame } from './push'
import {
  CLAMP_AT,
  CORD,
  INCISION,
  LIFT_PATH,
  STITCH_COUNT,
  STORK_STEPS,
  makeStork,
  pointAt,
  stepId,
  stepStork,
  stitchPoint,
  storkDown,
  storkMove,
  storkQuality,
  storkUp,
  type Pt,
  type Stork,
} from './stork'

const DT = 1 / 60

// --- Push meter -----------------------------------------------------------------

function waitFor(g: PushGame, want: (g: PushGame) => boolean, limit = 20) {
  for (let t = 0; t < limit && !(canPush(g) && want(g)); t += DT / 4) stepPush(g, DT / 4, () => 0.5)
}

describe('push meter', () => {
  it('three perfect pushes deliver the baby at full quality', () => {
    const rng = makeRng(1)
    const g = makePush(40, false, rng.next)
    for (let i = 0; i < 3; i++) {
      waitFor(g, (x) => rate(x) === 'perfect')
      expect(push(g, rng.next)).toBe('perfect')
    }
    expect(g.done).toBe(true)
    expect(pushQuality(g)).toBe(1)
  })

  it('ignores pushes while Mom catches her breath', () => {
    const rng = makeRng(2)
    const g = makePush(40, false, rng.next)
    expect(push(g, rng.next)).toBe(null)
    expect(g.pushes).toEqual([])
  })

  it('a string of misses still ends, with poor quality', () => {
    const rng = makeRng(3)
    const g = makePush(90, false, rng.next)
    for (let i = 0; i < MAX_PUSHES && !g.done; i++) {
      waitFor(g, (x) => rate(x) === 'miss')
      push(g, rng.next)
    }
    expect(g.done).toBe(true)
    expect(pushQuality(g)).toBeLessThan(0.5)
  })

  it('ends on its own if nobody pushes', () => {
    const rng = makeRng(5)
    const g = makePush(40, false, rng.next)
    for (let t = 0; t < (CONTRACTION_SECONDS + 1) * MAX_PUSHES + 5 && !g.done; t += DT) stepPush(g, DT, rng.next)
    expect(g.done).toBe(true)
    expect(g.pushes.every((p) => p === 'miss')).toBe(true)
  })

  it('a calm mom with an epidural gets a slower meter', () => {
    const rng = makeRng(4)
    expect(makePush(20, true, rng.next).speed).toBeLessThan(makePush(90, false, rng.next).speed)
  })
})

// --- Code Stork -------------------------------------------------------------------

function run(s: Stork, seconds: number) {
  for (let t = 0; t < seconds; t += DT) stepStork(s, DT)
}

function untilStep(s: Stork, index: number) {
  for (let i = 0; i < 600 && s.step < index && !s.done; i++) stepStork(s, DT)
}

function drag(s: Stork, path: Pt[], frameEvery = 1) {
  storkDown(s, path[0])
  path.slice(1).forEach((p, i) => {
    storkMove(s, p)
    if (i % frameEvery === 0) stepStork(s, DT)
  })
  storkUp(s, path[path.length - 1])
}

function along(curve: typeof INCISION, from: number, to: number, n: number): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => pointAt(curve, from + ((to - from) * i) / n))
}

function tap(s: Stork, p: Pt) {
  storkDown(s, p)
  storkUp(s, null)
}

function playWell(s: Stork) {
  // 1. Trace the line.
  drag(s, along(INCISION, 0, 1, 40))
  untilStep(s, 1)
  // 2. Pop bubbles as they appear.
  for (let i = 0; i < 400 && s.step === 1; i++) {
    const b = s.bubbles.find((x) => x.popped < 0)
    if (b) tap(s, b)
    stepStork(s, DT)
  }
  untilStep(s, 2)
  // 3. Lift the baby at a gentle pace (about 150 px/s).
  const steps = Math.ceil(LIFT_PATH.length / (150 * DT))
  drag(s, along(LIFT_PATH, 0, 1, steps))
  untilStep(s, 3)
  // 4. Clamp both, then swipe across the middle.
  for (const t of CLAMP_AT) tap(s, pointAt(CORD, t))
  const mid = pointAt(CORD, (CLAMP_AT[0] + CLAMP_AT[1]) / 2)
  drag(s, [
    { x: mid.x - 30, y: mid.y - 30 },
    { x: mid.x + 30, y: mid.y + 30 },
  ])
  untilStep(s, 4)
  // 5. Stitch in order.
  for (let i = 0; i < STITCH_COUNT; i++) tap(s, stitchPoint(i))
  untilStep(s, 5)
}

describe('Code Stork surgery', () => {
  it('a careful surgeon finishes all five steps with a high score', () => {
    const s = makeStork(makeRng(5).next)
    playWell(s)
    expect(s.done).toBe(true)
    expect(s.scores).toHaveLength(STORK_STEPS.length)
    expect(s.helped.every((h) => !h)).toBe(true)
    expect(storkQuality(s)).toBeGreaterThan(0.9)
  })

  it('straying off the incision line stops the cut and costs points', () => {
    const s = makeStork(makeRng(6).next)
    const start = pointAt(INCISION, 0)
    drag(s, [start, pointAt(INCISION, 0.1), { x: start.x + 60, y: start.y - 80 }])
    expect(s.wobbles).toBe(1)
    expect(s.cut).toBeLessThan(0.2)
    expect(s.cut).toBeGreaterThan(0.05)
    // Picking up from where it stopped works.
    drag(s, along(INCISION, s.cut, 1, 30))
    expect(s.cut).toBeGreaterThan(0.95)
  })

  it('jumping ahead along the line does not count', () => {
    const s = makeStork(makeRng(7).next)
    drag(s, [pointAt(INCISION, 0), pointAt(INCISION, 0.9)])
    expect(s.cut).toBe(0)
  })

  it('yanking the baby out too fast costs points', () => {
    const gentle = makeStork(makeRng(8).next)
    const rough = makeStork(makeRng(8).next)
    for (const s of [gentle, rough]) {
      s.step = 2
      s.stepTime = 0
    }
    drag(gentle, along(LIFT_PATH, 0, 1, Math.ceil(LIFT_PATH.length / (150 * DT))))
    drag(rough, along(LIFT_PATH, 0, 1, 12))
    run(gentle, 0.1)
    run(rough, 0.1)
    expect(stepId(gentle)).toBe('deliver')
    expect(rough.overspeed).toBeGreaterThan(0)
    expect(rough.scores[0]).toBeLessThan(gentle.scores[0])
  })

  it('cutting outside the clamps is refused', () => {
    const s = makeStork(makeRng(9).next)
    s.step = 3
    for (const t of CLAMP_AT) tap(s, pointAt(CORD, t))
    const outside = pointAt(CORD, 0.15)
    drag(s, [
      { x: outside.x - 30, y: outside.y - 30 },
      { x: outside.x + 30, y: outside.y + 30 },
    ])
    expect(s.snipped).toBe(false)
    expect(s.wrongCuts).toBe(1)
  })

  it('stitching out of order counts against you', () => {
    const s = makeStork(makeRng(10).next)
    s.step = 4
    storkDown(s, stitchPoint(3))
    expect(s.wrong).toBe(1)
    expect(s.stitches).toBe(0)
  })

  it('the nurse finishes a step left alone, so nobody gets stuck', () => {
    const s = makeStork(makeRng(11).next)
    run(s, 5 * 30)
    expect(s.done).toBe(true)
    expect(s.helped.every(Boolean)).toBe(true)
    expect(storkQuality(s)).toBeLessThan(0.5)
  })
})
