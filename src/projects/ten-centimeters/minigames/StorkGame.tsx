// The Code Stork mini-game: a cartoon C-section in five steps (see stork.ts
// for the rules). Bloodless by design: a draped tummy, a glowing seam, blue
// fluid bubbles and a swaddled baby.
import { useRef, useState, type PointerEvent } from 'react'
import { makeRng } from '../../../shared/rng'
import { pointerPos, useCanvasLoop } from '../../../shared/useCanvasLoop'
import * as audio from '../audio'
import { lookFor } from '../render/drawFloor'
import type { Patient } from '../sim/types'
import { drawBaby, fitBoard, text, toBoard, type BoardView } from './drawing'
import {
  BOARD_H,
  BOARD_W,
  CLAMP_AT,
  CORD,
  INCISION,
  INCISION_TOLERANCE,
  LIFT_MAX_SPEED,
  LIFT_PATH,
  OPENING,
  STITCH_COUNT,
  STORK_STEPS,
  TUMMY,
  WINDOW,
  liftOxygen,
  makeStork,
  pointAt,
  stepStork,
  stitchPoint,
  storkDown,
  storkMove,
  storkQuality,
  storkUp,
  type Curve,
  type Stork,
} from './stork'

const LINGER = 1.4

interface Tally {
  step: number
  wobbles: number
  popped: number
  misses: number
  clamps: number
  snipped: boolean
  wrongCuts: number
  stitches: number
  wrong: number
  cut: number
}

function tally(s: Stork): Tally {
  return {
    step: s.scores.length,
    wobbles: s.wobbles,
    popped: s.bubbles.filter((b) => b.popped >= 0).length,
    misses: s.misses,
    clamps: s.clamps.filter(Boolean).length,
    snipped: s.snipped,
    wrongCuts: s.wrongCuts,
    stitches: s.stitches,
    wrong: s.wrong,
    cut: s.cut,
  }
}

// Sounds for whatever just changed.
function sounds(a: Tally, b: Tally, s: Stork) {
  if (b.step > a.step) {
    if (s.helped[s.helped.length - 1]) audio.oops()
    else audio.stepDone()
  }
  if (b.wobbles > a.wobbles || b.wrongCuts > a.wrongCuts || b.wrong > a.wrong) audio.oops()
  if (b.popped > a.popped) audio.bubblePop()
  if (b.clamps > a.clamps) audio.clamp()
  if (b.snipped && !a.snipped) audio.snip()
  if (b.stitches > a.stitches) audio.stitch()
  if (Math.floor(b.cut * 12) > Math.floor(a.cut * 12)) audio.scalpel()
}

export default function StorkGame({
  patient,
  seed,
  frozen,
  reducedMotion,
  onDone,
  onStep,
}: {
  patient: Patient
  seed: number
  frozen: () => boolean
  reducedMotion: boolean
  onDone: (quality: number) => void
  onStep: (step: number) => void
}) {
  const [game] = useState(() => makeStork(makeRng(seed).next))
  const view = useRef<BoardView>({ scale: 1, ox: 0, oy: 0 })
  const finish = useRef<{ age: number; reported: boolean } | null>(null)
  const shownStep = useRef(0)
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const stepRef = useRef(onStep)
  stepRef.current = onStep
  const look = lookFor(patient.name)

  function withSounds(fn: () => void) {
    const before = tally(game)
    fn()
    sounds(before, tally(game), game)
  }

  const canvasRef = useCanvasLoop((ctx, w, h, dt, time) => {
    if (!frozen()) {
      withSounds(() => stepStork(game, dt))
      if (game.done && !finish.current) {
        finish.current = { age: 0, reported: false }
        audio.delivered()
      }
      if (finish.current) {
        finish.current.age += dt
        if (finish.current.age >= LINGER && !finish.current.reported) {
          finish.current.reported = true
          doneRef.current(storkQuality(game))
        }
      }
      const shown = Math.min(game.step, STORK_STEPS.length - 1)
      if (shown !== shownStep.current) {
        shownStep.current = shown
        stepRef.current(shown)
      }
    }
    view.current = fitBoard(w, h)
    drawStork(ctx, w, h, view.current, game, look, time, reducedMotion, !!finish.current)
  })

  function pos(e: PointerEvent<HTMLCanvasElement>) {
    const p = pointerPos(e, canvasRef.current)
    return toBoard(view.current, p.x, p.y)
  }

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (frozen()) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const p = pos(e)
    withSounds(() => storkDown(game, p))
  }
  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (frozen() || !game.pointer) return
    const p = pos(e)
    withSounds(() => storkMove(game, p))
  }
  function onPointerUp(e: PointerEvent<HTMLCanvasElement>) {
    const p = pos(e)
    withSounds(() => storkUp(game, frozen() ? null : p))
  }

  return (
    <div className="tc-mini">
      <canvas
        ref={canvasRef}
        className="tc-mini-canvas is-surgery"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label="Code Stork surgery"
      />
    </div>
  )
}

