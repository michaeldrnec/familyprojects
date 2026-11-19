// The Code Stork mini-game's rules: a cartoon C-section in five steps, all in
// a 600 × 420 board (the component scales it to fit). It is bloodless by
// design: a draped tummy, a glowing seam, clear blue fluid bubbles and a
// swaddled baby. No React or DOM here.
//
//   1. Incision: trace the dotted smile line without straying off it.
//   2. Suction: pop the blue fluid bubbles to clear the view.
//   3. Deliver: hold the baby and draw them up the curved path, gently.
//   4. Clamp & cut: tap both clamps on the cord, then swipe between them.
//   5. Suture: tap the stitch points in order to close up.
//
// Each step scores 0.2..1; the procedure's quality is the average. A step
// left too long gets finished by the nurse at the lowest score, so nobody
// is ever stuck.

export const BOARD_W = 600
export const BOARD_H = 420

export const STORK_STEPS = [
  { id: 'incision', title: 'Incision', hint: 'Trace the dotted line from the green dot. Stay on it!' },
  { id: 'suction', title: 'Suction', hint: 'Tap the blue bubbles to clear the view.' },
  { id: 'deliver', title: 'Deliver', hint: 'Hold the baby and gently draw them up the path.' },
  { id: 'clamp', title: 'Clamp & cut', hint: 'Tap both clamps, then swipe between them to cut.' },
  { id: 'suture', title: 'Suture', hint: 'Tap the stitch points in order to close.' },
] as const

export type StepId = (typeof STORK_STEPS)[number]['id']

export interface Pt {
  x: number
  y: number
}

// --- Geometry ---------------------------------------------------------------------

export interface Curve {
  pts: Pt[]
  lens: number[] // cumulative length at each point
  length: number
}

function bezier(p0: Pt, p1: Pt, p2: Pt, n = 48): Curve {
  const pts: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const u = 1 - t
    pts.push({ x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y })
  }
  const lens = [0]
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  return { pts, lens, length: lens[lens.length - 1] }
}

// The point a fraction `t` (by length) along the curve.
export function pointAt(c: Curve, t: number): Pt {
  const target = Math.min(1, Math.max(0, t)) * c.length
  for (let i = 1; i < c.pts.length; i++) {
    if (c.lens[i] >= target) {
      const seg = c.lens[i] - c.lens[i - 1] || 1
      const f = (target - c.lens[i - 1]) / seg
      return { x: c.pts[i - 1].x + (c.pts[i].x - c.pts[i - 1].x) * f, y: c.pts[i - 1].y + (c.pts[i].y - c.pts[i - 1].y) * f }
    }
  }
  return c.pts[c.pts.length - 1]
}

// The nearest point on the curve: its fraction along it and the distance away.
export function project(c: Curve, p: Pt): { t: number; dist: number } {
  let best = { t: 0, dist: Infinity }
  for (let i = 1; i < c.pts.length; i++) {
    const a = c.pts[i - 1]
    const b = c.pts[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy || 1
    const f = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
    const dist = Math.hypot(a.x + dx * f - p.x, a.y + dy * f - p.y)
    if (dist < best.dist) best = { t: (c.lens[i - 1] + (c.lens[i] - c.lens[i - 1]) * f) / c.length, dist }
  }
  return best
}

function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): number | null {
  // Where along c→d (0..1) the segment a→b crosses it, or null.
  const r = { x: b.x - a.x, y: b.y - a.y }
  const s = { x: d.x - c.x, y: d.y - c.y }
  const den = r.x * s.y - r.y * s.x
  if (Math.abs(den) < 1e-9) return null
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? u : null
}

// Where a swipe from a to b crosses the curve (fraction along it), if it does.
export function crossing(c: Curve, a: Pt, b: Pt): number | null {
  for (let i = 1; i < c.pts.length; i++) {
    const u = segmentsCross(a, b, c.pts[i - 1], c.pts[i])
    if (u !== null) return (c.lens[i - 1] + (c.lens[i] - c.lens[i - 1]) * u) / c.length
  }
  return null
}

