// 10 Centimeters: a Labor & Delivery night shift. This component owns the
// phases (menu, playing, paused, results), the main loop, and keyboard
// input; the rules live in sim/, the drawing in render/.
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../../shared/motion'
import { usePauseOnHide } from '../../shared/usePauseOnHide'
import * as audio from './audio'
import { ActionBar, Toasts, TopBar } from './Hud'
import { ACTION_KEYS, ITEM_KEYS } from './keys'
import Procedure from './Procedure'
import { loadProgress, recordShift, type Progress } from './progress'
import FhrStrip from './render/FhrStrip'
import Floor from './render/Floor'
import { Menu, Results } from './Screens'
import { SHIFTS } from './sim/config'
import {
  command,
  dropItem,
  finishProcedure,
  newShift,
  orPatient,
  patientInBay,
  patientStatus,
  pickItem,
  shiftResult,
  stepShift,
  walkTo,
  type ShiftResult,
} from './sim/shift'
import { ACTIONS, BAYS, ITEMS, type Action, type Item, type ShiftState, type SimEvent, type Target } from './sim/types'
import './TenCentimeters.css'

type Phase = 'menu' | 'playing' | 'paused' | 'results'

// The HUD re-renders at this rate; the canvases redraw every frame.
const UI_FPS = 20

// How often the monitor alarm repeats while a baby is critical.
const ALARM_EVERY = 3

const MOVE_KEYS: Record<string, [number, number]> = {
  w: [0, -1],
  arrowup: [0, -1],
  s: [0, 1],
  arrowdown: [0, 1],
  a: [-1, 0],
  arrowleft: [-1, 0],
  d: [1, 0],
  arrowright: [1, 0],
}

function keyName(key: string) {
  return key === ' ' ? 'space' : key.toLowerCase()
}

const ACTION_BY_KEY = new Map<string, Action>(ACTIONS.map((a) => [ACTION_KEYS[a].toLowerCase(), a]))
const ITEM_BY_KEY = new Map<string, Item>(ITEMS.map((i) => [ITEM_KEYS[i].toLowerCase(), i]))

function playEvents(s: ShiftState, events: SimEvent[]) {
  for (const ev of new Set(events)) {
    switch (ev) {
      case 'arrival':
        audio.arrival()
        break
      case 'complication':
        audio.complication()
        break
      case 'critical':
        audio.critical()
        break
      case 'transfer':
        audio.transfer()
        break
      case 'midwife':
        audio.midwife()
        break
      case 'scrubbed':
        audio.scrubbed()
        break
      case 'pickup':
        audio.pickup()
        break
      case 'treat':
        audio.treat()
        break
      case 'denied':
        audio.denied()
        break
      case 'procedure':
        audio.procedure(s.procedure?.kind === 'csection')
        break
      case 'delivered':
        // The mini-game already cheered.
        break
    }
  }
}