// --- Drawing ------------------------------------------------------------------------

function strokeCurve(ctx: CanvasRenderingContext2D, c: Curve, from = 0, to = 1) {
  const pts = c.pts
  const a = Math.floor(from * (pts.length - 1))
  const b = Math.ceil(to * (pts.length - 1))
  ctx.beginPath()
  const start = pointAt(c, from)
  ctx.moveTo(start.x, start.y)
  for (let i = a + 1; i < b; i++) ctx.lineTo(pts[i].x, pts[i].y)
  const end = pointAt(c, to)
  ctx.lineTo(end.x, end.y)
  ctx.stroke()
}

function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, pulse: number) {
  ctx.fillStyle = color
  ctx.globalAlpha = 0.3
  ctx.beginPath()
  ctx.arc(x, y, r * (1.6 + pulse * 0.4), 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

function drawStork(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  v: BoardView,
  s: Stork,
  look: { skin: string },
  time: number,
  reducedMotion: boolean,
  finished: boolean,
) {
  const pulse = reducedMotion ? 0.5 : (Math.sin(time * 5) + 1) / 2
  const step = s.done ? STORK_STEPS.length : s.step
  ctx.fillStyle = '#0f3d3a'
  ctx.fillRect(0, 0, w, h)
  ctx.save()
  ctx.translate(v.ox, v.oy)
  ctx.scale(v.scale, v.scale)

  // The surgical light.
  const light = ctx.createRadialGradient(300, 250, 40, 300, 250, 330)
  light.addColorStop(0, 'rgba(255, 255, 240, 0.22)')
  light.addColorStop(1, 'rgba(255, 255, 240, 0)')
  ctx.fillStyle = light
  // Past the board's edges too, so the glow fades out without a hard edge.
  ctx.fillRect(-BOARD_W, -BOARD_H, BOARD_W * 3, BOARD_H * 3)

  // The drape over the tummy, and the window in it.
  ctx.fillStyle = '#5eead4'
  ctx.beginPath()
  ctx.ellipse(TUMMY.x, TUMMY.y, TUMMY.rx, TUMMY.ry, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(15, 61, 58, 0.25)'
  ctx.lineWidth = 3
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath()
    ctx.ellipse(TUMMY.x, TUMMY.y, TUMMY.rx - i * 18, TUMMY.ry - i * 12, 0, Math.PI * 1.05, Math.PI * 1.95)
    ctx.stroke()
  }
  ctx.fillStyle = look.skin
  ctx.beginPath()
  ctx.ellipse(WINDOW.x, WINDOW.y, WINDOW.rx, WINDOW.ry, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 4
  ctx.stroke()

  const opened = step >= 1 && step <= 3
  const closing = step >= 4

  if (step === 0) {
    // 1. Incision: the guide band, the dotted line, and the cut so far.
    ctx.lineCap = 'round'
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
    ctx.lineWidth = INCISION_TOLERANCE * 2
    strokeCurve(ctx, INCISION)
    ctx.strokeStyle = '#475569'
    ctx.lineWidth = 3
    ctx.setLineDash([6, 8])
    strokeCurve(ctx, INCISION, s.cut, 1)
    ctx.setLineDash([])
    if (s.cut > 0) {
      ctx.strokeStyle = 'rgba(244, 114, 182, 0.45)'
      ctx.lineWidth = 12
      strokeCurve(ctx, INCISION, 0, s.cut)
      ctx.strokeStyle = '#fbcfe8'
      ctx.lineWidth = 4
      strokeCurve(ctx, INCISION, 0, s.cut)
    }
    const end = pointAt(INCISION, 1)
    glowDot(ctx, end.x, end.y, 7, '#f472b6', 0)
    const at = pointAt(INCISION, s.cut)
    if (!s.done && s.step === 0) glowDot(ctx, at.x, at.y, s.tracing ? 8 : 11, '#22c55e', s.tracing ? 0 : pulse)
  }

  if (opened) {
    // The open seam, with the baby waiting inside.
    const g = ctx.createRadialGradient(OPENING.x, OPENING.y, 10, OPENING.x, OPENING.y, OPENING.rx)
    g.addColorStop(0, '#fce7f3')
    g.addColorStop(1, '#f9a8d4')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(OPENING.x, OPENING.y, OPENING.rx, OPENING.ry, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#fbcfe8'
    ctx.lineWidth = 6
    ctx.stroke()
    // Retractors
    ctx.fillStyle = '#cbd5e1'
    ctx.fillRect(OPENING.x - 20, OPENING.y - OPENING.ry - 16, 40, 14)
    ctx.fillRect(OPENING.x - 20, OPENING.y + OPENING.ry + 2, 40, 14)
  }

  if (step === 1) {
    drawBaby(ctx, LIFT_PATH.pts[0].x, LIFT_PATH.pts[0].y, 50, look.skin)
    for (const b of s.bubbles) {
      if (b.popped >= 0) {
        if (b.popped > 0.35) continue
        ctx.strokeStyle = `rgba(147, 197, 253, ${1 - b.popped / 0.35})`
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.r + b.popped * 50, 0, Math.PI * 2)
        ctx.stroke()
        continue
      }
      ctx.fillStyle = 'rgba(96, 165, 250, 0.85)'
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
      ctx.beginPath()
      ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.25, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  if (step === 2) {
    // 3. Deliver: the path up and out, the baby on it.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.lineWidth = 3
    ctx.setLineDash([4, 9])
    strokeCurve(ctx, LIFT_PATH, s.lift, 1)
    ctx.setLineDash([])
    const end = pointAt(LIFT_PATH, 1)
    ctx.strokeStyle = '#fde68a'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(end.x, end.y, 30, 0, Math.PI * 2)
    ctx.stroke()
    const at = pointAt(LIFT_PATH, s.lift)
    if (!s.holding) glowDot(ctx, at.x, at.y, 30, 'rgba(253, 230, 138, 0.6)', pulse)
    drawBaby(ctx, at.x, at.y, 50, look.skin, { angle: -s.lift * 0.6 })
    // Baby's oxygen and the gentleness gauge.
    const o2 = liftOxygen(s)
    gauge(ctx, 470, 56, 'Baby O₂', o2 / 100, o2 > 60 ? '#22c55e' : o2 > 30 ? '#f59e0b' : '#ef4444')
    const fast = s.speed / LIFT_MAX_SPEED
    gauge(ctx, 470, 96, s.holding && fast > 1 ? 'Too fast!' : 'Gentle', Math.min(1, fast / 1.5), fast > 1 ? '#ef4444' : '#38bdf8')
  }

  if (step >= 3 && !finished) {
    // The baby is out: up in the corner, with the cord.
    const end = pointAt(LIFT_PATH, 1)
    if (step === 3) {
      ctx.strokeStyle = '#c4b5fd'
      ctx.lineWidth = 10
      ctx.lineCap = 'round'
      if (s.snipped) {
        const mid = (CLAMP_AT[0] + CLAMP_AT[1]) / 2
        strokeCurve(ctx, CORD, 0, mid - 0.03)
        strokeCurve(ctx, CORD, mid + 0.03, 1)
      } else {
        strokeCurve(ctx, CORD)
      }
      ctx.strokeStyle = '#ddd6fe'
      ctx.lineWidth = 3
      ctx.setLineDash([2, 10])
      strokeCurve(ctx, CORD)
      ctx.setLineDash([])
      CLAMP_AT.forEach((t, i) => {
        const c = pointAt(CORD, t)
        if (s.clamps[i]) {
          ctx.fillStyle = '#94a3b8'
          ctx.save()
          ctx.translate(c.x, c.y)
          ctx.rotate(-0.5)
          ctx.fillRect(-16, -5, 32, 10)
          ctx.fillStyle = '#e2e8f0'
          ctx.fillRect(-16, -2, 32, 4)
          ctx.restore()
        } else {
          ctx.strokeStyle = '#fde047'
          ctx.lineWidth = 3
          ctx.setLineDash([5, 5])
          ctx.beginPath()
          ctx.arc(c.x, c.y, 18 + pulse * 4, 0, Math.PI * 2)
          ctx.stroke()
          ctx.setLineDash([])
        }
      })
      if (s.clamps[0] && s.clamps[1] && !s.snipped) {
        const mid = pointAt(CORD, (CLAMP_AT[0] + CLAMP_AT[1]) / 2)
        text(ctx, '✂️', mid.x + 34, mid.y - 8, 26, '#ffffff')
        if (s.swipeFrom && s.pointer) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.moveTo(s.swipeFrom.x, s.swipeFrom.y)
          ctx.lineTo(s.pointer.x, s.pointer.y)
          ctx.stroke()
        }
      }
    }
    drawBaby(ctx, end.x, end.y, 50, look.skin, { awake: s.snipped || step >= 4 })
  }

  if (closing) {
    // 5. Suture: the seam with its stitch points.
    ctx.strokeStyle = '#f9a8d4'
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    strokeCurve(ctx, INCISION)
    ctx.strokeStyle = '#1e3a8a'
    ctx.lineWidth = 3
    if (s.stitches > 1) {
      ctx.beginPath()
      for (let i = 0; i < s.stitches; i++) {
        const p = stitchPoint(i)
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
    }
    for (let i = 0; i < STITCH_COUNT; i++) {
      const p = stitchPoint(i)
      if (i < s.stitches) {
        ctx.fillStyle = '#1e3a8a'
        ctx.beginPath()
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
        ctx.fill()
      } else if (i === s.stitches && !s.done) {
        glowDot(ctx, p.x, p.y, 9, '#22c55e', pulse)
        text(ctx, String(i + 1), p.x, p.y, 11, '#052e16', 800)
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
        ctx.beginPath()
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2)
        ctx.fill()
        text(ctx, String(i + 1), p.x, p.y, 9, '#334155', 700)
      }
    }
  }

  for (const n of s.notes) {
    ctx.globalAlpha = 1 - n.age
    text(ctx, n.text, n.x, n.y - 26 - (reducedMotion ? 0 : n.age * 24), 17, n.good ? '#bbf7d0' : '#fecaca', 800)
  }
  ctx.globalAlpha = 1

  if (s.pause > 0 && !s.done) {
    const last = s.scores[s.scores.length - 1] ?? 0
    const helped = s.helped[s.helped.length - 1]
    ctx.fillStyle = 'rgba(15, 61, 58, 0.55)'
    ctx.fillRect(0, BOARD_H / 2 - 34, BOARD_W, 68)
    text(ctx, helped ? 'The nurse helped out' : last >= 0.85 ? '✓ Excellent!' : last >= 0.55 ? '✓ Nice work' : '✓ Done', BOARD_W / 2, BOARD_H / 2, 28, '#fde68a', 800)
  }

  if (finished) {
    ctx.fillStyle = 'rgba(15, 61, 58, 0.8)'
    ctx.fillRect(0, 0, BOARD_W, BOARD_H)
    const bob = reducedMotion ? 0 : Math.sin(time * 6) * 3
    drawBaby(ctx, BOARD_W / 2, 190 + bob, 90, look.skin, { awake: true })
    text(ctx, 'Code Stork complete! 👶', BOARD_W / 2, 320, 28, '#fde68a', 800)
  }
  ctx.restore()
}

function gauge(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, f: number, color: string) {
  text(ctx, label, x + 50, y - 12, 12, '#e2e8f0', 700)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.7)'
  ctx.beginPath()
  ctx.roundRect(x, y, 100, 10, 5)
  ctx.fill()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(x, y, Math.max(6, 100 * Math.min(1, Math.max(0, f))), 10, 5)
  ctx.fill()
}
