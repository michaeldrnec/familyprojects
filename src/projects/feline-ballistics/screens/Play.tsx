import { useEffect, useReducer, useRef, useState } from 'react'
import { GameWorld, UNUSED_CAT_BONUS } from '../game/world'
import { BREEDS } from '../game/breeds'
import { Gestures, type Gesture } from '../game/input'
import { catCenter } from '../game/cat'
import type { LevelDef } from '../levels/types'
import { Camera } from '../render/camera'
import { drawRoom } from '../render/room'
import { drawObjects } from '../render/objects'
import { drawCat, perchedPose, poseFromCat } from '../render/cat'
import { Fx, drawAimPreview } from '../render/fx'
import { useCanvasLoop } from '../useCanvas'
import * as audio from '../audio'

interface Props {
  level: LevelDef
  hasNext: boolean
  coachSeen: string[]
  reducedMotion: boolean
  muted: boolean
  onToggleMute: () => void
  onCoachSeen: (key: string) => void
  onResult: (stars: number, score: number) => void
  onNext: () => void
  onExit: () => void
}

const ANGLE_STEP = 0.04
const POWER_STEP = 0.05

function clockText(shots: number) {
  const mins = 15 + shots * 4
  return `3:${String(mins).padStart(2, '0')} AM`
}

export default function Play(props: Props) {
  const [attempt, setAttempt] = useState(0)
  return <PlayRun key={`${props.level.id}-${attempt}`} {...props} onRestart={() => setAttempt((a) => a + 1)} />
}