function TenCentimeters() {
  const [phase, setPhase] = useState<Phase>('menu')
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [shift, setShift] = useState(progress.unlocked)
  const [selected, setSelected] = useState<number | null>(null)
  const [result, setResult] = useState<ShiftResult | null>(null)
  const [newBest, setNewBest] = useState(false)
  const [, setFrame] = useState(0)
  const reducedMotion = useReducedMotion()

  const simRef = useRef<ShiftState | null>(null)
  const phaseRef = useRef<Phase>('menu')
  const selectedRef = useRef<number | null>(null)
  const held = useRef(new Set<string>())
  const progressRef = useRef(progress)
  progressRef.current = progress

  function changePhase(next: Phase) {
    phaseRef.current = next
    setPhase(next)
  }

  function select(bay: number | null) {
    selectedRef.current = bay
    setSelected(bay)
  }

  function pause() {
    if (phaseRef.current !== 'playing') return
    held.current.clear()
    changePhase('paused')
  }

  usePauseOnHide(pause, phase === 'playing')

  function resume() {
    if (phaseRef.current === 'paused') changePhase('playing')
  }

  function start(n: number) {
    audio.init()
    setShift(n)
    simRef.current = newShift(n, Math.floor(Math.random() * 1_000_000_000))
    select(null)
    setResult(null)
    held.current.clear()
    changePhase('playing')
  }

  function quit() {
    simRef.current = null
    changePhase('menu')
  }

  // The main loop: steer, step the shift, refresh the HUD.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let uiAcc = 0
    let beat = 0
    let alarm = 0
    function tick(now: number) {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const s = simRef.current
      if (s && phaseRef.current === 'playing') {
        let x = 0
        let y = 0
        for (const k of held.current) {
          const dir = MOVE_KEYS[k]
          if (dir) {
            x += dir[0]
            y += dir[1]
          }
        }
        s.doctor.input = { x: Math.sign(x), y: Math.sign(y) }
        stepShift(s, dt)
        playEvents(s, s.events)
        s.events.length = 0
        // The fetal monitor for the baby you're with, and the alarm for any baby in trouble.
        const bay = selectedRef.current
        const focus = s.procedure?.patient ?? (bay === null ? undefined : patientInBay(s, bay))
        beat -= dt
        if (focus && beat <= 0) {
          audio.heartbeat(patientStatus(focus) === 'critical')
          beat = 60 / Math.max(60, focus.fetalHeartRate)
        }
        alarm -= dt
        if (alarm <= 0 && s.patients.some((p) => p.assignedBay !== 'WAITING' && patientStatus(p) === 'critical')) {
          audio.alarm()
          alarm = ALARM_EVERY
        }
        // Arriving at a bay selects it, so keyboard players get its actions.
        const at = s.doctor.at
        if (at?.startsWith('bay')) {
          const bay = Number(at.slice(3))
          if (selectedRef.current !== bay) select(bay)
        }
        if (s.over) {
          const r = shiftResult(s)
          const before = progressRef.current
          setNewBest(r.score > before.bestScore[s.shift] && before.bestScore[s.shift] > 0)
          setProgress(recordShift(before, s.shift, r))
          setResult(r)
          audio.shiftOver(r.outcome === 'complete' && r.stars > 0)
          changePhase('results')
        }
        uiAcc += dt
        if (uiAcc >= 1 / UI_FPS) {
          uiAcc = 0
          setFrame((f) => f + 1)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  function act(fn: (s: ShiftState) => void) {
    const s = simRef.current
    if (!s || phaseRef.current !== 'playing') return
    fn(s)
    setFrame((f) => f + 1)
  }

  function goTo(target: Target) {
    if (target.kind === 'bay') select(target.bay)
    act((s) => walkTo(s, target))
  }

  function doAction(a: Action) {
    const bay = selectedRef.current
    if (bay === null) return
    act((s) => command(s, bay, a))
  }

  const actionsRef = useRef({ goTo, doAction, pick: (i: Item) => act((s) => pickItem(s, i)) })
  actionsRef.current = { goTo, doAction, pick: (i: Item) => act((s) => pickItem(s, i)) }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const key = keyName(e.key)
      if (key === 'p' || key === 'escape') {
        if (phaseRef.current === 'playing') pause()
        else if (phaseRef.current === 'paused') resume()
        return
      }
      const s = simRef.current
      if (phaseRef.current !== 'playing' || !s) return
      // During a procedure the mini-game listens for its own keys.
      if (s.procedure) {
        if (key === 'space' || key === 'enter') e.preventDefault()
        return
      }
      if (MOVE_KEYS[key]) {
        e.preventDefault()
        held.current.add(key)
        return
      }
      // Space and Enter would also press whichever button has focus.
      if (key === 'space' || key === 'enter') {
        e.preventDefault()
        if (document.activeElement instanceof HTMLElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur()
      }
      if (e.repeat) return
      const a = actionsRef.current
      if (/^[1-4]$/.test(key)) a.goTo({ kind: 'bay', bay: Number(key) - 1 })
      else if (key === '5') a.goTo({ kind: 'supply' })
      else if (key === '6') a.goTo({ kind: 'sink' })
      else if (key === '7') a.goTo({ kind: 'or' })
      else if (s.doctor.at === 'supply' && ITEM_BY_KEY.has(key)) a.pick(ITEM_BY_KEY.get(key)!)
      else if (ACTION_BY_KEY.has(key)) a.doAction(ACTION_BY_KEY.get(key)!)
    }
    function onKeyUp(e: KeyboardEvent) {
      held.current.delete(keyName(e.key))
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const s = simRef.current
  const get = () => simRef.current
  const or = s ? orPatient(s) : undefined
  return (
    <div className="ten-centimeters fullscreen">
      {phase === 'menu' && <Menu selected={shift} progress={progress} onSelect={setShift} onStart={() => start(shift)} />}

      {(phase === 'playing' || phase === 'paused') && s && (
        <div className="tc-game">
          <TopBar s={s} onDrop={(i) => act((st) => dropItem(st, i))} onPause={pause} />
          <div className="tc-strips">
            {BAYS.map((_, i) => (
              <FhrStrip
                key={i}
                get={get}
                find={(st) => patientInBay(st, i)}
                label={`Bay ${i + 1}`}
                patient={patientInBay(s, i)}
                selected={selected === i}
                reducedMotion={reducedMotion}
                onSelect={() => goTo({ kind: 'bay', bay: i })}
              />
            ))}
            {or && <FhrStrip get={get} find={orPatient} label="OR" patient={or} selected={false} reducedMotion={reducedMotion} />}
          </div>
          <div className="tc-stage">
            <div className="tc-floor-wrap">
              <Floor get={get} selected={selected} reducedMotion={reducedMotion} onTap={goTo} />
              <Toasts s={s} />
            </div>
            <ActionBar s={s} selected={selected} onAction={doAction} onPick={(i) => act((st) => pickItem(st, i))} />
            {s.procedure && (
              <Procedure
                key={s.procedure.patient.id}
                s={s}
                frozen={() => phaseRef.current !== 'playing'}
                reducedMotion={reducedMotion}
                onDone={(q) => act((st) => finishProcedure(st, q))}
              />
            )}
          </div>
        </div>
      )}

      {phase === 'paused' && (
        <div className="tc-overlay">
          <h1>Paused</h1>
          <p className="tc-tagline">The babies will wait. Just this once.</p>
          <button type="button" className="tc-primary" onClick={resume}>
            Resume
          </button>
          <button type="button" className="tc-secondary" onClick={quit}>
            Quit to shifts
          </button>
        </div>
      )}

      {phase === 'results' && result && (
        <Results
          shift={shift}
          result={result}
          best={progress.bestScore[shift]}
          newBest={newBest}
          onNext={result.outcome === 'complete' && result.stars > 0 && shift < SHIFTS.length - 1 ? () => start(shift + 1) : null}
          onRetry={() => start(shift)}
          onMenu={() => changePhase('menu')}
        />
      )}
    </div>
  )
}

export default TenCentimeters
