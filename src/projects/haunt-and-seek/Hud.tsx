// The in-game overlay: Fear / Hunger / Ecto meters, the ghost portraits (tap
// to swap), the three ability buttons (tap or click; keys Q E R), the
// minimap and the banners. Re-rendered a dozen times a second from the live
// world; the speech bubble over Snaxley is moved every frame by the game loop.
import { useLayoutEffect, useRef, type CSSProperties, type RefObject } from 'react'
import { scaledContext, useHiDpiCanvas } from '../../shared/hiDpiCanvas'
import { canCast, slotAbility } from './sim/abilities'
import { ABILITIES, ghostDef } from './sim/config'
import { hunger } from './sim/fear'
import { WALL, HOUSE, HOUSE_DOOR, PROP, tileX, tileY } from './sim/maze'
import type { World } from './sim/types'
import { touch } from './input/controls'

const MAP_W = 150

function Meter({ label, value, kind, mark }: { label: string; value: number; kind: string; mark?: number }) {
  return (
    <div className={`hs-meter hs-meter-${kind}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
      <span className="hs-meter-label">{label}</span>
      <span className="hs-meter-track">
        <span className="hs-meter-fill" style={{ width: `${Math.min(100, value)}%` }} />
        {mark ? <span className="hs-meter-mark" style={{ left: `${mark}%` }} /> : null}
      </span>
      <span className="hs-meter-value">{Math.floor(value)}%</span>
    </div>
  )
}

function Minimap({ w }: { w: World }) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const m = w.maze
  const cell = MAP_W / m.w
  const h = Math.round(m.h * cell)
  useHiDpiCanvas(ref, MAP_W, h)
  useLayoutEffect(() => {
    const c = ref.current
    const g = c && scaledContext(c)
    if (!g) return
    g.clearRect(0, 0, MAP_W, h)
    for (let i = 0; i < m.cells.length; i++) {
      const x = tileX(m, i) * cell
      const y = tileY(m, i) * cell
      const c0 = m.cells[i]
      g.fillStyle = c0 === WALL ? '#4b4560' : c0 === HOUSE || c0 === HOUSE_DOOR ? '#3b2f5c' : c0 === PROP ? '#5b2a2a' : '#1a1226'
      g.fillRect(x, y, cell + 0.5, cell + 0.5)
      if (w.snuff[i] > 0 && c0 !== WALL) {
        g.fillStyle = 'rgba(0,0,0,0.55)'
        g.fillRect(x, y, cell + 0.5, cell + 0.5)
      }
      if (w.sweets[i]) {
        g.fillStyle = '#f9a8d4'
        g.fillRect(x + cell * 0.4, y + cell * 0.4, cell * 0.22, cell * 0.22)
      }
      if (w.gumballs[i]) {
        g.fillStyle = '#f472b6'
        g.beginPath()
        g.arc(x + cell / 2, y + cell / 2, cell * 0.34, 0, Math.PI * 2)
        g.fill()
      }
    }
    for (const hz of w.hazards) {
      g.strokeStyle = hz.kind === 'mirror' ? '#f5d0fe' : hz.kind === 'slime' ? '#5eead4' : hz.kind === 'goo' ? '#a78bfa' : '#fde68a'
      g.lineWidth = 1
      g.strokeRect(hz.x * cell + 1, hz.y * cell + 1, cell - 2, cell - 2)
    }
    g.fillStyle = '#6ee7b7'
    for (const p of w.wisps) {
      g.beginPath()
      g.arc((p.x + 0.5) * cell, (p.y + 0.5) * cell, cell * 0.3, 0, Math.PI * 2)
      g.fill()
    }
    const it = w.intruder
    const sx = (it.x + 0.5) * cell
    const sy = (it.y + 0.5) * cell
    g.fillStyle = 'rgba(253, 230, 138, 0.25)'
    g.beginPath()
    g.moveTo(sx, sy)
    g.arc(sx, sy, cell * 5, it.look - 0.6, it.look + 0.6)
    g.fill()
    g.fillStyle = it.rush > 0 ? '#f472b6' : '#e5e7eb'
    g.beginPath()
    g.arc(sx, sy, cell * 0.55, 0, Math.PI * 2)
    g.fill()
    w.ghosts.forEach((gh, k) => {
      if (gh.respawn > 0) return
      g.fillStyle = ghostDef(gh.id).color
      g.beginPath()
      g.arc((gh.x + 0.5) * cell, (gh.y + 0.5) * cell, cell * (k === w.active ? 0.6 : 0.42), 0, Math.PI * 2)
      g.fill()
      if (k === w.active) {
        g.strokeStyle = '#fff'
        g.lineWidth = 1.2
        g.stroke()
      }
    })
  })
  return <canvas ref={ref} className="hs-minimap" style={{ width: MAP_W, height: h }} aria-label="Map of the manor" role="img" />
}

function AbilityButton({ w, slot, keyName }: { w: World; slot: number; keyName: string }) {
  const g = w.ghosts[w.active]
  const id = slotAbility(w, g, slot)
  if (!id) {
    return (
      <div className="hs-ability hs-ability-locked" aria-hidden="true">
        <span className="hs-ability-icon">🔒</span>
        <span className="hs-ability-name">{slot === 2 ? 'Ultimate' : '—'}</span>
      </div>
    )
  }
  const def = ABILITIES[id]
  const deny = canCast(w, g, slot)
  const cd = g.cd[id] ?? 0
  const hiddenBurst = id === 'wallflower' && g.hidden > 0
  const sweep = cd > 0 ? (cd / def.cooldown) * 360 : 0
  const defense = w.intruder.rush > 0
  return (
    <button
      type="button"
      className={'hs-ability' + (deny ? ' is-off' : '') + (defense ? ' is-defense' : '') + (slot === 2 && !defense ? ' is-ult' : '')}
      title={def.blurb}
      aria-label={`${def.name} (${keyName})`}
      onPointerDown={(e) => {
        e.preventDefault()
        touch.casts.push(slot)
      }}
    >
      {sweep > 0 && <span className="hs-ability-cd" style={{ background: `conic-gradient(rgba(0,0,0,0.6) ${sweep}deg, transparent 0)` }} />}
      <span className="hs-ability-icon" aria-hidden="true">
        {hiddenBurst ? '💥' : def.icon}
      </span>
      <span className="hs-ability-name">{hiddenBurst ? 'Burst out!' : def.name}</span>
      <span className="hs-ability-cost">
        {def.fearCost ? `−${def.fearCost} fear` : hiddenBurst ? 'free' : `${def.cost} ecto`} <kbd>{keyName}</kbd>
      </span>
    </button>
  )
}

export interface Banner {
  text: string
  kind: 'combo' | 'rush' | 'flee' | 'info'
}

export default function Hud({
  w,
  banner,
  bubbleRef,
  booRef,
  coarse,
  onPause,
}: {
  w: World
  banner: Banner | null
  bubbleRef: RefObject<HTMLDivElement | null>
  booRef: RefObject<HTMLDivElement | null>
  coarse: boolean
  onPause: () => void
}) {
  const it = w.intruder
  const ultReady = w.manor.ultimates
  return (
    <div className="hs-hud">
      <div className="hs-hud-top">
        <div className="hs-meters">
          <Meter label="Fear" value={w.fear} kind="fear" mark={w.fearFloor || undefined} />
          <Meter label="Hunger" value={hunger(w) * 100} kind="hunger" />
          <Meter label="Ecto" value={w.ecto} kind="ecto" />
        </div>
        <div className="hs-portraits" role="group" aria-label="Your ghosts">
          {w.ghosts.map((g, k) => {
            const def = ghostDef(g.id)
            const ult = ultReady && (g.cd[def.abilities[2]] ?? 0) <= 0 && w.ecto >= ABILITIES[def.abilities[2]].cost
            return (
              <button
                key={g.id}
                type="button"
                className={'hs-portrait' + (k === w.active ? ' is-active' : '') + (g.respawn > 0 ? ' is-bonked' : '')}
                style={{ '--ghost': def.color } as CSSProperties}
                aria-pressed={k === w.active}
                aria-label={`Fly ${def.name} (${k + 1})`}
                onPointerDown={(e) => {
                  e.preventDefault()
                  touch.swaps.push(k)
                }}
              >
                <span className="hs-portrait-face" aria-hidden="true">
                  {g.respawn > 0 ? '💫' : '👻'}
                </span>
                <span className="hs-portrait-name">{def.name}</span>
                {!coarse && <kbd>{k + 1}</kbd>}
                {ult && <span className="hs-portrait-ult" title="Ultimate ready" />}
              </button>
            )
          })}
        </div>
        <div className="hs-hud-corner">
          <div className="hs-hud-buttons">
            <button type="button" className="hs-icon-btn" onClick={onPause} aria-label="Pause">
              ⏸
            </button>
          </div>
          <Minimap w={w} />
        </div>
      </div>

      {it.rush > 0 && (
        <div className="hs-rush" role="status">
          <span>🍭 Sugar Rush! Run!</span>
          <span className="hs-rush-bar">
            <span style={{ width: `${(it.rush / w.manor.rushSeconds) * 100}%` }} />
          </span>
        </div>
      )}
      {banner && (
        <div key={banner.text} className={`hs-banner hs-banner-${banner.kind}`} role="status">
          {banner.text}
        </div>
      )}

      <div ref={bubbleRef} className="hs-bubble" aria-live="polite" />
      <div ref={booRef} className="hs-boo" aria-hidden="true" />

      <div className="hs-abilities" role="group" aria-label="Abilities">
        <AbilityButton w={w} slot={0} keyName="Q" />
        <AbilityButton w={w} slot={1} keyName="E" />
        <AbilityButton w={w} slot={2} keyName="R" />
      </div>
      {!coarse && (
        <p className="hs-keyhint">
          <kbd>WASD</kbd> move · <kbd>mouse</kbd> / <kbd>←</kbd>
          <kbd>→</kbd> look · <kbd>Q</kbd>
          <kbd>E</kbd>
          <kbd>R</kbd> abilities · <kbd>1</kbd>–<kbd>4</kbd> swap · <kbd>P</kbd> pause
        </p>
      )}
    </div>
  )
}
