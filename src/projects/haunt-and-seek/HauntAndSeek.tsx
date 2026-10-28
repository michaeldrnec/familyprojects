import { useEffect, useRef, useState } from 'react'
import { Vector2 } from 'three'
import { useReducedMotion } from '../../shared/motion'
import { usePauseOnHide } from '../../shared/usePauseOnHide'
import * as audio from './audio'
import { BARKS } from './content'
import Hud, { type Banner } from './Hud'
import { createControls, touch, type Controls } from './input/controls'
import TouchControls from './input/TouchControls'
import { loadProgress, recordRound, saveSettings, type Progress } from './progress'
import { moveFromInput, type CameraMode, type View } from './render/camera'
import { HauntScene } from './render/scene'
import { useThreeView } from './render/useThreeView'
import { Menu, Results } from './Screens'
import { MANORS } from './sim/config'
import type { WorldEvent } from './sim/events'
import { hunger } from './sim/fear'
import type { World } from './sim/types'
import { newWorld, roundResult, stepWorld, type RoundResult } from './sim/world'
import './HauntAndSeek.css'

type Phase = 'menu' | 'playing' | 'paused' | 'results'

const HUD_FPS = 12
const scratch = new Vector2()

const coarsePointer = () => {
  try {
    return window.matchMedia('(pointer: coarse)').matches
  } catch {
    return false
  }
}

function playSound(e: WorldEvent, w: World, pan: number) {
  switch (e.type) {
    case 'scare':
      audio.boo(e.amount, pan)
      if (e.combo) audio.combo()
      break
    case 'cast':
      if (e.ability === 'swoop' || e.ability === 'slip' || e.ability === 'dash') audio.swoop(pan)
      else if (e.ability === 'snuff' || e.ability === 'behind') audio.snuff()
      else if (e.ability === 'wail' || e.ability === 'hallway') audio.wail(pan)
      else if (e.ability === 'thump') audio.thump(pan)
      else if (e.ability === 'slime' || e.ability === 'decoy') audio.splat(pan)
      else if (e.ability === 'goo' || e.ability === 'party') audio.goo(pan)
      else if (e.ability === 'mirror' || e.ability === 'trick') audio.sparkle()
      break
    case 'eat':
      audio.crunch(pan)
      break
    case 'fizz':
      audio.fizz(pan)
      break
    case 'shatter':
      audio.shatter(pan)
      break
    case 'bump':
    case 'skid':
      audio.splat(pan)
      break
    case 'bonk':
      audio.poof()
      break
    case 'wisp':
      audio.sparkle()
      break
    case 'gumball':
      audio.gumball()
      break
    case 'footstep':
      audio.footstep(pan)
      break
    case 'denied':
      if (e.ghost === w.ghosts[w.active].id && e.reason !== 'busy') audio.denied()
      break
    case 'swap':
      audio.swap()
      break
    case 'flee':
      audio.flee()
      break
    case 'won':
      audio.win()
      break
    case 'lost':
      audio.lose()
      break
    default:
      break
  }
}

