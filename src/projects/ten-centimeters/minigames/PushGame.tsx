// The delivery mini-game: a contraction marker sweeps across the push meter;
// push (tap, click, the button or Space) while it's in the green zone.
import { useEffect, useRef, useState } from 'react'
import { makeRng } from '../../../shared/rng'
import { useCanvasLoop } from '../../../shared/useCanvasLoop'
import * as audio from '../audio'
import { lookFor } from '../render/drawFloor'
import type { Patient } from '../sim/types'
import { drawBaby, fitBoard, text } from './drawing'
import { MAX_PUSHES, canPush, makePush, push, pushQuality, stepPush, type PushRating } from './push'
import { BOARD_W } from './stork'

const LINGER = 1.4 // seconds the new baby shows before handing back
const METER = { x: 60, y: 300, w: 480, h: 44 }
const RATING_TEXT: Record<PushRating, { text: string; color: string }> = {
  perfect: { text: 'Perfect push!', color: '#fde047' },
  good: { text: 'Good push!', color: '#86efac' },
  miss: { text: 'Not quite. Breathe…', color: '#fca5a5' },
}

export default function PushGame({
  patient,
  seed,
  frozen,
  reducedMotion,
  onDone,
}: {
  patient: Patient
  seed: number
  frozen: () => boolean
  reducedMotion: boolean
  onDone: (quality: number) => void
}) {
  const [rng] = useState(() => makeRng(seed))
  const [game] = useState(() => makePush(patient.maternalStress, patient.hasEpidural, rng.next))
  const feedback = useRef<{ rating: PushRating; age: number } | null>(null)
  const finish = useRef<{ age: number; reported: boolean } | null>(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const look = lookFor(patient.name)

  function doPush() {
    if (frozen() || !canPush(game)) return
    const r = push(game, rng.next)
    if (!r) return
    feedback.current = { rating: r, age: 0 }
    audio.pushResult(r)
    if (game.done) {
      finish.current = { age: 0, reported: false }
      audio.delivered()
    }
  }
  const pushRef = useRef(doPush)
  pushRef.current = doPush

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === ' ' && !e.repeat) pushRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const canvasRef = useCanvasLoop((ctx, w, h, dt, time) => {
    if (!frozen()) {
      const missed = stepPush(game, dt, rng.next)
      if (missed) {
        feedback.current = { rating: missed, age: 0 }
        audio.pushResult(missed)
        if (game.done) {
          finish.current = { age: 0, reported: false }
          audio.delivered()
        }
      }
      if (feedback.current) feedback.current.age += dt
      if (finish.current) {
        finish.current.age += dt
        if (finish.current.age >= LINGER && !finish.current.reported) {
          finish.current.reported = true
          doneRef.current(pushQuality(game))
        }
      }
    }
    const v = fitBoard(w, h)
    ctx.fillStyle = '#101a33'
    ctx.fillRect(0, 0, w, h)
    ctx.save()
    ctx.translate(v.ox, v.oy)
    ctx.scale(v.scale, v.scale)

    // Progress toward the baby.
    text(ctx, 'Baby is on the way', BOARD_W / 2, 22, 15, '#cbd5e1', 600)
    ctx.fillStyle = '#1e293b'
    ctx.beginPath()
    ctx.roundRect(100, 40, 400, 16, 8)
    ctx.fill()
    const grad = ctx.createLinearGradient(100, 0, 500, 0)
    grad.addColorStop(0, '#6366f1')
    grad.addColorStop(0.6, '#f472b6')
    grad.addColorStop(1, '#fbbf24')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.roundRect(100, 40, Math.max(16, (400 * game.progress) / 100), 16, 8)
    ctx.fill()
    drawBaby(ctx, 100 + (400 * game.progress) / 100, 46, 22, look.skin)

    drawMom(ctx, look, game.rest <= 0 && !game.done, time, reducedMotion)

    if (finish.current) {
      // The new arrival.
      ctx.fillStyle = 'rgba(16, 26, 51, 0.75)'
      ctx.fillRect(0, 0, BOARD_W, 420)
      const bob = reducedMotion ? 0 : Math.sin(time * 6) * 3
      drawBaby(ctx, BOARD_W / 2, 210 + bob, 90, look.skin, { awake: true })
      text(ctx, 'It’s a baby! 👶', BOARD_W / 2, 330, 30, '#fde68a', 800)
      ctx.restore()
      return
    }

    // The push meter.
    ctx.fillStyle = '#1e293b'
    ctx.strokeStyle = '#475569'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(METER.x, METER.y, METER.w, METER.h, 12)
    ctx.fill()
    ctx.stroke()
    const zx = METER.x + (game.zoneCenter - game.zoneWidth / 2) * METER.w
    const zw = game.zoneWidth * METER.w
    ctx.fillStyle = 'rgba(34, 197, 94, 0.55)'
    ctx.fillRect(zx, METER.y + 3, zw, METER.h - 6)
    ctx.fillStyle = 'rgba(253, 224, 71, 0.7)'
    const pw = zw * 0.35
    ctx.fillRect(METER.x + game.zoneCenter * METER.w - pw / 2, METER.y + 3, pw, METER.h - 6)

    const resting = game.rest > 0
    if (!resting) {
      const mx = METER.x + game.marker * METER.w
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(mx - 3, METER.y - 8, 6, METER.h + 16)
      ctx.fillStyle = '#f472b6'
      ctx.beginPath()
      ctx.moveTo(mx - 10, METER.y - 18)
      ctx.lineTo(mx + 10, METER.y - 18)
      ctx.lineTo(mx, METER.y - 6)
      ctx.closePath()
      ctx.fill()
    }
    text(ctx, resting ? (game.pushes.length ? 'Breathe…' : 'Get ready…') : 'PUSH in the green!', BOARD_W / 2, METER.y + METER.h + 26, 18, resting ? '#94a3b8' : '#fbcfe8', 800)
    text(ctx, `Push ${Math.min(game.pushes.length + 1, MAX_PUSHES)} of up to ${MAX_PUSHES}`, BOARD_W / 2, METER.y + METER.h + 52, 12, '#64748b', 600)

    const f = feedback.current
    if (f && f.age < 1.1) {
      ctx.globalAlpha = 1 - f.age / 1.1
      text(ctx, RATING_TEXT[f.rating].text, BOARD_W / 2, 270 - (reducedMotion ? 0 : f.age * 20), 24, RATING_TEXT[f.rating].color, 800)
      ctx.globalAlpha = 1
    }
    ctx.restore()
  })

  return (
    <div className="tc-mini">
      <canvas ref={canvasRef} className="tc-mini-canvas" onPointerDown={() => doPush()} aria-label="Push meter: push when the marker is in the green" />
      <button type="button" className="tc-primary tc-push-btn" onClick={doPush}>
        Push! <kbd>Space</kbd>
      </button>
    </div>
  )
}