// The board's fixed shapes.
export const TUMMY = { x: 300, y: 250, rx: 235, ry: 150 }
export const WINDOW = { x: 300, y: 262, rx: 150, ry: 85 }
export const OPENING = { x: 300, y: 270, rx: 112, ry: 48 }
export const INCISION = bezier({ x: 200, y: 262 }, { x: 300, y: 318 }, { x: 400, y: 262 })
export const LIFT_PATH = bezier({ x: 300, y: 282 }, { x: 350, y: 150 }, { x: 205, y: 78 })
export const CORD = bezier({ x: 232, y: 104 }, { x: 420, y: 150 }, { x: 318, y: 276 })
export const CLAMP_AT = [0.36, 0.64] as const
export const STITCH_COUNT = 8

export const INCISION_TOLERANCE = 20
const INCISION_GRAB = 40
const INCISION_JUMP = 0.18 // largest step along the line one move may take
const BUBBLES_TOTAL = 10
const BUBBLES_AT_START = 4
const BUBBLE_EVERY = 0.45
const BUBBLE_HIT = 12 // extra reach around a bubble, for fingers
const BABY_GRAB = 52
const LIFT_LEASH = 80 // how far the finger may wander from the path
const LIFT_JUMP = 0.14
export const LIFT_MAX_SPEED = 300 // px/s: faster than this is too rough
const LIFT_GRACE = 3 // seconds before the baby's oxygen starts to dip
const LIFT_DRAIN = 0.12 // score lost per second after that
const CLAMP_HIT = 30
const STITCH_HIT = 28
const STEP_LIMIT = 25 // seconds before the nurse steps in
const STEP_PAUSE = 0.9 // seconds the ✓ shows between steps

export function stitchPoint(i: number): Pt {
  const t = 0.07 + (0.86 * i) / (STITCH_COUNT - 1)
  const p = pointAt(INCISION, t)
  const q = pointAt(INCISION, Math.min(1, t + 0.01))
  const len = Math.hypot(q.x - p.x, q.y - p.y) || 1
  const side = i % 2 === 0 ? -1 : 1
  return { x: p.x + (-(q.y - p.y) / len) * 17 * side, y: p.y + ((q.x - p.x) / len) * 17 * side }
}

// --- State --------------------------------------------------------------------------

export interface Bubble {
  x: number
  y: number
  r: number
  age: number
  popped: number // seconds since popped, -1 if not
}

export interface Note {
  text: string
  x: number
  y: number
  good: boolean
  age: number
}

export interface Stork {
  step: number // index into STORK_STEPS; STORK_STEPS.length when done
  stepTime: number
  pause: number // the ✓ between steps
  scores: number[]
  helped: boolean[] // the nurse finished that step
  notes: Note[]
  done: boolean
  pointer: Pt | null // where the finger is while it's down

  // 1. Incision
  cut: number // 0..1 along the line
  tracing: boolean
  wobbles: number
  // 2. Suction
  bubbles: Bubble[]
  spawned: number
  spawnTimer: number
  misses: number
  // 3. Deliver
  lift: number // 0..1 along the path
  holding: boolean
  moved: number // px moved since the last step
  speed: number // smoothed px/s
  overspeed: number // seconds spent too fast
  // 4. Clamp & cut
  clamps: [boolean, boolean]
  swipeFrom: Pt | null
  wrongCuts: number
  snipped: boolean
  // 5. Suture
  stitches: number
  wrong: number

  rand: () => number
}

export function makeStork(rand: () => number): Stork {
  const s: Stork = {
    step: 0,
    stepTime: 0,
    pause: 0,
    scores: [],
    helped: [],
    notes: [],
    done: false,
    pointer: null,
    cut: 0,
    tracing: false,
    wobbles: 0,
    bubbles: [],
    spawned: 0,
    spawnTimer: 0,
    misses: 0,
    lift: 0,
    holding: false,
    moved: 0,
    speed: 0,
    overspeed: 0,
    clamps: [false, false],
    swipeFrom: null,
    wrongCuts: 0,
    snipped: false,
    stitches: 0,
    wrong: 0,
    rand,
  }
  return s
}

export function stepId(s: Stork): StepId | null {
  return s.done ? null : STORK_STEPS[s.step].id
}

// Is the board taking input (not between steps or finished)?
export function accepting(s: Stork): boolean {
  return !s.done && s.pause <= 0
}

