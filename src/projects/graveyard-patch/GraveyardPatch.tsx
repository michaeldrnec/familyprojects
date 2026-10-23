import { useCallback, useEffect, useRef, useState } from 'react'
import { useMuted } from '../../shared/audio'
import { useReducedMotion } from '../../shared/motion'
import { usePauseOnHide } from '../../shared/usePauseOnHide'
import * as audio from './audio'
import { NIGHTS, type UpgradeId } from './sim/config'
import {
  abandonTicket,
  catOnScreen,
  completeFix,
  drinkCoffee,
  failFix,
  newNight,
  nightResult,
  openTicket,
  petCat,
  quickPatch,
  shakeAwake,
  splashWater,
  startDeploy,
  stepNight,
  mistapChance,
  type NightResult,
  type NightState,
  type SimEvent,
} from './sim/night'
import type { MiniEnv } from './minigames/env'
import { buyUpgrade, loadProgress, recordNight, type Progress } from './progress'
import Rig, { type RigActions } from './Rig'
import { Menu, Results } from './Screens'
import './GraveyardPatch.css'

type Phase = 'menu' | 'playing' | 'paused' | 'results'

// The screen redraws at this rate; the sim and the mini-game canvases run every frame.
const UI_FPS = 30

const SOUNDS: Partial<Record<SimEvent, () => void>> = {
  report: audio.report,
  p0: audio.siren,
  fixed: audio.fixed,
  fixFailed: audio.fail,
  quickPatch: audio.quickPatch,
  deployStart: audio.deployStart,
  deployDone: audio.deployDone,
  broken: audio.broken,
  ping: audio.ping,
  phantom: audio.fail,
  coffee: audio.coffee,
  crash: audio.crash,
  water: audio.water,
  shake: audio.shake,
  reviewBomb: audio.bomb,
  conflict: audio.conflict,
  crashZone: audio.crashZone,
  cat: audio.meow,
  catPet: audio.purr,
  catSit: audio.meow,
}