// Mom, seen from the foot of the bed: a pillow, her face, and the blanket.
function drawMom(ctx: CanvasRenderingContext2D, look: { skin: string; hair: string }, pushing: boolean, time: number, reducedMotion: boolean) {
  const cx = BOARD_W / 2
  const strain = pushing && !reducedMotion ? Math.sin(time * 14) * 1.5 : 0
  // Bed
  ctx.fillStyle = '#e2e8f0'
  ctx.beginPath()
  ctx.roundRect(cx - 170, 90, 340, 180, 26)
  ctx.fill()
  // Pillow
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.ellipse(cx, 120, 90, 30, 0, 0, Math.PI * 2)
  ctx.fill()
  // Hair and face
  ctx.fillStyle = look.hair
  ctx.beginPath()
  ctx.arc(cx + strain, 128, 44, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = look.skin
  ctx.beginPath()
  ctx.arc(cx + strain, 136, 36, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#3b2414'
  ctx.lineCap = 'round'
  ctx.lineWidth = 3
  if (pushing) {
    // Eyes squeezed shut, brows down, a determined grimace.
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(cx + strain + side * 20, 128)
      ctx.lineTo(cx + strain + side * 8, 132)
      ctx.lineTo(cx + strain + side * 20, 136)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(cx + strain - 10, 152)
    ctx.lineTo(cx + strain + 10, 152)
    ctx.stroke()
  } else {
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(cx + side * 13, 132, 5, 0.15 * Math.PI, 0.85 * Math.PI)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(cx, 146, 8, 0.2 * Math.PI, 0.8 * Math.PI)
    ctx.stroke()
  }
  // Blanket over the bump
  ctx.fillStyle = '#a5b4fc'
  ctx.beginPath()
  ctx.moveTo(cx - 160, 270)
  ctx.lineTo(cx - 160, 200)
  ctx.quadraticCurveTo(cx, 120, cx + 160, 200)
  ctx.lineTo(cx + 160, 270)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 2
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.moveTo(cx - 140 + i * 20, 230 + i * 12)
    ctx.quadraticCurveTo(cx, 170 + i * 14, cx + 140 - i * 20, 230 + i * 12)
    ctx.stroke()
  }
}
