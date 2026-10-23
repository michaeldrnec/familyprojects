import { useRef, useState } from 'react'
import { makeRng } from '../../../shared/rng'
import { pointerPos, useCanvasLoop } from '../../../shared/useCanvasLoop'
import * as audio from '../audio'
import type { Severity } from '../sim/config'
import type { MiniEnv } from './env'
import { crossings, makePuzzle, type Point } from './unravel'

const PAD = 26
const NODE_R = 12
const GRAB_R = 30 // generous, for fingers
const LINGER = 0.7

// Drag the nodes until no two wires cross.
export default function SpaghettiUnravel({ severity, seed, env, onDone }: { severity: Severity; seed: number; env: () => MiniEnv; onDone: (success: boolean) => void }) {
  const [puzzle] = useState(() => makePuzzle(makeRng(seed), severity))
  const nodes = useRef<Point[]>(puzzle.nodes.map((p) => ({ ...p })))
  const timeLeft = useRef(puzzle.timeLimit)
  const drag = useRef<{ index: number; target: Point; pointer: number } | null>(null)
  const result = useRef<{ pass: boolean; age: number; reported: boolean } | null>(null)
  const size = useRef({ w: 1, h: 1 })
  const clock = useRef(0)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  const toBoard = (x: number, y: number): Point => {
    const { w, h } = size.current
    return {
      x: Math.max(0.03, Math.min(0.97, (x - PAD) / Math.max(1, w - PAD * 2))),
      y: Math.max(0.03, Math.min(0.97, (y - PAD) / Math.max(1, h - PAD * 2))),
    }
  }

  const canvasRef = useCanvasLoop((ctx, w, h, dt) => {
    size.current = { w, h }
    const e = env()
    const toPx = (p: Point) => ({ x: PAD + p.x * (w - PAD * 2), y: PAD + p.y * (h - PAD * 2) })

    if (!e.frozen) {
      clock.current += dt
      const d = drag.current
      if (d && !result.current) {
        // The jitters make your hand drift off where you aimed.
        const bw = Math.max(1, w - PAD * 2)
        const bh = Math.max(1, h - PAD * 2)
        const t = clock.current
        nodes.current[d.index] = {
          x: Math.max(0.03, Math.min(0.97, d.target.x + (Math.sin(t * 7.3) * e.wobble) / bw)),
          y: Math.max(0.03, Math.min(0.97, d.target.y + (Math.cos(t * 6.1) * e.wobble) / bh)),
        }
      }
      if (!result.current) {
        timeLeft.current -= dt
        if (!d && crossings(nodes.current, puzzle.edges).count === 0) result.current = { pass: true, age: 0, reported: false }
        else if (timeLeft.current <= 0) result.current = { pass: false, age: 0, reported: false }
      } else {
        result.current.age += dt
        if (result.current.age >= LINGER && !result.current.reported) {
          result.current.reported = true
          doneRef.current(result.current.pass)
        }
      }
    }

    ctx.fillStyle = '#0b1020'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    for (let gx = PAD; gx < w; gx += 28) {
      ctx.beginPath()
      ctx.moveTo(gx, 0)
      ctx.lineTo(gx, h)
      ctx.stroke()
    }

    const { count, tangled } = crossings(nodes.current, puzzle.edges)
    ctx.lineCap = 'round'
    puzzle.edges.forEach(([a, b], i) => {
      const pa = toPx(nodes.current[a])
      const pb = toPx(nodes.current[b])
      ctx.strokeStyle = tangled.has(i) ? '#f87171' : '#4ade80'
      ctx.lineWidth = tangled.has(i) ? 4 : 3
      ctx.beginPath()
      ctx.moveTo(pa.x, pa.y)
      ctx.lineTo(pb.x, pb.y)
      ctx.stroke()
    })
    nodes.current.forEach((p, i) => {
      const { x, y } = toPx(p)
      const held = drag.current?.index === i
      ctx.fillStyle = held ? '#fde68a' : '#e5e7eb'
      ctx.beginPath()
      ctx.arc(x, y, held ? NODE_R + 3 : NODE_R, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#0b1020'
      ctx.lineWidth = 3
      ctx.stroke()
    })

    // Time bar and crossing count.
    const frac = Math.max(0, timeLeft.current / puzzle.timeLimit)
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.fillRect(0, 0, w, 5)
    ctx.fillStyle = frac > 0.3 ? '#38bdf8' : '#f87171'
    ctx.fillRect(0, 0, w * frac, 5)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = '600 13px ui-monospace, Consolas, monospace'
    ctx.fillStyle = count === 0 ? '#4ade80' : '#e5e7eb'
    ctx.fillText(`crossings ${count} · ${Math.ceil(Math.max(0, timeLeft.current))}s`, 10, 18)

    if (result.current) {
      ctx.fillStyle = 'rgba(11,16,32,0.7)'
      ctx.fillRect(0, 0, w, h)
      ctx.textAlign = 'center'
      ctx.font = '800 26px system-ui, sans-serif'
      ctx.fillStyle = result.current.pass ? '#4ade80' : '#f87171'
      ctx.fillText(result.current.pass ? 'UNTANGLED ✓' : 'OUT OF TIME', w / 2, h / 2)
    }
  })

  return (
    <canvas
      ref={canvasRef}
      className="gp-minigame-canvas"
      aria-label="Spaghetti Unravel: drag the nodes until no wires cross"
      onPointerDown={(e) => {
        if (env().frozen || result.current) return
        const p = pointerPos(e, canvasRef.current)
        const { w, h } = size.current
        let best = -1
        let bestD = GRAB_R
        nodes.current.forEach((n, i) => {
          const d = Math.hypot(PAD + n.x * (w - PAD * 2) - p.x, PAD + n.y * (h - PAD * 2) - p.y)
          if (d < bestD) {
            bestD = d
            best = i
          }
        })
        if (best < 0) return
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { index: best, target: toBoard(p.x, p.y), pointer: e.pointerId }
        audio.pick()
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d || d.pointer !== e.pointerId) return
        const p = pointerPos(e, canvasRef.current)
        d.target = toBoard(p.x, p.y)
        const { frozen, wobble } = env()
        if (!frozen && wobble === 0) nodes.current[d.index] = d.target
      }}
      onPointerUp={(e) => {
        if (drag.current?.pointer !== e.pointerId) return
        drag.current = null
        audio.drop()
      }}
      onPointerCancel={() => {
        drag.current = null
      }}
    />
  )
}