function GraveyardPatch() {
  const [phase, setPhase] = useState<Phase>('menu')
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [selected, setSelected] = useState(() => progress.unlocked)
  const [result, setResult] = useState<NightResult | null>(null)
  const [, setFrame] = useState(0)
  const [shaking, setShaking] = useState(false)
  const [muted, toggleSiteMute] = useMuted()
  const reducedMotion = useReducedMotion()

  const simRef = useRef<NightState | null>(null)
  const phaseRef = useRef<Phase>('menu')
  const benchSeed = useRef(0)
  const shakeTimer = useRef(0)

  function changePhase(next: Phase) {
    phaseRef.current = next
    setPhase(next)
  }

  function pause() {
    if (phaseRef.current !== 'playing') return
    audio.stopMusic()
    changePhase('paused')
  }

  usePauseOnHide(pause, phase === 'playing')

  function resume() {
    if (phaseRef.current !== 'paused') return
    audio.init()
    audio.startMusic()
    changePhase('playing')
  }

  function start(night: number) {
    audio.init()
    audio.startMusic()
    setSelected(night)
    simRef.current = newNight(night, progress.owned, Math.floor(Math.random() * 1_000_000_000))
    setResult(null)
    changePhase('playing')
  }

  function finish(s: NightState) {
    audio.stopMusic()
    audio.setTired(0)
    const r = nightResult(s)
    setProgress((p) => recordNight(p, s.night, r))
    setResult(r)
    changePhase('results')
  }

  function quit() {
    audio.stopMusic()
    audio.setTired(0)
    simRef.current = null
    changePhase('menu')
  }

  // Read by the mini-games every frame.
  const env = useCallback((): MiniEnv => {
    const s = simRef.current
    if (!s) return { frozen: true, tempo: 1, mistap: 0, wobble: 0, catOnScreen: false, sleep: 0 }
    const espresso = s.owned.has('espresso')
    const jittery = s.jitters > 0
    return {
      frozen: phaseRef.current !== 'playing' || s.away > 0 || !!s.over,
      tempo: jittery ? (espresso ? 1.15 : 1.35) : 1,
      mistap: mistapChance(s),
      wobble: jittery ? (espresso ? 5 : 12) : 0,
      catOnScreen: catOnScreen(s),
      sleep: s.sleep,
    }
  }, [])

  // The main loop: step the night, play what happened, redraw the screen.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let uiAcc = 0
    function tick(now: number) {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const s = simRef.current
      if (s && phaseRef.current === 'playing') {
        stepNight(s, dt)
        for (const ev of s.events) {
          SOUNDS[ev]?.()
          if (ev === 'shake') {
            setShaking(true)
            window.clearTimeout(shakeTimer.current)
            shakeTimer.current = window.setTimeout(() => setShaking(false), 250)
          }
        }
        s.events.length = 0
        audio.setTired(s.sleep)
        if (s.over) finish(s)
        uiAcc += dt
        if (uiAcc >= 1 / UI_FPS) {
          uiAcc = 0
          setFrame((f) => f + 1)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(shakeTimer.current)
      audio.stopMusic()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Actions run against the live night, then redraw straight away.
  function act(fn: (s: NightState) => void) {
    const s = simRef.current
    if (!s || phaseRef.current !== 'playing') return
    audio.init()
    fn(s)
    setFrame((f) => f + 1)
  }

  function open(id: number) {
    act((s) => {
      if (openTicket(s, id) === 'opened') benchSeed.current = (benchSeed.current + 1) * 7919 + id
    })
  }

  const actions: RigActions = {
    open,
    quick: (id) => act((s) => quickPatch(s, id)),
    abandon: () => act(abandonTicket),
    deploy: () => act(startDeploy),
    coffee: () => act(drinkCoffee),
    water: () => act(splashWater),
    shake: () => act(shakeAwake),
    petCat: () => act(petCat),
    pause,
    mute: () => {
      audio.init()
      toggleSiteMute()
    },
    finishFix: (id, success) => act((s) => (success ? completeFix(s, id) : failFix(s, id))),
  }
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const current = phaseRef.current
      const key = e.key.toLowerCase()
      if (key === 'p' || key === 'escape') {
        if (current === 'playing') pause()
        else if (current === 'paused') resume()
        return
      }
      const s = simRef.current
      if (current !== 'playing' || !s) return
      const a = actionsRef.current
      // Space and Enter would also press whichever button has focus.
      if (key === ' ' || key === 'enter') {
        e.preventDefault()
        if (document.activeElement instanceof HTMLElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur()
      }
      if (key === ' ') a.shake()
      else if (e.repeat) return
      else if (key === 'enter') a.deploy()
      else if (key === 'c') a.coffee()
      else if (key === 'w') a.water()
      else if (key === 'backspace') a.abandon()
      else if (key === 'q') {
        const small = s.tickets.find((t) => t.severity === 'P3') ?? s.tickets.find((t) => t.severity === 'P1')
        if (small) a.quick(small.id)
      } else if (/^[1-9]$/.test(key)) {
        const t = s.tickets[Number(key) - 1]
        if (t) a.open(t.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function buy(id: UpgradeId) {
    setProgress((p) => buyUpgrade(p, id))
  }

  const s = simRef.current
  return (
    <div className="graveyard-patch fullscreen">
      {phase === 'menu' && <Menu progress={progress} selected={selected} onSelect={setSelected} onStart={() => start(selected)} onBuy={buy} />}

      {(phase === 'playing' || phase === 'paused') && s && (
        <Rig s={s} actions={actions} env={env} benchSeed={benchSeed.current} muted={muted} reducedMotion={reducedMotion} shaking={shaking} />
      )}

      {phase === 'paused' && (
        <div className="gp-overlay">
          <h1>Paused</h1>
          <p className="gp-tagline">The bugs are waiting. So is your bed.</p>
          <button type="button" className="gp-primary" onClick={resume}>
            Resume
          </button>
          <button type="button" className="gp-secondary" onClick={quit}>
            Quit to the week
          </button>
        </div>
      )}

      {phase === 'results' && result && (
        <Results
          night={selected}
          result={result}
          progress={progress}
          onNext={result.outcome === 'survived' && selected < NIGHTS.length - 1 ? () => start(selected + 1) : null}
          onRetry={() => start(selected)}
          onMenu={() => {
            setSelected(Math.min(progress.unlocked, NIGHTS.length - 1))
            changePhase('menu')
          }}
        />
      )}
    </div>
  )
}

export default GraveyardPatch