function Play({
  world,
  phase,
  view,
  sensitivity,
  coarse,
  reducedMotion,
  onPause,
  onOver,
}: {
  world: World
  phase: Phase
  view: View
  sensitivity: number
  coarse: boolean
  reducedMotion: boolean
  onPause: () => void
  onOver: (w: World) => void
}) {
  const [, setTick] = useState(0)
  const [banner, setBanner] = useState<Banner | null>(null)
  const sceneRef = useRef<HauntScene | null>(null)
  const controlsRef = useRef<Controls | null>(null)
  const viewRef = useRef<View>({ ...view, yaw: world.ghosts[world.active].facing })
  viewRef.current.mode = view.mode
  viewRef.current.fov = view.fov
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const bubbleRef = useRef<HTMLDivElement | null>(null)
  const booRef = useRef<HTMLDivElement | null>(null)
  const bubble = useRef({ until: 0, text: '', next: 0 })
  const boo = useRef({ until: 0 })
  const hudAcc = useRef(0)
  const bannerTimer = useRef(0)
  const overSent = useRef(false)
  const sens = useRef(sensitivity)
  sens.current = sensitivity
  const onOverRef = useRef(onOver)
  onOverRef.current = onOver

  function showBanner(b: Banner, seconds = 2) {
    setBanner(b)
    window.clearTimeout(bannerTimer.current)
    bannerTimer.current = window.setTimeout(() => setBanner(null), seconds * 1000)
  }

  const { hostRef, failed } = useThreeView(({ renderer, width, height, dt }) => {
    const host = hostRef.current
    if (!host) return
    if (!sceneRef.current) sceneRef.current = new HauntScene(world, reducedMotion)
    if (!controlsRef.current) controlsRef.current = createControls(host, () => sens.current, () => viewRef.current.mode)
    const scene = sceneRef.current
    const v = viewRef.current
    const w = world
    let events: WorldEvent[] = []

    if (phaseRef.current === 'playing' && !w.over) {
      const snap = controlsRef.current.read(dt, v.mode)
      if (snap.pause) {
        onPause()
        return
      }
      if (v.mode !== 'overhead') v.yaw += snap.turn
      let swap = snap.swap
      if (swap === -1) swap = (w.active + w.ghosts.length - 1) % w.ghosts.length
      if (snap.nextGhost) swap = (w.active + 1) % w.ghosts.length
      const move = moveFromInput(v, snap.forward, snap.right)
      events = stepWorld(w, { mx: move.mx, my: move.my, face: v.mode === 'overhead' ? null : v.yaw, cast: snap.cast, swap }, dt)

      const it = w.intruder
      for (const e of events) {
        const at = 'x' in e ? scene.project(e.x, 0.5, e.y, width, height) : null
        const pan = at ? Math.max(-1, Math.min(1, (at.x / Math.max(1, width)) * 2 - 1)) * 0.8 : 0
        playSound(e, w, pan)
        if (e.type === 'swap' && v.mode !== 'overhead') v.yaw = w.ghosts[w.active].facing
        if (e.type === 'bark' && (w.time > bubble.current.next || e.kind === 'flee' || e.kind === 'rush')) {
          const lines = BARKS[e.kind]
          bubble.current = { text: lines[Math.floor(Math.random() * lines.length)], until: w.time + 1.8, next: w.time + 2.6 }
        }
        if (e.type === 'scare' && e.amount >= 1) {
          boo.current.until = w.time + 0.9
          if (booRef.current) {
            booRef.current.textContent = e.combo ? `BOO! ×${w.chain}` : 'BOO!'
            booRef.current.classList.remove('pop')
            void booRef.current.offsetWidth
            booRef.current.classList.add('pop')
          }
          if (e.combo) showBanner({ text: `Boo-Combo ×${w.chain}!`, kind: 'combo' }, 1.6)
        }
        if (e.type === 'gumball') showBanner({ text: 'He ate a gumball! Sugar Rush!', kind: 'rush' }, 2)
        if (e.type === 'flee') showBanner({ text: 'He’s running for the door!', kind: 'flee' }, 3)
        if (e.type === 'bonk') showBanner({ text: 'Bonked! Back to the Ghost House…', kind: 'info' }, 1.6)
      }
      audio.setMood(hunger(w), it.rush > 0)

      if (w.over && !overSent.current) {
        overSent.current = true
        // A moment to watch him go (or finish the last sweet).
        window.setTimeout(() => onOverRef.current(w), w.over === 'won' ? 1400 : 900)
      }
    } else if (w.over) {
      // Let the last moment play out under the results timer.
      events = []
    }

    scene.update(w, v, phaseRef.current === 'playing' ? dt : 0, events)
    const size = renderer.getDrawingBufferSize(scratch)
    scene.camera.aspect = width / Math.max(1, height)
    scene.camera.updateProjectionMatrix()
    scene.setHole(w, v, size.x, size.y)
    renderer.render(scene.scene, scene.camera)

    // Snaxley's speech bubble and the BOO! pop follow him on screen.
    const head = scene.project(w.intruder.x, 1.25, w.intruder.y, width, height)
    if (bubbleRef.current) {
      const show = w.time < bubble.current.until && !head.behind
      bubbleRef.current.style.opacity = show ? '1' : '0'
      if (bubbleRef.current.textContent !== bubble.current.text) bubbleRef.current.textContent = bubble.current.text
      bubbleRef.current.style.transform = `translate(${head.x}px, ${head.y}px) translate(-50%, -100%)`
    }
    if (booRef.current) {
      const top = scene.project(w.intruder.x, 1.7, w.intruder.y, width, height)
      booRef.current.style.left = `${top.x}px`
      booRef.current.style.top = `${top.y}px`
      booRef.current.style.opacity = w.time < boo.current.until && !top.behind ? '1' : '0'
    }

    hudAcc.current += dt
    if (hudAcc.current >= 1 / HUD_FPS) {
      hudAcc.current = 0
      setTick((n) => n + 1)
    }
  })

  // Leaving pointer lock (Esc) mid-game pauses.
  useEffect(() => {
    let wasLocked = false
    const onLock = () => {
      const lockedNow = !!document.pointerLockElement
      if (wasLocked && !lockedNow && phaseRef.current === 'playing') onPause()
      wasLocked = lockedNow
    }
    document.addEventListener('pointerlockchange', onLock)
    return () => document.removeEventListener('pointerlockchange', onLock)
  }, [onPause])

  useEffect(
    () => () => {
      window.clearTimeout(bannerTimer.current)
      controlsRef.current?.dispose()
      sceneRef.current?.dispose()
      touch.stickX = 0
      touch.stickY = 0
    },
    [],
  )

  if (failed) {
    return (
      <div className="hs-overlay">
        <h1>This game needs 3D graphics</h1>
        <p className="hs-tagline">Your browser couldn’t start WebGL. Try another browser, or turn on hardware acceleration in its settings.</p>
      </div>
    )
  }

  return (
    <div className="hs-stage" ref={hostRef}>
      {phase !== 'results' && (
        <Hud w={world} banner={banner} bubbleRef={bubbleRef} booRef={booRef} coarse={coarse} onPause={onPause} />
      )}
      {coarse && phase === 'playing' && <TouchControls canLook={view.mode !== 'overhead'} />}
    </div>
  )
}

