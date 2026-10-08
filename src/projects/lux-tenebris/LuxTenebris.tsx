import { useEffect, useMemo, useRef, useState } from 'react'
import { CHAPTERS, LEVELS, type Critter } from './levels'
import { parseLevel, type Point } from './tiles'
import { beamReach, initialState, step, type Action, type GameEvent, type PlayState } from './logic'
import { computeLight } from './light'
import { VIEW_H, VIEW_W, drawDarkness, drawEcho, drawEmissives, drawPlayer, drawTiles, layoutFor } from './render'
import { solve } from './solver'
import { DIFFICULTIES, isUnlocked, loadProgress, saveProgress, type DifficultyId, type Progress } from './progress'
import * as audio from './audio'
import './LuxTenebris.css'

type Screen = 'title' | 'select' | 'play' | 'clear'

const MOVE_INTERVAL = 0.11 // seconds between steps; one extra step is buffered
const SLIDE_TIME = 0.09
const ECHO_DURATION = 0.8
const FAIL_RESTART_DELAY = 1.1
const WIN_CARD_DELAY = 0.7
const SEEN_THRESHOLD = 0.12
const TORCH_MEMORY = 0.32
const LANTERN_MEMORY = 0.18
const PAR_TIME_FRACTION = 0.55 // the time star: finish within this share of the air
const PAR_STEP_SLACK = 2 // the steps star: within this many steps of the shortest route

const DIRS: Record<string, { dx: number; dy: number }> = {
  arrowup: { dx: 0, dy: -1 },
  w: { dx: 0, dy: -1 },
  arrowdown: { dx: 0, dy: 1 },
  s: { dx: 0, dy: 1 },
  arrowleft: { dx: -1, dy: 0 },
  a: { dx: -1, dy: 0 },
  arrowright: { dx: 1, dy: 0 },
  d: { dx: 1, dy: 0 },
}

// Where a glow-worm is at time t: walking its path back and forth.
function critterPos(c: Critter, t: number): Point {
  const n = c.path.length
  if (n === 1) return { x: c.path[0][0], y: c.path[0][1] }
  const period = 2 * (n - 1)
  const u = (t * c.speed) % period
  const seg = u <= n - 1 ? u : period - u
  const i = Math.min(n - 2, Math.floor(seg))
  const f = seg - i
  return { x: c.path[i][0] + (c.path[i + 1][0] - c.path[i][0]) * f, y: c.path[i][1] + (c.path[i + 1][1] - c.path[i][1]) * f }
}

