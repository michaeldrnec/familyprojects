import { useRef, useState } from 'react'
import Hub from './Hub'
import Shop from './Shop'
import Workshop from './Workshop'
import Wiring from './Wiring'
import Flight from './Flight'
import DebriefScreen from './Debrief'
import { loadSave, writeSave, clearSave, freshSave, type SaveData } from './progress'
import { settleFlight, type Debrief } from './economy'
import type { Blueprint } from './workshop'
import type { FlightOutcome } from './flight'
import { wornUids } from './wear'
import * as audio from './audio'
import './ScrapyardBallistics.css'

// The phase machine from SPEC.md section 2:
// hub -> workshop -> wiring -> flight -> debrief -> hub, with the Black
// Market hanging off the hub. The save is the single source of truth and
// is written through on every change.
type Screen = 'hub' | 'shop' | 'workshop' | 'wiring' | 'flight' | 'debrief'

const UNDO_LIMIT = 60
// The in-flight coach pops up tips for a player's first few flights.
const COACH_FLIGHTS = 5

export default function ScrapyardBallistics() {
  const [save, setSave] = useState<SaveData>(() => loadSave())
  const [screen, setScreen] = useState<Screen>('hub')
  const [debrief, setDebrief] = useState<Debrief | null>(null)
  const [flight, setFlight] = useState<{ bp: Blueprint; seed: number; worn: Set<number> } | null>(null)
  const [muted, setMuted] = useState(audio.isMuted())
  // Blueprint undo/redo for the workshop and wiring screens (this session only).
  const history = useRef<{ undo: Blueprint[]; redo: Blueprint[] }>({ undo: [], redo: [] })
  const [, setHistoryTick] = useState(0)

  function commit(next: SaveData) {
    setSave(next)
    writeSave(next)
  }

  function setBlueprint(bp: Blueprint) {
    if (bp === save.blueprint) return
    const h = history.current
    h.undo.push(save.blueprint)
    if (h.undo.length > UNDO_LIMIT) h.undo.shift()
    h.redo = []
    setHistoryTick((n) => n + 1)
    commit({ ...save, blueprint: bp })
  }

  function undo() {
    const h = history.current
    const prev = h.undo.pop()
    if (!prev) return audio.playDenied()
    h.redo.push(save.blueprint)
    setHistoryTick((n) => n + 1)
    commit({ ...save, blueprint: prev })
  }

  function redo() {
    const h = history.current
    const next = h.redo.pop()
    if (!next) return audio.playDenied()
    h.undo.push(save.blueprint)
    setHistoryTick((n) => n + 1)
    commit({ ...save, blueprint: next })
  }

  const editing = {
    onUndo: undo,
    onRedo: redo,
    canUndo: history.current.undo.length > 0,
    canRedo: history.current.redo.length > 0,
  }

  function go(next: Screen) {
    audio.init()
    setScreen(next)
  }

  function launch() {
    audio.init()
    setFlight({
      bp: save.blueprint,
      seed: (Date.now() ^ (save.flights * 2654435761)) >>> 0,
      worn: wornUids(save.blueprint, save.worn),
    })
    setScreen('flight')
  }

  function onFlightOver(outcome: FlightOutcome) {
    if (!flight) return
    const result = settleFlight(save, flight.bp, outcome, flight.worn)
    commit(result.save)
    setDebrief(result.debrief)
    if (result.debrief.contractsDone.length > 0) audio.playContract()
    setScreen('debrief')
  }

  function resetSave() {
    clearSave()
    const fresh = freshSave()
    history.current = { undo: [], redo: [] }
    setSave(fresh)
    writeSave(fresh)
    setScreen('hub')
  }

  function toggleMute() {
    const next = !muted
    setMuted(next)
    audio.setMuted(next)
  }

  return (
    <div className="scrapyard-ballistics fullscreen">
      <button className="sb-mute" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
        {muted ? '🔇' : '🔊'}
      </button>
      {screen === 'hub' && (
        <Hub save={save} onChange={commit} onWorkshop={() => go('workshop')} onShop={() => go('shop')} onReset={resetSave} />
      )}
      {screen === 'shop' && <Shop save={save} onChange={commit} onBack={() => go('hub')} />}
      {screen === 'workshop' && (
        <Workshop
          save={save}
          onChange={setBlueprint}
          onSaveChange={commit}
          {...editing}
          onBack={() => go('hub')}
          onWiring={() => go('wiring')}
          onLaunch={launch}
        />
      )}
      {screen === 'wiring' && (
        <Wiring save={save} onChange={setBlueprint} {...editing} onBack={() => go('workshop')} onLaunch={launch} />
      )}
      {screen === 'flight' && flight && (
        <Flight
          key={flight.seed}
          blueprint={flight.bp}
          seed={flight.seed}
          worn={flight.worn}
          coach={save.flights < COACH_FLIGHTS}
          ghost={save.bestTrack}
          bestAltitude={save.bestAltitude}
          onOver={onFlightOver}
        />
      )}
      {screen === 'debrief' && debrief && (
        <DebriefScreen debrief={debrief} save={save} onHub={() => go('hub')} onRebuild={() => go('workshop')} />
      )}
    </div>
  )
}
