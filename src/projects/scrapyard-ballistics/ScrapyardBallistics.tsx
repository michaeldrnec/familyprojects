import { useState } from 'react'
import Hub from './Hub'
import Shop from './Shop'
import Workshop from './Workshop'
import Wiring from './Wiring'
import Flight from './Flight'
import DebriefScreen from './Debrief'
import { loadSave, writeSave, clearSave, freshSave, type SaveData } from './progress'
import { settleFlight, type Debrief } from './economy'
import { partCounts, type Blueprint } from './workshop'
import type { FlightOutcome } from './flight'
import type { PartId } from './parts'
import * as audio from './audio'
import './ScrapyardBallistics.css'

// The phase machine from SPEC.md section 2:
// hub -> workshop -> wiring -> flight -> debrief -> hub, with the Black
// Market hanging off the hub. The save is the single source of truth and
// is written through on every change.
type Screen = 'hub' | 'shop' | 'workshop' | 'wiring' | 'flight' | 'debrief'

export default function ScrapyardBallistics() {
  const [save, setSave] = useState<SaveData>(() => loadSave())
  const [screen, setScreen] = useState<Screen>('hub')
  const [debrief, setDebrief] = useState<Debrief | null>(null)
  const [flight, setFlight] = useState<{ bp: Blueprint; seed: number } | null>(null)
  const [muted, setMuted] = useState(audio.isMuted())

  function commit(next: SaveData) {
    setSave(next)
    writeSave(next)
  }

  function setBlueprint(bp: Blueprint) {
    commit({ ...save, blueprint: bp })
  }

  function go(next: Screen) {
    audio.init()
    setScreen(next)
  }

  function launch() {
    audio.init()
    setFlight({ bp: save.blueprint, seed: (Date.now() ^ (save.flights * 2654435761)) >>> 0 })
    setScreen('flight')
  }

  function onFlightOver(outcome: FlightOutcome) {
    if (!flight) return
    // Launched parts leave the inventory; settleFlight adds back survivors.
    const inventory = { ...save.inventory }
    for (const [id, n] of Object.entries(partCounts(flight.bp)) as [PartId, number][]) {
      inventory[id] = Math.max(0, (inventory[id] ?? 0) - n)
    }
    const result = settleFlight({ ...save, inventory }, flight.bp, outcome)
    commit(result.save)
    setDebrief(result.debrief)
    if (result.debrief.contractsDone.length > 0) audio.playContract()
    setScreen('debrief')
  }

  function resetSave() {
    clearSave()
    const fresh = freshSave()
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
        <Hub save={save} onWorkshop={() => go('workshop')} onShop={() => go('shop')} onReset={resetSave} />
      )}
      {screen === 'shop' && <Shop save={save} onChange={commit} onBack={() => go('hub')} />}
      {screen === 'workshop' && (
        <Workshop
          save={save}
          onChange={setBlueprint}
          onBack={() => go('hub')}
          onWiring={() => go('wiring')}
          onLaunch={launch}
        />
      )}
      {screen === 'wiring' && (
        <Wiring save={save} onChange={setBlueprint} onBack={() => go('workshop')} onLaunch={launch} />
      )}
      {screen === 'flight' && flight && (
        <Flight key={flight.seed} blueprint={flight.bp} seed={flight.seed} onOver={onFlightOver} />
      )}
      {screen === 'debrief' && debrief && (
        <DebriefScreen debrief={debrief} save={save} onHub={() => go('hub')} onRebuild={() => go('workshop')} />
      )}
    </div>
  )
}