function angleDiff(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

function starsFor(s: PlayState, shortest: number): number {
  let stars = 1
  if (s.steps <= shortest + PAR_STEP_SLACK) stars++
  if (s.timeLimit - s.time <= s.timeLimit * PAR_TIME_FRACTION) stars++
  return stars
}

interface ClearResult {
  stars: number
  steps: number
  shortest: number
  timeUsed: number
  parTime: number
  best: number
}

function LuxTenebris() {
  const [screen, setScreen] = useState<Screen>('title')
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [levelIndex, setLevelIndex] = useState(0)
  const [hud, setHud] = useState({ battery: 0, batteryMax: 1, time: 0, timeLimit: 1, echoes: 0, started: false, status: 'playing' })
  const [clear, setClear] = useState<ClearResult | null>(null)
  const [muted, setMuted] = useState(audio.isMuted())

  const level = LEVELS[levelIndex]
  const grid = useMemo(() => parseLevel(level.map), [level])
  const layout = useMemo(() => layoutFor(grid), [grid])
  const shortest = useMemo(() => solve(level).steps, [level])
  const difficulty = DIFFICULTIES.find((d) => d.id === progress.difficulty)!

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const maskRef = useRef<HTMLCanvasElement | null>(null)
  const screenRef = useRef<Screen>('title')
  const playRef = useRef<PlayState>(initialState(level, grid))
  const nowRef = useRef(0) // seconds since mount
  const levelStartRef = useRef(0)
  const slideRef = useRef({ fromX: grid.start.x, fromY: grid.start.y, t0: -1 })
  const angleRef = useRef(playRef.current.facing)
  const lightRef = useRef(new Float32Array(0))
  const brightRef = useRef(new Float32Array(0))
  const seenAtRef = useRef(new Float64Array(0))
  const mossSeenRef = useRef(new Set<number>())
  const echoRef = useRef<{ x: number; y: number; t0: number } | null>(null)
  const endRef = useRef<{ t0: number; handled: boolean } | null>(null)
  const lastMoveRef = useRef(-1)
  const bufferedRef = useRef<{ dx: number; dy: number } | null>(null)
  const heartRef = useRef(0)
  const holdRef = useRef<number | null>(null)

  useEffect(() => {
    screenRef.current = screen
  }, [screen])

  function syncHud(s: PlayState) {
    setHud({
      battery: s.battery,
      batteryMax: s.batteryMax,
      time: Math.ceil(s.time * 10) / 10,
      timeLimit: s.timeLimit,
      echoes: s.echoes,
      started: s.started,
      status: s.status,
    })
  }

  function resetLevel() {
    const s = initialState(level, grid, difficulty.timeScale)
    playRef.current = s
    angleRef.current = s.facing
    slideRef.current = { fromX: s.x, fromY: s.y, t0: -1 }
    const n = grid.w * grid.h
    lightRef.current = new Float32Array(n)
    brightRef.current = new Float32Array(n)
    seenAtRef.current = new Float64Array(n).fill(-Infinity)
    mossSeenRef.current = new Set()
    echoRef.current = null
    endRef.current = null
    bufferedRef.current = null
    levelStartRef.current = nowRef.current
    syncHud(s)
  }

  // A new level (or difficulty) always starts fresh.
  useEffect(() => {
    resetLevel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, difficulty.timeScale])

  function handleEvents(events: GameEvent[]) {
    const s = playRef.current
    for (const e of events) {
      if (e === 'step-stone') audio.footstep('stone')
      else if (e === 'step-plank') audio.footstep('plank')
      else if (e === 'step-water') audio.footstep('water')
      else if (e === 'bump') audio.bump()
      else if (e === 'cell') audio.cell()
      else if (e === 'key') audio.key()
      else if (e === 'toggle') audio.toggle()
      else if (e === 'echo') {
        audio.echo()
        echoRef.current = { x: s.x, y: s.y, t0: nowRef.current }
      } else if (e === 'fall' || e === 'timeout' || e === 'win') {
        if (e === 'fall') audio.fall()
        else if (e === 'timeout') audio.timeout()
        else audio.win()
        audio.setHum(false, 0)
        endRef.current = { t0: nowRef.current, handled: false }
      }
    }
  }

  function dispatch(action: Action) {
    const before = playRef.current
    const { state, events } = step(grid, before, action)
    playRef.current = state
    if (action.type === 'move' && (state.x !== before.x || state.y !== before.y)) {
      slideRef.current = { fromX: before.x, fromY: before.y, t0: nowRef.current }
    }
    handleEvents(events)
    if (action.type !== 'tick' || Math.ceil(state.time * 10) !== Math.ceil(before.time * 10) || state.status !== before.status) syncHud(state)
  }

  function tryMove(dx: number, dy: number) {
    if (screenRef.current !== 'play' || playRef.current.status !== 'playing') return
    if (nowRef.current - lastMoveRef.current < MOVE_INTERVAL) {
      bufferedRef.current = { dx, dy }
      return
    }
    lastMoveRef.current = nowRef.current
    dispatch({ type: 'move', dx, dy })
  }

  function aimAt(angle: number) {
    if (screenRef.current !== 'play' || playRef.current.status !== 'playing') return
    if (Math.abs(angleDiff(playRef.current.facing, angle)) < 0.01) return
    dispatch({ type: 'aim', angle })
  }

  function sendEcho() {
    if (screenRef.current !== 'play' || playRef.current.status !== 'playing') return
    dispatch({ type: 'echo' })
  }

  function finishLevel() {
    const s = playRef.current
    const stars = starsFor(s, shortest)
    const next: Progress = { ...progress, stars: { ...progress.stars } }
    const list = [...next.stars[progress.difficulty]]
    list[levelIndex] = Math.max(list[levelIndex], stars)
    next.stars[progress.difficulty] = list
    setProgress(next)
    saveProgress(next)
    setClear({
      stars,
      steps: s.steps,
      shortest,
      timeUsed: s.timeLimit - s.time,
      parTime: s.timeLimit * PAR_TIME_FRACTION,
      best: list[levelIndex],
    })
    setScreen('clear')
  }

  // --- the frame loop ------------------------------------------------------
  function frame(dt: number) {
    nowRef.current += dt
    const now = nowRef.current
    const s0 = playRef.current
    if (screenRef.current === 'play') {
      if (s0.status === 'playing') {
        dispatch({ type: 'tick', dt })
        if (bufferedRef.current && now - lastMoveRef.current >= MOVE_INTERVAL) {
          const b = bufferedRef.current
          bufferedRef.current = null
          tryMove(b.dx, b.dy)
        }
        const s = playRef.current
        audio.setHum(s.started && s.battery > 0, s.battery / s.batteryMax)
        // Heartbeat once the air is below half, quickening toward the end.
        const frac = s.time / s.timeLimit
        if (s.started && frac < 0.5) {
          heartRef.current -= dt
          if (heartRef.current <= 0) {
            audio.heartbeat()
            heartRef.current = 0.35 + 0.85 * (frac / 0.5)
          }
        }
      }
      const end = endRef.current
      const s = playRef.current
      if (end && !end.handled) {
        if (s.status === 'won' && now - end.t0 > WIN_CARD_DELAY) {
          end.handled = true
          finishLevel()
        } else if ((s.status === 'fallen' || s.status === 'timeout') && now - end.t0 > FAIL_RESTART_DELAY) {
          end.handled = true
          resetLevel()
        }
      }
    } else {
      audio.setHum(false, 0)
    }
    draw()
  }

  function draw() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    if (!maskRef.current) maskRef.current = document.createElement('canvas')
    const now = nowRef.current
    const s = playRef.current
    const levelTime = now - levelStartRef.current

    // smooth slide between tiles, and a beam that swings rather than snaps
    const slide = slideRef.current
    const k = slide.t0 < 0 ? 1 : Math.min(1, (now - slide.t0) / SLIDE_TIME)
    const px = slide.fromX + (s.x - slide.fromX) * k
    const py = slide.fromY + (s.y - slide.fromY) * k
    angleRef.current += angleDiff(angleRef.current, s.facing) * 0.3
    const critters = (level.critters ?? []).map((c) => critterPos(c, levelTime))

    const light = lightRef.current
    const bright = brightRef.current
    const seenAt = seenAtRef.current
    if (light.length !== grid.w * grid.h) return
    const lit = s.status !== 'fallen'
    computeLight(
      {
        grid,
        x: px,
        y: py,
        angle: angleRef.current,
        reach: lit ? beamReach(s, level.maxReach) : 0,
        haveKey: s.haveKey,
        flipped: s.flipped,
        critters,
      },
      light,
    )
    // a dying battery makes the beam stutter
    const weak = s.battery > 0 && s.battery / s.batteryMax < 0.25
    const flicker = weak && Math.random() < 0.07 ? 0.5 : 1

    for (let i = 0; i < light.length; i++) {
      const l = light[i] * flicker
      if (l > SEEN_THRESHOLD) {
        seenAt[i] = now
        if (grid.moss.includes(i)) mossSeenRef.current.add(i)
      }
      let memory = 0
      if (seenAt[i] > -Infinity) {
        if (difficulty.memorySeconds === Infinity) memory = LANTERN_MEMORY
        else if (difficulty.memorySeconds > 0) memory = TORCH_MEMORY * Math.max(0, 1 - (now - seenAt[i]) / difficulty.memorySeconds)
      }
      bright[i] = Math.max(l, memory)
    }
    for (const i of mossSeenRef.current) bright[i] = Math.max(bright[i], 0.3)
    const exitI = grid.exit.y * grid.w + grid.exit.x
    bright[exitI] = Math.max(bright[exitI], 0.3)

    const scene = { haveKey: s.haveKey, flipped: s.flipped, cellsTaken: s.cellsTaken, keysTaken: s.keysTaken }
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    drawTiles(ctx, grid, layout, bright, scene, now)
    drawDarkness(ctx, grid, layout, bright, maskRef.current)
    drawEmissives(ctx, grid, layout, scene, mossSeenRef.current, critters, now)
    const echo = echoRef.current
    if (echo && now - echo.t0 < ECHO_DURATION) drawEcho(ctx, grid, layout, echo, now - echo.t0, ECHO_DURATION)

    const end = endRef.current
    if (s.status === 'fallen' && end) {
      // the explorer shrinks away into the chasm
      const p = Math.min(1, (now - end.t0) / 0.6)
      ctx.save()
      ctx.globalAlpha = 1 - p
      const cx = layout.ox + (px + 0.5) * layout.size
      const cy = layout.oy + (py + 0.5) * layout.size
      ctx.translate(cx, cy)
      ctx.scale(1 - p * 0.8, 1 - p * 0.8)
      ctx.translate(-cx, -cy)
      drawPlayer(ctx, layout, px, py, angleRef.current, false)
      ctx.restore()
    } else {
      drawPlayer(ctx, layout, px, py, angleRef.current, s.battery > 0)
    }

    // low air: the edges of the screen close in
    const airFrac = s.time / s.timeLimit
    if (s.started && airFrac < 0.3) {
      const a = (1 - airFrac / 0.3) * 0.6
      const v = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.3, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.6)
      v.addColorStop(0, 'rgba(60,0,0,0)')
      v.addColorStop(1, `rgba(60,0,0,${a})`)
      ctx.fillStyle = v
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    }
    if (end && (s.status === 'fallen' || s.status === 'timeout')) {
      const p = (now - end.t0) / 0.4
      if (p < 1) {
        ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - p)})`
        ctx.fillRect(0, 0, VIEW_W, VIEW_H)
      }
    }
  }

  const frameRef = useRef(frame)
  useEffect(() => {
    frameRef.current = frame
  })

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    function tick(t: number) {
      const dt = Math.min((t - last) / 1000, 0.05)
      last = t
      frameRef.current(dt)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      audio.setHum(false, 0)
    }
  }, [])

  // --- input -----------------------------------------------------------------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (screenRef.current !== 'play') return
      const key = e.key.toLowerCase()
      const dir = DIRS[key]
      if (dir) {
        e.preventDefault()
        if (e.shiftKey) aimAt(Math.atan2(dir.dy, dir.dx))
        else tryMove(dir.dx, dir.dy)
      } else if (key === 'e') sendEcho()
      else if (key === 'r') resetLevel()
      else if (key === 'escape') setScreen('select')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function handlePointer(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === 'touch' && e.type === 'pointermove' && e.buttons === 0) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const cx = ((e.clientX - rect.left) / rect.width) * VIEW_W
    const cy = ((e.clientY - rect.top) / rect.height) * VIEW_H
    const s = playRef.current
    const sx = layout.ox + (s.x + 0.5) * layout.size
    const sy = layout.oy + (s.y + 0.5) * layout.size
    if (Math.hypot(cx - sx, cy - sy) < layout.size * 0.4) return
    aimAt(Math.atan2(cy - sy, cx - sx))
  }

  // Touch D-pad: a tap steps once; holding repeats.
  function holdMove(dx: number, dy: number) {
    return {
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault()
        tryMove(dx, dy)
        if (holdRef.current) window.clearInterval(holdRef.current)
        holdRef.current = window.setInterval(() => tryMove(dx, dy), 220)
      },
      onPointerUp: stopHold,
      onPointerLeave: stopHold,
      onPointerCancel: stopHold,
    }
  }
  function stopHold() {
    if (holdRef.current) window.clearInterval(holdRef.current)
    holdRef.current = null
  }

  // --- screens -------------------------------------------------------------
  function startLevel(i: number) {
    audio.init()
    setLevelIndex(i)
    setClear(null)
    setScreen('play')
    if (i === levelIndex) resetLevel()
  }

  function chooseDifficulty(id: DifficultyId) {
    const next = { ...progress, difficulty: id }
    setProgress(next)
    saveProgress(next)
  }

  function toggleMute() {
    audio.init()
    audio.setMuted(!muted)
    setMuted(!muted)
  }

  const stars = progress.stars[progress.difficulty]
  const totalStars = stars.reduce((a, b) => a + b, 0)
  const starText = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n)

  return (
    <div className="lux-tenebris fullscreen">
      {screen === 'play' && (
        <div className="lt-hud">
          <button className="lt-hud-btn" onClick={() => setScreen('select')} title="Caverns (Esc)">
            ☰
          </button>
          <span className="lt-hud-level">
            {levelIndex + 1} · {level.name}
          </span>
          <div className="lt-meter" title="Light">
            <span>🔦</span>
            <div className="lt-bar">
              <div className="lt-bar-fill lt-light" style={{ width: `${(hud.battery / hud.batteryMax) * 100}%` }} />
            </div>
          </div>
          <div className="lt-meter" title="Air">
            <span>💨</span>
            <div className="lt-bar">
              <div
                className={`lt-bar-fill lt-air ${hud.time / hud.timeLimit < 0.3 ? 'low' : ''}`}
                style={{ width: `${(hud.time / hud.timeLimit) * 100}%` }}
              />
            </div>
            <span className="lt-time">{Math.ceil(hud.time)}s</span>
          </div>
          <button className="lt-hud-btn" onClick={sendEcho} disabled={hud.echoes === 0} title="Echo (E)">
            ◎ {hud.echoes}
          </button>
          <button className="lt-hud-btn" onClick={() => resetLevel()} title="Restart (R)">
            ↻
          </button>
          <button className="lt-hud-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      )}

      <div className="lt-stage">
        <div className="lt-canvas-wrap">
          <canvas
            ref={canvasRef}
            width={VIEW_W}
            height={VIEW_H}
            className="lt-canvas"
            onPointerMove={handlePointer}
            onPointerDown={handlePointer}
          />

          {screen === 'play' && !hud.started && hud.status === 'playing' && (
            <div className="lt-hint">
              <strong>{level.hint}</strong>
              <span>The air starts running on your first move or look.</span>
            </div>
          )}
          {screen === 'play' && hud.status === 'fallen' && <div className="lt-toast">You fell into the dark…</div>}
          {screen === 'play' && hud.status === 'timeout' && <div className="lt-toast">Out of air…</div>}

          {screen === 'title' && (
            <div className="lt-overlay">
              <h1>Lux Tenebris</h1>
              <p className="lt-tagline">
                Every step dims your light. Every second spends your air. Look, remember, and walk the dark
                from memory.
              </p>
              <ul className="lt-controls">
                <li>
                  <kbd>↑↓←→</kbd> / <kbd>WASD</kbd> walk · <kbd>Shift</kbd>+direction or mouse to aim
                </li>
                <li>
                  <kbd>E</kbd> echo · <kbd>R</kbd> restart · <kbd>Esc</kbd> caverns
                </li>
              </ul>
              <div className="lt-difficulty">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.id}
                    className={progress.difficulty === d.id ? 'selected' : ''}
                    onClick={() => chooseDifficulty(d.id)}
                  >
                    <strong>{d.name}</strong>
                    <span>{d.blurb}</span>
                  </button>
                ))}
              </div>
              <button className="lt-primary" onClick={() => setScreen('select')}>
                Enter the caves
              </button>
            </div>
          )}

          {screen === 'select' && (
            <div className="lt-overlay lt-select">
              <div className="lt-select-head">
                <button className="lt-link" onClick={() => setScreen('title')}>
                  ← Title
                </button>
                <span>
                  {difficulty.name} · {totalStars}/{LEVELS.length * 3} ★
                </span>
              </div>
              {CHAPTERS.map((chapter, c) => (
                <section key={chapter} className="lt-chapter">
                  <h3>{chapter}</h3>
                  <div className="lt-level-row">
                    {LEVELS.slice(c * 5, c * 5 + 5).map((lv, k) => {
                      const i = c * 5 + k
                      const open = isUnlocked(progress, i)
                      return (
                        <button key={lv.name} className="lt-level" disabled={!open} onClick={() => startLevel(i)}>
                          <span className="lt-level-num">{i + 1}</span>
                          <span className="lt-level-name">{open ? lv.name : '🔒'}</span>
                          <span className="lt-level-stars">{starText(stars[i])}</span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}

          {screen === 'clear' && clear && (
            <div className="lt-overlay">
              <h2>Cavern cleared</h2>
              <p className="lt-big-stars">{starText(clear.stars)}</p>
              <ul className="lt-results">
                <li className={clear.steps <= clear.shortest + PAR_STEP_SLACK ? 'got' : ''}>
                  Steps: {clear.steps} (best route {clear.shortest})
                </li>
                <li className={clear.timeUsed <= clear.parTime ? 'got' : ''}>
                  Time: {clear.timeUsed.toFixed(1)}s (target {Math.round(clear.parTime)}s)
                </li>
              </ul>
              <div className="lt-actions">
                <button onClick={() => startLevel(levelIndex)}>Retry</button>
                <button onClick={() => setScreen('select')}>Caverns</button>
                {levelIndex + 1 < LEVELS.length ? (
                  <button className="lt-primary" onClick={() => startLevel(levelIndex + 1)}>
                    Next cavern →
                  </button>
                ) : (
                  <p className="lt-tagline">You walked out of the dark. Every cavern cleared.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {screen === 'play' && (
        <div className="lt-touch" aria-hidden="true">
          <div className="lt-dpad">
            <span />
            <button {...holdMove(0, -1)}>▲</button>
            <span />
            <button {...holdMove(-1, 0)}>◀</button>
            <span />
            <button {...holdMove(1, 0)}>▶</button>
            <span />
            <button {...holdMove(0, 1)}>▼</button>
            <span />
          </div>
          <p className="lt-touch-hint">Drag on the cave to aim your light</p>
        </div>
      )}
    </div>
  )
}

export default LuxTenebris