function note(s: Stork, text: string, at: Pt, good: boolean) {
  s.notes.push({ text, x: at.x, y: at.y, good, age: 0 })
  if (s.notes.length > 6) s.notes.shift()
}

function clamp01(x: number) {
  return Math.min(1, Math.max(0.2, x))
}

function spawnBubble(s: Stork) {
  const a = s.rand() * Math.PI * 2
  const d = Math.sqrt(s.rand()) * 0.85
  s.bubbles.push({ x: OPENING.x + Math.cos(a) * OPENING.rx * d, y: OPENING.y + Math.sin(a) * OPENING.ry * d, r: 13, age: 0, popped: -1 })
  s.spawned++
}

// The score for the current step as things stand.
export function stepScore(s: Stork): number {
  const t = s.stepTime
  switch (stepId(s)) {
    case 'incision':
      return clamp01(1 - 0.18 * s.wobbles - Math.max(0, t - 6) * 0.04)
    case 'suction':
      return clamp01(1 - Math.max(0, t - 5) * 0.07 - s.misses * 0.04)
    case 'deliver':
      return clamp01(1 - Math.max(0, t - LIFT_GRACE) * LIFT_DRAIN - s.overspeed * 0.6)
    case 'clamp':
      return clamp01(1 - s.misses * 0.08 - s.wrongCuts * 0.25 - Math.max(0, t - 6) * 0.05)
    case 'suture':
      return clamp01(1 - s.wrong * 0.12 - Math.max(0, t - 7) * 0.05)
    default:
      return 0
  }
}

// How much baby oxygen the delivery step shows (100 while within the grace time).
export function liftOxygen(s: Stork): number {
  return Math.max(0, 100 - Math.max(0, s.stepTime - LIFT_GRACE) * LIFT_DRAIN * 100)
}

function finishStep(s: Stork, helped: boolean) {
  s.scores.push(helped ? 0.2 : stepScore(s))
  s.helped.push(helped)
  s.pause = STEP_PAUSE
  s.tracing = false
  s.holding = false
  s.swipeFrom = null
  s.misses = 0
}

function startStep(s: Stork) {
  s.step++
  s.stepTime = 0
  if (s.step >= STORK_STEPS.length) {
    s.done = true
    return
  }
  if (stepId(s) === 'suction') {
    s.bubbles = []
    s.spawned = 0
    for (let i = 0; i < BUBBLES_AT_START; i++) spawnBubble(s)
    s.spawnTimer = BUBBLE_EVERY
  }
}

// Has the current step's goal been reached (ignoring the pause)?
function stepComplete(s: Stork): boolean {
  switch (stepId(s)) {
    case 'incision':
      return s.cut >= 0.97
    case 'suction':
      return s.spawned >= BUBBLES_TOTAL && s.bubbles.every((b) => b.popped >= 0)
    case 'deliver':
      return s.lift >= 0.97
    case 'clamp':
      return s.snipped
    case 'suture':
      return s.stitches >= STITCH_COUNT
    default:
      return false
  }
}

export function stepStork(s: Stork, dt: number) {
  if (s.done) return
  for (const n of s.notes) n.age += dt
  s.notes = s.notes.filter((n) => n.age < 1)
  for (const b of s.bubbles) {
    if (b.popped >= 0) b.popped += dt
    else {
      b.age += dt
      b.r = Math.min(26, 13 + b.age * 6)
    }
  }
  if (s.pause > 0) {
    s.pause -= dt
    if (s.pause <= 0) {
      s.pause = 0
      startStep(s)
    }
    return
  }
  s.stepTime += dt

  if (stepId(s) === 'suction' && s.spawned < BUBBLES_TOTAL) {
    s.spawnTimer -= dt
    if (s.spawnTimer <= 0) {
      spawnBubble(s)
      s.spawnTimer = BUBBLE_EVERY
    }
  }
  if (stepId(s) === 'deliver') {
    const inst = dt > 0 ? s.moved / dt : 0
    s.moved = 0
    s.speed += (inst - s.speed) * Math.min(1, dt * 8)
    if (s.holding && s.speed > LIFT_MAX_SPEED) s.overspeed += dt
  }

  if (stepComplete(s)) finishStep(s, false)
  else if (s.stepTime >= STEP_LIMIT) finishStep(s, true)
}