function PlayRun({ level, hasNext, coachSeen, reducedMotion, muted, onToggleMute, onCoachSeen, onResult, onNext, onExit, onRestart }: Props & { onRestart: () => void }) {
  const worldRef = useRef<GameWorld | null>(null)
  if (!worldRef.current) worldRef.current = new GameWorld(level)
  const world = worldRef.current
  const cam = useRef(new Camera()).current
  const fx = useRef(new Fx()).current
  const gestures = useRef(new Gestures()).current
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const [peek, setPeek] = useState(false)
  const [debug, setDebug] = useState(false)
  const aiming = useRef(false)
  const hudClock = useRef(0)
  const endTimer = useRef(0)
  const reported = useRef(false)
  const [showResults, setShowResults] = useState(false)
  const size = useRef({ w: 1, h: 1 })
  const fps = useRef(60)

  const coachLines = (level.coach ?? []).filter((_, i) => !coachSeen.includes(`${level.id}:${i}`))
  const coachKey = coachLines.length ? `${level.id}:${(level.coach ?? []).indexOf(coachLines[0])}` : null

  function handleGesture(g: Gesture) {
    switch (g.kind) {
      case 'aim':
        aiming.current = true
        world.setAim(g.angle, g.power)
        break
      case 'launch':
        world.setAim(g.angle, g.power)
        aiming.current = false
        world.launch()
        break
      case 'aimCancel':
        aiming.current = false
        break
      case 'tap':
        world.tap()
        break
      case 'holdStart':
        world.holdStart()
        break
      case 'holdEnd':
        world.holdEnd()
        break
      case 'swipe':
        world.swipe(g.dx, g.dy)
        break
    }
  }

  const canvasRef = useCanvasLoop((ctx, w, h, dt, time) => {
    size.current = { w, h }
    fps.current = fps.current * 0.95 + (dt > 0 ? 1 / dt : 60) * 0.05
    world.step(reducedMotion ? dt : dt)
    if (reducedMotion) world.slowmo = 0
    for (const e of world.drainEvents()) {
      fx.handle(e)
      audio.handleEvent(e)
      if (e.kind === 'shake') cam.addShake(e.amount)
    }
    gestures.setMode(world.phase === 'flying' ? 'flight' : 'aim')
    for (const g of gestures.tick(performance.now())) handleGesture(g)
    fx.update(dt * (world.slowmo > 0 ? 0.35 : 1))
    cam.update(world, w, h, dt, peek, reducedMotion)

    ctx.clearRect(0, 0, w, h)
    ctx.save()
    cam.apply(ctx, w, h)
    drawRoom(ctx, level, time)
    drawObjects(ctx, world, time, 'back')
    const breed = world.currentBreed
    if (world.phase === 'aim' && breed) {
      if (aiming.current) drawAimPreview(ctx, world.previewPoints(), world.aim.power)
      drawCat(ctx, breed, perchedPose(breed, level.perch.x, level.perch.y, time, aiming.current ? world.aim.power : 0, aiming.current ? 'focus' : 'smug'))
    }
    const cat = world.cat
    if (cat && cat.state !== 'gone') {
      if (cat.zoom > 0) {
        const c = catCenter(cat)
        ctx.strokeStyle = 'rgba(255,210,122,0.5)'
        ctx.lineWidth = 6
        ctx.beginPath()
        ctx.arc(c.x, c.y, cat.breed.radius * 1.6, 0, Math.PI * 2)
        ctx.stroke()
      }
      drawCat(ctx, cat.breed, poseFromCat(cat, time))
    }
    drawObjects(ctx, world, time, 'front')
    fx.draw(ctx)
    if (debug) drawDebug(ctx, world)
    ctx.restore()
    if (world.slowmo > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.fillRect(0, 0, w, h)
    }
    if (debug) {
      ctx.fillStyle = '#fff'
      ctx.font = '12px ui-monospace, monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`fps ${fps.current.toFixed(0)}  bodies ${world.objects.filter((o) => o.alive).length}  t ${world.shotTime.toFixed(1)}`, 10, h - 10)
    }

    if ((world.phase === 'won' || world.phase === 'lost') && !showResults) {
      endTimer.current += dt
      if (endTimer.current > 0.9) {
        if (!reported.current) {
          reported.current = true
          if (world.phase === 'won') {
            onResult(world.stars, world.score)
            audio.win(world.stars)
          } else {
            audio.lose()
          }
        }
        setShowResults(true)
      }
    }
    hudClock.current += dt
    if (hudClock.current > 0.12) {
      hudClock.current = 0
      rerender()
    }
  })

  function pos(e: React.PointerEvent) {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    audio.init()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const p = pos(e)
    for (const g of gestures.pointerDown(p.x, p.y, performance.now())) handleGesture(g)
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const p = pos(e)
    for (const g of gestures.pointerMove(p.x, p.y, performance.now())) handleGesture(g)
  }
  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const p = pos(e)
    for (const g of gestures.pointerUp(p.x, p.y, performance.now())) handleGesture(g)
  }

  // Keyboard: SPEC.md section 3.
  const shiftDown = useRef(false)
  useEffect(() => {
    function onKey(e: KeyboardEvent, down: boolean) {
      const k = e.key
      if (k === 'Shift') {
        if (down && !shiftDown.current) {
          shiftDown.current = true
          world.holdStart()
        } else if (!down && shiftDown.current) {
          shiftDown.current = false
          world.holdEnd()
        }
        return
      }
      if (!down) return
      audio.init()
      const lower = k.toLowerCase()
      if (lower === 'r') return onRestart()
      if (lower === 'p') return setPeek((v) => !v)
      if (lower === 'm') return onToggleMute()
      if (k === '`') return setDebug((v) => !v)
      if (world.phase === 'aim') {
        aiming.current = true
        if (k === 'ArrowLeft' || lower === 'a') world.setAim(world.aim.angle - ANGLE_STEP, world.aim.power)
        else if (k === 'ArrowRight' || lower === 'd') world.setAim(world.aim.angle + ANGLE_STEP, world.aim.power)
        else if (k === 'ArrowUp' || lower === 'w') world.setAim(world.aim.angle, world.aim.power + POWER_STEP)
        else if (k === 'ArrowDown' || lower === 's') world.setAim(world.aim.angle, world.aim.power - POWER_STEP)
        else if (k === ' ' || k === 'Enter') {
          e.preventDefault()
          aiming.current = false
          world.launch()
        } else return
        e.preventDefault()
      } else if (world.phase === 'flying') {
        if (k === ' ') {
          e.preventDefault()
          world.tap()
        } else if (k === 'ArrowUp') world.swipe(0, -1)
        else if (k === 'ArrowDown') world.swipe(0, 1)
        else if (k === 'ArrowLeft') world.swipe(-1, 0)
        else if (k === 'ArrowRight') world.swipe(1, 0)
        else return
        e.preventDefault()
      }
    }
    const d = (e: KeyboardEvent) => onKey(e, true)
    const u = (e: KeyboardEvent) => onKey(e, false)
    window.addEventListener('keydown', d)
    window.addEventListener('keyup', u)
    return () => {
      window.removeEventListener('keydown', d)
      window.removeEventListener('keyup', u)
    }
  })

  const won = world.phase === 'won'
  const stars = world.stars
  const breed = world.currentBreed
  const flyingCat = world.cat && world.cat.state !== 'gone' ? world.cat : null

  return (
    <div className="fb-play">
      <div className="fb-hud">
        <button className="fb-btn fb-btn-small" onClick={onExit} aria-label="Back to levels">
          ←
        </button>
        <div className="fb-hud-title">
          <b>{level.title}</b>
          <span className="fb-clock">⏰ {clockText(world.shotsTaken)}</span>
        </div>
        <div className="fb-lineup" aria-label="Cats remaining">
          {level.lineup.map((id, i) => (
            <span
              key={i}
              className={`fb-lineup-cat${i < world.lineupIndex ? ' used' : ''}${i === world.lineupIndex && world.phase === 'aim' ? ' up' : ''}`}
              style={{ background: BREEDS[id].fur, borderColor: BREEDS[id].furDark }}
              title={BREEDS[id].name}
            />
          ))}
        </div>
        <div className="fb-hud-stats">
          <span title="Precious items left">✨ {world.preciousLeft}</span>
          <span title="Chaos score">💥 {world.score.toLocaleString()}</span>
        </div>
        <div className="fb-hud-actions">
          <button className={`fb-btn fb-btn-small${peek ? ' active' : ''}`} onClick={() => setPeek((v) => !v)} title="Peek at the whole room (P)">
            👁
          </button>
          <button className="fb-btn fb-btn-small" onClick={onRestart} title="Restart (R)">
            ↻
          </button>
          <button className="fb-btn fb-btn-small" onClick={onToggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      <div className="fb-stage">
        <canvas
          ref={canvasRef}
          className="fb-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <p className="fb-rotate-hint">↻ Turn your phone sideways for a bigger room</p>
        {world.phase === 'aim' && breed && (
          <div className="fb-breed-tag">
            <b>{breed.name}</b> · {breed.abilityName}
            <span>{breed.abilityHint}</span>
          </div>
        )}
        {flyingCat && (
          <div className="fb-reflexes">
            <span className={flyingCat.abilityLeft > 0 ? '' : 'spent'}>TAP {flyingCat.breed.abilityName}{flyingCat.abilityLeft > 1 ? ` ×${flyingCat.abilityLeft}` : ''}</span>
            <span className={flyingCat.gripUsed ? 'spent' : ''}>HOLD loaf / claw</span>
            <span className={flyingCat.swishes > 0 ? '' : 'spent'}>SWIPE tail ×{flyingCat.swishes}</span>
          </div>
        )}
        {coachKey && world.phase === 'aim' && (
          <div className="fb-coach" role="status">
            <span>{coachLines[0]}</span>
            <button className="fb-btn fb-btn-small" onClick={() => onCoachSeen(coachKey)}>
              Got it
            </button>
          </div>
        )}
        {showResults && (
          <div className="fb-results">
            <div className="fb-card fb-results-card">
              <h2>{won ? 'Mischief Managed!' : 'BRRRING! The alarm went off.'}</h2>
              {won ? (
                <div className="fb-paws" aria-label={`${stars} of 3 paws`}>
                  {[1, 2, 3].map((n) => (
                    <span key={n} className={n <= stars ? 'on' : ''}>
                      🐾
                    </span>
                  ))}
                </div>
              ) : (
                <p>{world.preciousLeft} precious thing(s) survived the night.</p>
              )}
              <dl className="fb-breakdown">
                <dt>Chaos</dt>
                <dd>{Math.round(world.chaos).toLocaleString()}</dd>
                {won && (
                  <>
                    <dt>Unused cats ×{world.catsLeft}</dt>
                    <dd>{(world.catsLeft * UNUSED_CAT_BONUS).toLocaleString()}</dd>
                  </>
                )}
                <dt>
                  <b>Score</b>
                </dt>
                <dd>
                  <b>{world.score.toLocaleString()}</b>
                </dd>
                {won && stars < 3 && (
                  <>
                    <dt className="fb-muted">Next paw at</dt>
                    <dd className="fb-muted">{(stars === 1 ? level.stars[1] : level.stars[2]).toLocaleString()}</dd>
                  </>
                )}
              </dl>
              <div className="fb-row">
                <button className="fb-btn" onClick={onRestart}>
                  ↻ Retry
                </button>
                {won && hasNext && (
                  <button className="fb-btn fb-btn-primary" onClick={onNext}>
                    Next →
                  </button>
                )}
                <button className="fb-btn" onClick={onExit}>
                  Levels
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function drawDebug(ctx: CanvasRenderingContext2D, world: GameWorld) {
  ctx.lineWidth = 1
  for (const o of world.objects) {
    if (!o.alive) continue
    for (const part of o.body.parts.length > 1 ? o.body.parts.slice(1) : [o.body]) {
      ctx.strokeStyle = o.body.isSleeping ? 'rgba(120,160,255,0.9)' : 'rgba(255,120,120,0.9)'
      ctx.beginPath()
      part.vertices.forEach((v, i) => (i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y)))
      ctx.closePath()
      ctx.stroke()
    }
    if (Number.isFinite(o.hp) && !o.isStatic) {
      ctx.fillStyle = '#fff'
      ctx.font = '10px ui-monospace, monospace'
      ctx.fillText(o.hp.toFixed(0), o.body.position.x, o.body.position.y)
    }
  }
  const cat = world.cat
  if (cat && cat.state !== 'gone') {
    ctx.fillStyle = 'rgba(255,255,0,0.8)'
    for (const p of cat.ring) ctx.fillRect(p.position.x - 2, p.position.y - 2, 4, 4)
  }
}