function HauntAndSeek() {
  const [phase, setPhase] = useState<Phase>('menu')
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [selected, setSelected] = useState(() => progress.unlocked)
  const [result, setResult] = useState<RoundResult | null>(null)
  const [round, setRound] = useState(0)
  const reducedMotion = useReducedMotion()
  const [coarse] = useState(coarsePointer)
  const worldRef = useRef<World | null>(null)
  const phaseRef = useRef<Phase>('menu')

  const camera: CameraMode = progress.camera ?? (coarse ? 'overhead' : 'shoulder')

  function changePhase(next: Phase) {
    phaseRef.current = next
    setPhase(next)
  }

  function pause() {
    if (phaseRef.current !== 'playing') return
    audio.stopMusic()
    if (document.pointerLockElement) document.exitPointerLock?.()
    changePhase('paused')
  }

  usePauseOnHide(pause, phase === 'playing')

  function resume() {
    if (phaseRef.current !== 'paused') return
    audio.init()
    audio.startMusic()
    changePhase('playing')
  }

  function start(manor: number) {
    audio.init()
    audio.startMusic()
    setSelected(manor)
    worldRef.current = newWorld(manor, progress.difficulty, Math.floor(Math.random() * 1_000_000_000))
    setResult(null)
    setRound((r) => r + 1)
    changePhase('playing')
  }

  function finish(w: World) {
    if (worldRef.current !== w || phaseRef.current === 'results' || phaseRef.current === 'menu') return
    audio.stopMusic()
    if (document.pointerLockElement) document.exitPointerLock?.()
    const r = roundResult(w)
    setProgress((p) => recordRound(p, w.manorIndex, r))
    setResult(r)
    changePhase('results')
  }

  function quit() {
    audio.stopMusic()
    worldRef.current = null
    changePhase('menu')
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (phaseRef.current === 'playing') pause()
        else if (phaseRef.current === 'paused' && e.code === 'KeyP') resume()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      audio.stopMusic()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const w = worldRef.current
  const view: View = { mode: camera, yaw: 0, fov: progress.fov }
  return (
    <div className="haunt-and-seek fullscreen">
      {phase === 'menu' && (
        <Menu
          progress={progress}
          selected={selected}
          camera={camera}
          onSelect={setSelected}
          onStart={() => start(selected)}
          onDifficulty={(difficulty) => setProgress((p) => saveSettings(p, { difficulty }))}
          onCamera={(c) => setProgress((p) => saveSettings(p, { camera: c }))}
          onFov={(fov) => setProgress((p) => saveSettings(p, { fov }))}
          onSensitivity={(sensitivity) => setProgress((p) => saveSettings(p, { sensitivity }))}
        />
      )}

      {phase !== 'menu' && w && (
        <Play
          key={round}
          world={w}
          phase={phase}
          view={view}
          sensitivity={progress.sensitivity}
          coarse={coarse}
          reducedMotion={reducedMotion}
          onPause={pause}
          onOver={finish}
        />
      )}

      {phase === 'paused' && (
        <div className="hs-overlay">
          <h1>Paused</h1>
          <p className="hs-tagline">Snaxley is frozen mid-munch. Shh…</p>
          <button type="button" className="hs-primary" onClick={resume}>
            Resume
          </button>
          <button type="button" className="hs-secondary" onClick={quit}>
            Quit to the manors
          </button>
        </div>
      )}

      {phase === 'results' && result && w && (
        <Results
          manor={w.manorIndex}
          result={result}
          onNext={result.outcome === 'won' && w.manorIndex < MANORS.length - 1 ? () => start(w.manorIndex + 1) : null}
          onRetry={() => start(w.manorIndex)}
          onMenu={() => {
            setSelected(Math.min(progress.unlocked, MANORS.length - 1))
            quit()
          }}
        />
      )}
    </div>
  )
}

export default HauntAndSeek