// --- Input (board coordinates) ---------------------------------------------------------

export function storkDown(s: Stork, p: Pt) {
  s.pointer = p
  if (!accepting(s)) return
  switch (stepId(s)) {
    case 'incision': {
      const at = pointAt(INCISION, s.cut)
      if (Math.hypot(p.x - at.x, p.y - at.y) <= INCISION_GRAB) s.tracing = true
      break
    }
    case 'suction': {
      let hit: Bubble | null = null
      for (const b of s.bubbles) {
        if (b.popped < 0 && Math.hypot(p.x - b.x, p.y - b.y) <= b.r + BUBBLE_HIT) {
          hit = b
          break
        }
      }
      if (hit) hit.popped = 0
      else s.misses++
      break
    }
    case 'deliver': {
      const at = pointAt(LIFT_PATH, s.lift)
      if (Math.hypot(p.x - at.x, p.y - at.y) <= BABY_GRAB) s.holding = true
      break
    }
    case 'clamp': {
      if (s.clamps[0] && s.clamps[1]) {
        s.swipeFrom = p
        break
      }
      const i = CLAMP_AT.findIndex((t, k) => {
        const c = pointAt(CORD, t)
        return !s.clamps[k] && Math.hypot(p.x - c.x, p.y - c.y) <= CLAMP_HIT
      })
      if (i >= 0) {
        s.clamps[i] = true
        note(s, 'Clamped!', pointAt(CORD, CLAMP_AT[i]), true)
      } else s.misses++
      break
    }
    case 'suture': {
      const next = stitchPoint(s.stitches)
      if (Math.hypot(p.x - next.x, p.y - next.y) <= STITCH_HIT) {
        s.stitches++
        break
      }
      for (let i = s.stitches + 1; i < STITCH_COUNT; i++) {
        const q = stitchPoint(i)
        if (Math.hypot(p.x - q.x, p.y - q.y) <= STITCH_HIT) {
          s.wrong++
          note(s, 'In order!', q, false)
          break
        }
      }
      break
    }
  }
}

export function storkMove(s: Stork, p: Pt) {
  const last = s.pointer
  s.pointer = p
  if (!accepting(s) || !last) return
  switch (stepId(s)) {
    case 'incision': {
      if (!s.tracing) return
      const pr = project(INCISION, p)
      if (pr.dist > INCISION_TOLERANCE) {
        s.tracing = false
        s.wobbles++
        note(s, 'Off the line!', p, false)
        return
      }
      if (pr.t > s.cut && pr.t - s.cut <= INCISION_JUMP) s.cut = pr.t
      break
    }
    case 'deliver': {
      if (!s.holding) return
      const pr = project(LIFT_PATH, p)
      if (pr.dist > LIFT_LEASH) {
        s.holding = false
        return
      }
      if (pr.t > s.lift) {
        const t = Math.min(pr.t, s.lift + LIFT_JUMP)
        s.moved += (t - s.lift) * LIFT_PATH.length
        s.lift = t
        if (s.speed > LIFT_MAX_SPEED && s.overspeed > 0.15 && !s.notes.some((n) => n.text === 'Gently!')) note(s, 'Gently!', p, false)
      }
      break
    }
  }
}

export function storkUp(s: Stork, p: Pt | null) {
  const end = p ?? s.pointer
  s.pointer = null
  s.tracing = false
  s.holding = false
  if (!accepting(s) || stepId(s) !== 'clamp' || !s.swipeFrom || !end) {
    s.swipeFrom = null
    return
  }
  const from = s.swipeFrom
  s.swipeFrom = null
  if (Math.hypot(end.x - from.x, end.y - from.y) < 14) return
  const t = crossing(CORD, from, end)
  if (t === null) return
  if (t > CLAMP_AT[0] && t < CLAMP_AT[1]) {
    s.snipped = true
    note(s, 'Snip!', pointAt(CORD, t), true)
  } else {
    s.wrongCuts++
    note(s, 'Between the clamps!', pointAt(CORD, t), false)
  }
}

// 0..1 for the whole surgery.
export function storkQuality(s: Stork): number {
  if (!s.scores.length) return 0
  return s.scores.reduce((a, b) => a + b, 0) / STORK_STEPS.length
}
