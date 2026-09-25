import { useEffect, useReducer, useRef, useState } from 'react'
import { FlightSim, WARP_LEVELS, PHYSICS_WARP_MAX, type FlightOutcome, type SasMode } from './flight'
import type { Blueprint } from './workshop'
import { BUTTONS, BUTTON_LABEL, type ButtonId } from './wiring'
import { FAILURE_LABEL } from './failures'
import { drawFlight, drawMap } from './render/telemetry'
import { useCanvasLoop } from './useCanvas'
import { formatAlt, formatSpeed, formatTime } from './format'
import { ATMOSPHERE_TOP } from './atmosphere'
import * as audio from './audio'

interface Props {
  blueprint: Blueprint
  seed: number
  onOver: (outcome: FlightOutcome) => void
}

const OUTCOME_TITLE: Record<FlightOutcome['kind'], string> = {
  landed: 'Touchdown!',
  splashdown: 'Splashdown!',
  crashed: 'Lithobraking.',
  abandoned: 'Flight abandoned',
  orbit: 'Left in orbit',
  scrubbed: 'Launch scrubbed',
}

const GRIT: Record<string, number> = { mower: 1, keg: 0.8, firework: 0.6, torch: 0.4, turbo: 0.15 }

export default function Flight({ blueprint, seed, onOver }: Props) {
  const simRef = useRef<FlightSim | null>(null)
  if (!simRef.current) simRef.current = new FlightSim(blueprint, seed)
  const sim = simRef.current
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const [map, setMap] = useState(false)
  const [zoom, setZoom] = useState(1)
  const steerKeys = useRef({ left: false, right: false })
  const steerButtons = useRef({ left: false, right: false })
  const hudClock = useRef(0)

  const canvasRef = useCanvasLoop((ctx, w, h, dt, time) => {
    const s = steerKeys.current
    const b = steerButtons.current
    const left = s.left || b.left
    const right = s.right || b.right
    sim.controls.steer = left === right ? 0 : left ? -1 : 1
    sim.advance(dt)

    for (const cue of sim.drainCues()) audio.playCue(cue)
    let thrust = 0
    let max = 0
    let grit = 0
    for (const p of sim.parts.values()) {
      if (!p.def.engine || !p.alive || !p.main) continue
      max += p.def.engine.thrust
      if (p.throttleOut > 0) {
        thrust += p.def.engine.thrust * p.throttleOut
        grit = Math.max(grit, GRIT[p.def.engine.sound] ?? 0.5)
      }
    }
    if (sim.ended) audio.stopEngine()
    else audio.setEngine(max > 0 ? thrust / max : 0, grit)

    if (map) {
      drawMap(ctx, 0, 0, w, h, sim, true)
    } else {
      drawFlight(ctx, w, h, sim, { time, zoom })
      const mw = Math.min(200, w * 0.3)
      drawMap(ctx, w - mw - 10, 10, mw, mw, sim, false)
    }

    hudClock.current += dt
    if (hudClock.current > 0.1) {
      hudClock.current = 0
      rerender()
    }
  })

  useEffect(() => () => audio.stopEngine(), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent, down: boolean) {
      const k = e.key.toLowerCase()
      if (k === 'a' || e.key === 'ArrowLeft') steerKeys.current.left = down
      else if (k === 'd' || e.key === 'ArrowRight') steerKeys.current.right = down
      if (!down) return
      if (k === 'w' || e.key === 'ArrowUp') sim.controls.throttle = Math.min(1, sim.controls.throttle + 0.1)
      else if (k === 's' || e.key === 'ArrowDown') sim.controls.throttle = Math.max(0, sim.controls.throttle - 0.1)
      else if (k === 'z') sim.controls.throttle = 1
      else if (k === 'x') sim.controls.throttle = 0
      else if (e.key === ' ') {
        e.preventDefault()
        sim.pressButton('IGNITE')
      } else if (['1', '2', '3', '4'].includes(k)) sim.pressButton(`STAGE${k}` as ButtonId)
      else if (e.key === '.') bumpWarp(1)
      else if (e.key === ',') bumpWarp(-1)
      else if (k === 'm') setMap((m) => !m)
      else if (k === 't') cycleSas()
      else return
      rerender()
    }
    const down = (e: KeyboardEvent) => onKey(e, true)
    const up = (e: KeyboardEvent) => onKey(e, false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  })

  function bumpWarp(dir: number) {
    const i = WARP_LEVELS.indexOf(sim.warp)
    const next = WARP_LEVELS[Math.max(0, Math.min(WARP_LEVELS.length - 1, (i < 0 ? 0 : i) + dir))]
    sim.setWarp(next)
  }

  function cycleSas() {
    if (!sim.hasGuidance) return
    const order: SasMode[] = ['off', 'hold', 'prograde', 'retrograde']
    sim.setSas(order[(order.indexOf(sim.sas) + 1) % order.length])
  }

  function steerHandlers(side: 'left' | 'right') {
    return {
      onPointerDown: (e: React.PointerEvent) => {
        ;(e.target as Element).setPointerCapture?.(e.pointerId)
        steerButtons.current[side] = true
      },
      onPointerUp: () => (steerButtons.current[side] = false),
      onPointerCancel: () => (steerButtons.current[side] = false),
      onPointerLeave: () => (steerButtons.current[side] = false),
    }
  }

  const warn = sim.warnings
  const el = sim.orbit
  const engines = sim.mainParts().filter((p) => p.def.engine)
  const tanks = sim.mainParts().filter((p) => p.def.tank)
  const wiredButtons = new Set(BUTTONS.filter((b) => sim.wiring.hasWiresFrom({ kind: 'button', id: b })))
  const recent = sim.log.slice(-4)
  const outcome = sim.outcome

  return (
    <div className="sb-flight">
      <div className="sb-flight-view">
        <canvas ref={canvasRef} className="sb-canvas" onClick={() => audio.init()} />

        <div className="sb-hud-tl">
          <div className="sb-hud-big">{formatAlt(sim.altitude)}</div>
          <div>
            {formatSpeed(sim.speed)} · ↕ {formatSpeed(sim.verticalSpeed)}
          </div>
          <div>
            Mach {sim.mach.toFixed(2)} · q {(sim.q / 1000).toFixed(1)} kPa
          </div>
          <div>
            Ap {formatAlt(el.apoapsis)} · Pe {el.periapsis < -PLANET_SUB ? '—' : formatAlt(el.periapsis)}
          </div>
          <div>
            TWR {sim.twrNow.toFixed(2)} · fuel {Math.round(sim.fuelFraction * 100)}%
          </div>
          <div className="sb-muted">
            {formatTime(sim.t)} · downrange {formatAlt(Math.abs(sim.downrange))}
          </div>
        </div>

        <div className="sb-lights">
          <Light on={warn.maxQ} label="MAX-Q" />
          <Light on={warn.stress} label="STRESS" />
          <Light on={warn.overheat} label="HEAT" />
          <Light on={warn.stuck} label="VALVE" />
          <Light on={warn.spin} label="SPIN" />
          <Light on={warn.fuel} label="FUEL" />
          <Light on={warn.orbit} label="ORBIT" good />
        </div>

        <ul className="sb-log">
          {recent.map((l, i) => (
            <li key={`${l.t}-${i}`} className={`tone-${l.tone}`}>
              {formatTime(l.t)} {l.text}
            </li>
          ))}
        </ul>

        {outcome && (
          <div className="sb-overlay">
            <div className="sb-card sb-over-card">
              <h2>{OUTCOME_TITLE[outcome.kind]}</h2>
              <p>
                Max altitude {formatAlt(outcome.stats.maxAltitude)} · top speed {formatSpeed(outcome.stats.maxSpeed)}
              </p>
              <button className="sb-btn sb-btn-primary" onClick={() => onOver(outcome)}>
                Debrief →
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="sb-dash">
        <div className="sb-dash-group sb-throttle">
          <label>
            THR <b>{Math.round(sim.controls.throttle * 100)}%</b>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(sim.controls.throttle * 100)}
            onChange={(e) => {
              sim.controls.throttle = Number(e.target.value) / 100
              rerender()
            }}
            aria-label="Throttle"
          />
        </div>

        <div className="sb-dash-group sb-steer">
          <button className="sb-btn sb-steer-btn" {...steerHandlers('left')} aria-label="Steer left">
            ◀
          </button>
          <button className="sb-btn sb-steer-btn" {...steerHandlers('right')} aria-label="Steer right">
            ▶
          </button>
        </div>

        <div className="sb-dash-group sb-stage">
          {BUTTONS.map((b) => (
            <button
              key={b}
              className={`sb-btn sb-stage-btn${b === 'IGNITE' ? ' ignite' : ''}${wiredButtons.has(b) ? '' : ' unwired'}`}
              onClick={() => {
                sim.pressButton(b)
                rerender()
              }}
            >
              {BUTTON_LABEL[b]}
            </button>
          ))}
        </div>

        {engines.length > 0 && (
          <div className="sb-dash-group sb-engines">
            {engines.map((p, i) => (
              <div key={p.uid} className={`sb-engine${p.failure ? ' fault' : ''}${p.ignited ? ' lit' : ''}`}>
                <div className="sb-engine-name">
                  E{i + 1} {p.def.name.split(' ').slice(-1)[0]}
                </div>
                <div className="sb-bar-meter" title="Heat">
                  <span style={{ width: `${Math.min(100, p.heat * 100)}%` }} className={p.heat > 0.75 ? 'hot' : ''} />
                </div>
                <div className="sb-engine-status">
                  {p.failure ? FAILURE_LABEL[p.failure] : p.ignited ? (p.starved ? 'no fuel' : 'burning') : 'off'}
                </div>
                <div className="sb-row">
                  <button className="sb-btn sb-btn-tiny" disabled={!p.failure || p.bypass > 0} onClick={() => sim.bypass(p.uid)}>
                    {p.bypass > 0 ? '…' : 'BYPASS'}
                  </button>
                  <button className="sb-btn sb-btn-tiny" onClick={() => sim.cutEngine(p.uid)}>
                    {p.ignited ? 'CUT' : 'LIGHT'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tanks.length > 0 && (
          <div className="sb-dash-group sb-tanks">
            {tanks.map((p, i) => (
              <div key={p.uid} className="sb-tank">
                <span>T{i + 1}</span>
                <div className="sb-bar-meter">
                  <span style={{ width: `${(p.fuel / p.def.tank!.fuel) * 100}%` }} />
                </div>
                <button className={`sb-btn sb-btn-tiny${p.venting ? ' active' : ''}`} onClick={() => sim.toggleVent(p.uid)}>
                  VENT
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="sb-dash-group sb-misc">
          {sim.hasGuidance && (
            <button className="sb-btn sb-btn-small" onClick={cycleSas}>
              SAS: {sim.sas}
            </button>
          )}
          <div className="sb-warp">
            <button className="sb-btn sb-btn-tiny" onClick={() => bumpWarp(-1)}>
              ◀◀
            </button>
            <span className={sim.warp > PHYSICS_WARP_MAX ? 'coast' : ''}>×{sim.warp}</span>
            <button
              className="sb-btn sb-btn-tiny"
              onClick={() => bumpWarp(1)}
              title={sim.canCoastWarp ? 'Time warp' : `Coast warp beyond ×${PHYSICS_WARP_MAX} needs engines off above ${ATMOSPHERE_TOP / 1000} km`}
            >
              ▶▶
            </button>
          </div>
          <button className="sb-btn sb-btn-small" onClick={() => setMap((m) => !m)}>
            {map ? 'CAM' : 'MAP'}
          </button>
          {!map && (
            <span className="sb-zoom">
              <button className="sb-btn sb-btn-tiny" onClick={() => setZoom((z) => Math.max(0.25, z / 1.5))}>
                −
              </button>
              <button className="sb-btn sb-btn-tiny" onClick={() => setZoom((z) => Math.min(4, z * 1.5))}>
                +
              </button>
            </span>
          )}
          <button
            className="sb-btn sb-btn-small sb-btn-danger"
            disabled={!!outcome}
            onClick={() => {
              sim.endFlight()
              rerender()
            }}
            title="Ending mid-air abandons whatever is still flying"
          >
            END FLIGHT
          </button>
        </div>
      </div>
    </div>
  )
}

// Periapsis below the planet's centre (a straight-up hop) isn't worth
// showing as a number.
const PLANET_SUB = 250_000

function Light({ on, label, good }: { on: boolean; label: string; good?: boolean }) {
  return <span className={`sb-light${on ? (good ? ' good' : ' on') : ''}`}>{label}</span>
}
