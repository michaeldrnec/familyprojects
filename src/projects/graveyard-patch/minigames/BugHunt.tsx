import { useRef, useState } from 'react'
import { makeRng } from '../../../shared/rng'
import { pointerPos, useCanvasLoop } from '../../../shared/useCanvasLoop'
import * as audio from '../audio'
import { CODE_LINES } from '../content'
import type { Severity } from '../sim/config'
import type { MiniEnv } from './env'
import { huntTally, makeHunt, squash, stepHunt, type Bug } from './hunt'

const HIT_R = 32 // px, generous for fingers
const BUG_SIZE = 30
const LINGER = 0.7 // seconds the result shows before handing back
const CAT_FROM = 0.3 // the cat covers this slice of the board's width
const CAT_TO = 0.62

interface Mark {
  x: number
  y: number
  text: string
  color: string
  age: number
}

// Bugs crawl across your code; tap each one before it gets off the screen.
export default function BugHunt({
  severity,
  seed,
  speed,
  env,
  onDone,
}: {
  severity: Severity
  seed: number
  speed: number
  env: () => MiniEnv
  onDone: (success: boolean) => void
}) {
  const [hunt] = useState(() => makeHunt(makeRng(seed), severity, speed))
  const [rng] = useState(() => makeRng(seed ^ 0x5bd1e995))
  const marks = useRef<Mark[]>([])
  const result = useRef<{ pass: boolean; age: number; reported: boolean } | null>(null)
  const size = useRef({ w: 1, h: 1 })
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  const toPx = (b: Bug) => ({ x: b.x * size.current.w, y: b.y * size.current.h })
  const underCat = (x: number) => x > CAT_FROM * size.current.w && x < CAT_TO * size.current.w

  function tap(px: number, py: number) {
    const e = env()
    if (e.frozen || result.current) return
    audio.thock(e.sleep)
    let x = px
    let y = py
    // Sleepy hands: the tap lands a little off where you aimed.
    if (rng.next() < e.mistap) {
      const a = rng.range(0, Math.PI * 2)
      x += Math.cos(a) * HIT_R * 1.4
      y += Math.sin(a) * HIT_R * 1.4
      marks.current.push({ x: px, y: py, text: 'sleepy tap!', color: '#fb923c', age: 0 })
    }
    if (e.catOnScreen && underCat(x)) {
      marks.current.push({ x, y, text: 'cat in the way!', color: '#fcd34d', age: 0 })
      return
    }
    let best: Bug | null = null
    let bestD = HIT_R
    for (const b of hunt.bugs) {
      if (b.state !== 'crawling') continue
      const p = toPx(b)
      const d = Math.hypot(p.x - x, p.y - y)
      if (d < bestD) {
        bestD = d
        best = b
      }
    }
    if (best) {
      squash(best)
      audio.hit()
      const p = toPx(best)
      marks.current.push({ x: p.x, y: p.y, text: 'squashed!', color: '#4ade80', age: 0 })
    }
  }

  const canvasRef = useCanvasLoop((ctx, w, h, dt) => {
    size.current = { w, h }
    const e = env()
    if (!e.frozen) {
      if (!result.current) {
        if (stepHunt(hunt, dt, rng, e.tempo, e.tempo > 1 ? 1 : 0)) audio.miss()
        const t = huntTally(hunt)
        if (t.done) result.current = { pass: t.pass, age: 0, reported: false }
      } else {
        result.current.age += dt
        if (result.current.age >= LINGER && !result.current.reported) {
          result.current.reported = true
          doneRef.current(result.current.pass)
        }
      }
      for (const m of marks.current) m.age += dt
      marks.current = marks.current.filter((m) => m.age < 0.7)
    }

    // The code the bugs are crawling over.
    ctx.fillStyle = '#0b1020'
    ctx.fillRect(0, 0, w, h)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = '13px ui-monospace, Consolas, monospace'
    const lineH = 22
    for (let i = 0, y = 44; y < h - 6; i++, y += lineH) {
      ctx.fillStyle = 'rgba(148,163,184,0.35)'
      ctx.fillText(String(i + 1).padStart(2, ' '), 8, y)
      ctx.fillStyle = 'rgba(148,163,184,0.28)'
      ctx.fillText(CODE_LINES[i % CODE_LINES.length], 36, y)
    }

    ctx.textAlign = 'center'
    for (const b of hunt.bugs) {
      if (b.state === 'waiting' || b.state === 'escaped') continue
      const { x, y } = toPx(b)
      if (b.state === 'squashed') {
        if (b.since > 0.5) continue
        ctx.globalAlpha = 1 - b.since / 0.5
        ctx.font = `${BUG_SIZE}px system-ui`
        ctx.fillStyle = '#fff'
        ctx.fillText('✨', x, y)
        ctx.globalAlpha = 1
        continue
      }
      // A soft glow so dark bugs stand out on the dark editor, and a little scuttle wobble.
      ctx.fillStyle = 'rgba(250, 204, 21, 0.2)'
      ctx.beginPath()
      ctx.arc(x, y, BUG_SIZE * 0.75, 0, Math.PI * 2)
      ctx.fill()
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(Math.sin(b.since * 18 + b.id) * 0.18)
      ctx.font = `${BUG_SIZE}px system-ui`
      // Color emoji take the fill's transparency, so draw them with an opaque one.
      ctx.fillStyle = '#fff'
      ctx.fillText(b.kind, 0, 0)
      ctx.restore()
    }

    if (e.catOnScreen) {
      const x0 = CAT_FROM * w
      const x1 = CAT_TO * w
      ctx.fillStyle = 'rgba(120, 86, 52, 0.92)'
      ctx.beginPath()
      ctx.roundRect(x0, 36, x1 - x0, h - 42, 24)
      ctx.fill()
      ctx.font = `${Math.min(64, (x1 - x0) * 0.6)}px system-ui`
      ctx.fillStyle = '#fff'
      ctx.fillText('🐈', (x0 + x1) / 2, h / 2)
      ctx.font = '600 12px system-ui, sans-serif'
      ctx.fillStyle = '#fde68a'
      ctx.fillText('pet the cat to move it', (x0 + x1) / 2, h / 2 + 44)
    }

    for (const m of marks.current) {
      ctx.globalAlpha = 1 - m.age / 0.7
      ctx.fillStyle = m.color
      ctx.font = '700 14px system-ui, sans-serif'
      ctx.fillText(m.text, m.x, m.y - 24 - m.age * 30)
    }
    ctx.globalAlpha = 1

    if (hunt.time < 2.5 && !result.current) {
      ctx.globalAlpha = Math.min(1, (2.5 - hunt.time) * 2)
      ctx.fillStyle = 'rgba(11,16,32,0.8)'
      ctx.fillRect(0, h / 2 - 22, w, 44)
      ctx.fillStyle = '#fde68a'
      ctx.font = '700 17px system-ui, sans-serif'
      ctx.fillText('Tap the bugs before they crawl away!', w / 2, h / 2)
      ctx.globalAlpha = 1
    }

    const t = huntTally(hunt)
    ctx.fillStyle = 'rgba(11,16,32,0.9)'
    ctx.fillRect(0, 0, w, 30)
    ctx.textAlign = 'left'
    ctx.font = '600 13px ui-monospace, Consolas, monospace'
    ctx.fillStyle = t.squashed >= t.needed ? '#4ade80' : '#e5e7eb'
    ctx.fillText(`squashed ${t.squashed}/${t.needed}`, 10, 16)
    ctx.textAlign = 'right'
    ctx.fillStyle = t.escaped ? '#f87171' : '#8b8fa3'
    ctx.fillText(`${t.escaped} got away · ${t.total - t.needed} allowed`, w - 10, 16)

    if (result.current) {
      ctx.fillStyle = 'rgba(11,16,32,0.7)'
      ctx.fillRect(0, 0, w, h)
      ctx.textAlign = 'center'
      ctx.font = '800 26px system-ui, sans-serif'
      ctx.fillStyle = result.current.pass ? '#4ade80' : '#f87171'
      ctx.fillText(result.current.pass ? 'ALL CLEAR ✓' : 'TOO MANY GOT AWAY', w / 2, h / 2)
    }
  })

  return (
    <canvas
      ref={canvasRef}
      className="gp-minigame-canvas"
      aria-label="Bug Hunt: tap or click each bug before it crawls off the screen"
      onPointerDown={(e) => {
        e.preventDefault()
        const p = pointerPos(e, canvasRef.current)
        tap(p.x, p.y)
      }}
    />
  )
}
