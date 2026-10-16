// Execute: tick-by-tick playback of a finished simulation. The sim has
// already decided everything; this screen only scrubs a continuous time
// `tau` over its snapshots, so pause, step, 2x and scrubbing are free.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import * as audio from './audio'
import { drawBattlefield } from './render/battlefield'
import { PHASE_T, type SimResult } from './sim'
import type { Level } from './types'
import { useCanvasLoop } from '../../shared/useCanvasLoop'
import { usePauseOnHide } from '../../shared/usePauseOnHide'

const SECONDS_PER_TICK = 1.2
const TAIL = 0.6 // let the last explosions play out before the debrief

interface Props {
  level: Level
  result: SimResult
  title: string
  debrief: ReactNode
  onEdit: () => void
}

export default function Execute({ level, result, title, debrief, onEdit }: Props) {
  const end = result.endTick + TAIL
  const tauRef = useRef(0)
  const [tau, setTau] = useState(0)
  const [playing, setPlaying] = useState(true)
  // Replays stop when the player leaves, so they don't miss the strike.
  usePauseOnHide(() => setPlaying(false), playing)
  const [speed, setSpeed] = useState(1)
  const [done, setDone] = useState(false)
  const playingRef = useRef(playing)
  playingRef.current = playing
  const speedRef = useRef(speed)
  speedRef.current = speed
  const logRef = useRef<HTMLOListElement | null>(null)

  function seek(t: number, sound = false) {
    const prev = tauRef.current
    const next = Math.max(0, Math.min(end, t))
    tauRef.current = next
    if (sound && next > prev) {
      const played = new Set<string>()
      for (const e of result.events) {
        const te = e.tick - 1 + PHASE_T[e.phase]
        if (te > prev && te <= next) {
          const cue = audio.cueFor(e.kind)
          if (cue && !played.has(cue)) {
            played.add(cue)
            audio.play(cue)
          }
        }
      }
    }
    if (Math.abs(next - tau) > 0.04 || next === end || next === 0) setTau(next)
    if (next >= end && !done) {
      setDone(true)
      setPlaying(false)
    }
  }

  const canvasRef = useCanvasLoop((ctx, w, h, dt, time) => {
    if (playingRef.current && tauRef.current < end) seek(tauRef.current + (dt / SECONDS_PER_TICK) * speedRef.current, true)
    drawBattlefield(ctx, w, h, { level, time, playback: { result, tau: tauRef.current } })
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault()
        setPlaying((p) => !p)
      } else if (e.key === 'ArrowRight') {
        setPlaying(false)
        seek(Math.floor(tauRef.current) + 1)
      } else if (e.key === 'ArrowLeft') {
        setPlaying(false)
        seek(Math.ceil(tauRef.current) - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const tick = Math.min(result.endTick, Math.floor(tau) + 1)
  const shown = result.events.filter((e) => e.tick - 1 + PHASE_T[e.phase] <= tau)

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [shown.length])

  function restart() {
    tauRef.current = 0
    setTau(0)
    setDone(false)
    setPlaying(true)
  }

  return (
    <div className="os-screen os-execute">
      <header className="os-bar">
        <button className="os-btn" onClick={onEdit}>
          ◀ Edit plan
        </button>
        <h2>{title}</h2>
        <span className="os-tick">
          Tick {tick}/{level.ticks}
        </span>
      </header>
      <div className="os-exec-main">
        <div className="os-field">
          <canvas ref={canvasRef} />
          {done && <div className="os-debrief-wrap">{debrief}</div>}
        </div>
        <aside className="os-log-wrap">
          <h3>Event log</h3>
          <ol className="os-log" ref={logRef}>
            {shown.map((e, i) => (
              <li key={i} className={e.kind === 'win' ? 'win' : e.bad ? 'bad' : e.kind === 'destroy' ? 'good' : ''}>
                <b>T{e.tick}</b> {e.text}
              </li>
            ))}
          </ol>
        </aside>
      </div>
      <footer className="os-actions os-playbar">
        <button className="os-btn" onClick={() => (done ? restart() : setPlaying((p) => !p))} title="Play/pause (Space)">
          {done ? '↺ Replay' : playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button
          className="os-btn"
          onClick={() => {
            setPlaying(false)
            seek(Math.floor(tauRef.current) + 1)
          }}
          title="Step one tick (→)"
        >
          ⏭ Step
        </button>
        <button className={`os-btn ${speed === 2 ? 'on' : ''}`} onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}>
          2×
        </button>
        <input
          className="os-scrub"
          type="range"
          min={0}
          max={end}
          step={0.01}
          value={tau}
          aria-label="Scrub playback"
          onChange={(e) => {
            setPlaying(false)
            seek(Number(e.target.value))
          }}
        />
        <button className="os-btn" onClick={() => seek(end)} disabled={done}>
          ⏩ Skip
        </button>
      </footer>
    </div>
  )
}
