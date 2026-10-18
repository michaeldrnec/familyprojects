import { useEffect, useRef, useState } from 'react'
import { VIEW_H, VIEW_W, WEAPONS, WEAPON_ORDER } from './constants'
import { OVER_LINGER, newGame, stepGame, type GameState } from './game'
import { createInput, type FrameInput, type TouchHold, type TouchTap } from './input'
import { makeStars, render } from './render'
import { loadProgress, recordRun, type Progress } from './progress'
import { makeRng } from '../../shared/rng'
import * as audio from './audio'
import { useMuted } from '../../shared/audio'
import { usePauseOnHide } from '../../shared/usePauseOnHide'
import './InvaderProtocol.css'

type Phase = 'intro' | 'playing' | 'paused' | 'gameover'

// Fixed simulation step, so beat timing and the perfect-beat window behave
// the same at any frame rate.
const STEP = 1 / 120

interface RunSummary {
  score: number
  wave: number
  cause: GameState['over']
  shotsFired: number
  perfectShots: number
}

function InvaderProtocol() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [isNewBest, setIsNewBest] = useState(false)
  const [summary, setSummary] = useState<RunSummary | null>(null)
  const [muted, toggleSiteMute] = useMuted()

  const areaRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const phaseRef = useRef<Phase>('intro')
  const gsRef = useRef<GameState>(newGame(1))
  const starsRef = useRef(makeStars(makeRng(11)))
  const inputRef = useRef(createInput())

  function changePhase(next: Phase) {
    phaseRef.current = next
    setPhase(next)
  }

  function pause() {
    if (phaseRef.current !== 'playing') return
    audio.stopUfoHum()
    inputRef.current.reset()
    changePhase('paused')
  }

  usePauseOnHide(pause, phase === 'playing')

  function resume() {
    if (phaseRef.current !== 'paused') return
    audio.init()
    if (gsRef.current.ufo) audio.startUfoHum()
    changePhase('playing')
  }

  function finish(gs: GameState) {
    const result = recordRun(gs.score, gs.wave)
    setProgress(result.progress)
    setIsNewBest(result.isNewBest)
    setSummary({ score: gs.score, wave: gs.wave, cause: gs.over, shotsFired: gs.shotsFired, perfectShots: gs.perfectShots })
    changePhase('gameover')
  }

  // Keep the canvas at 16:9, as large as its container allows, with a
  // device-pixel-ratio backing store for crisp lines.
  useEffect(() => {
    const area = areaRef.current
    const canvas = canvasRef.current
    if (!area || !canvas) return
    function fit() {
      if (!area || !canvas) return
      const w = Math.min(area.clientWidth, (area.clientHeight * VIEW_W) / VIEW_H)
      const h = (w * VIEW_H) / VIEW_W
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(area)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const detach = inputRef.current.attach(canvas)
    return () => {
      detach()
      audio.stopUfoHum()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The main loop: poll input once per frame, run fixed substeps, draw.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let acc = 0
    function tick(now: number) {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const input = inputRef.current.poll()
      const current = phaseRef.current
      if (input.pause) {
        if (current === 'playing') pause()
        else if (current === 'paused') resume()
      }
      const gs = gsRef.current
      if (phaseRef.current === 'playing') {
        acc += dt
        // Edge-triggered actions apply on the first substep only.
        let frame: FrameInput = input
        while (acc >= STEP) {
          stepGame(gs, frame, STEP)
          frame = { ...input, dash: false, vent: false, cycle: 0, select: null, pause: false }
          acc -= STEP
        }
        if (gs.over && gs.overLinger >= OVER_LINGER) finish(gs)
      } else {
        acc = 0
      }

      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (canvas && ctx) {
        const scale = canvas.width / VIEW_W
        ctx.setTransform(scale, 0, 0, scale, 0, 0)
        render(ctx, gs, starsRef.current)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function start() {
    audio.init()
    audio.stopUfoHum()
    gsRef.current = newGame(Math.floor(Math.random() * 1_000_000_000))
    inputRef.current.reset()
    setIsNewBest(false)
    changePhase('playing')
  }

  function toggleMute() {
    audio.init()
    toggleSiteMute()
  }

  // On-screen controls feed the same InputController as the keyboard.
  // Pointer events (not touch events) so each finger is tracked separately.
  function bindHold(key: TouchHold) {
    const release = () => inputRef.current.setTouch(key, false)
    return {
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault()
        inputRef.current.setTouch(key, true)
      },
      onPointerUp: release,
      onPointerLeave: release,
      onPointerCancel: release,
    }
  }

  function bindTap(action: TouchTap) {
    return {
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault()
        inputRef.current.tap(action)
      },
    }
  }

  const accuracy = summary && summary.shotsFired > 0 ? Math.round((summary.perfectShots / summary.shotsFired) * 100) : 0

  return (
    <div className="invader-protocol fullscreen">
      <div className="ip-game-area" ref={areaRef}>
        <canvas ref={canvasRef} className="ip-canvas" />

        <div className="ip-corner-buttons">
          {phase === 'playing' && (
            <button type="button" className="ip-icon-btn" onClick={pause} aria-label="Pause">
              ⏸
            </button>
          )}
          <button type="button" className="ip-icon-btn" onClick={toggleMute} aria-label={muted ? 'Unmute sound' : 'Mute sound'}>
            {muted ? '🔇' : '🔊'}
          </button>
        </div>

        {phase === 'playing' && (
          <div className="ip-touch-controls" aria-hidden="true">
            <div className="ip-move-pad">
              <button type="button" className="ip-touch-btn ip-touch-move" {...bindHold('left')}>◀</button>
              <button type="button" className="ip-touch-btn ip-touch-move" {...bindHold('right')}>▶</button>
            </div>
            <div className="ip-touch-right">
              <div className="ip-weapon-chips">
                {WEAPON_ORDER.map((id, i) => (
                  <button
                    key={id}
                    type="button"
                    className="ip-touch-btn ip-chip"
                    style={{ borderColor: WEAPONS[id].color }}
                    onPointerDown={(e) => {
                      e.preventDefault()
                      inputRef.current.tapSelect(id)
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <div className="ip-action-pad">
                <button type="button" className="ip-touch-btn ip-touch-small" {...bindTap('vent')}>VENT</button>
                <button type="button" className="ip-touch-btn ip-touch-small" {...bindTap('dash')}>DASH</button>
                <button type="button" className="ip-touch-btn ip-touch-fire" {...bindHold('fire')}>FIRE</button>
              </div>
            </div>
          </div>
        )}

        {phase === 'intro' && (
          <div className="ip-overlay">
            <h1>Invader Protocol</h1>
            <p className="ip-tagline">
              The lattice marches on the beat, and the beat speeds up as they fall. Fire on the
              pulse for free, faster shots. Snap columns, decapitate commanders, and vent your
              bunkers when they're charged.
            </p>
            <ul className="ip-controls">
              <li className="ip-keys"><kbd>A</kbd>/<kbd>D</kbd> or <kbd>←</kbd>/<kbd>→</kbd> move · <kbd>Shift</kbd> dash</li>
              <li className="ip-keys"><kbd>Space</kbd> or left click: fire · <kbd>F</kbd> or right click: vent the bunker above you</li>
              <li className="ip-keys"><kbd>Q</kbd>/<kbd>E</kbd>, wheel, or <kbd>1</kbd>–<kbd>4</kbd> switch weapon · <kbd>Esc</kbd> pause</li>
              <li className="ip-keys">Gamepad: stick move · RT fire · A/LT dash · B vent · LB/RB or D-pad weapons</li>
              <li>Shots fired when the gold ring closes on your cannon cost no heat</li>
              <li>Your bunkers stop your shots too, so step out from under them to fire</li>
              <li>Every 5th wave, The Conductor arrives: knock out its two pods to break its shield</li>
            </ul>
            {progress.bestScore > 0 && (
              <p className="ip-best">
                Best: {progress.bestScore.toLocaleString()} pts · wave {progress.bestWave}
              </p>
            )}
            <p className="ip-touch-hint">On a touchscreen, on-screen controls appear once you start.</p>
            <button type="button" className="ip-primary" onClick={start}>
              Engage
            </button>
          </div>
        )}

        {phase === 'paused' && (
          <div className="ip-overlay">
            <h1>Paused</h1>
            <button type="button" className="ip-primary" onClick={resume}>
              Resume
            </button>
            <button type="button" className="ip-secondary" onClick={start}>
              Restart
            </button>
          </div>
        )}

        {phase === 'gameover' && summary && (
          <div className="ip-overlay">
            <h1>{summary.cause === 'invaded' ? 'Perimeter Breached' : 'Cannon Lost'}</h1>
            <p className="ip-tagline">
              Final score: <strong>{summary.score.toLocaleString()}</strong>
              {isNewBest && <span className="ip-new-best"> New best!</span>}
            </p>
            <p className="ip-tagline">
              Reached wave {summary.wave} · {summary.perfectShots} on-beat shots ({accuracy}%)
            </p>
            <p className="ip-best">
              Best: {progress.bestScore.toLocaleString()} pts · wave {progress.bestWave}
            </p>
            <button type="button" className="ip-primary" onClick={start}>
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default InvaderProtocol
