// Mission screen: Recon (tap anything for intel) and Sequence (arm a weapon,
// pick a tick, tap a target) on one screen. Arming a weapon switches to
// Sequence; the Recon tab disarms it.
import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import * as audio from './audio'
import IntelCard from './IntelCard'
import Timeline from './Timeline'
import { badgeGoal, badgesFor, BADGE_INFO } from './badges'
import { canTarget, targetLabel, validTargets, weaponsFor } from './defenses'
import { drawBattlefield, hitTest } from './render/battlefield'
import { copyText, encodePlan } from './share'
import { planEnergy, planProblem, simulate } from './sim'
import type { Level, Plan, Platform, Target, WeaponId } from './types'
import { pointerPos, useCanvasLoop } from '../../shared/useCanvasLoop'
import { WEAPONS } from './weapons'

interface Props {
  level: Level
  isDaily: boolean
  platform: Platform
  plan: Plan
  fails: number
  onPlan: (plan: Plan) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onExecute: () => void
  onBack: () => void
}

const SOLUTION_AFTER_FAILS = 3

export default function Mission(props: Props) {
  const { level, platform, plan, onPlan } = props
  const weapons = weaponsFor(level)
  const [weapon, setWeapon] = useState<WeaponId | null>(null)
  const [tick, setTick] = useState(1)
  const [card, setCard] = useState<number | null>(null)
  const [intel, setIntel] = useState<Target | null>(null)
  const [hover, setHover] = useState<Target | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const valid = useMemo(() => new Set(weapon ? validTargets(level, weapon) : []), [level, weapon])
  const problem = planProblem(level, plan, platform)
  const energy = planEnergy(plan)

  // Targeting Computer: which shots a PDC will bring down.
  const shotDown = useMemo(() => {
    if (!platform.targeting || !level.pdcs.length || !plan.length) return undefined
    const r = simulate(level, plan, platform)
    const out = new Map<number, string>()
    for (const e of r.events) {
      if (e.kind === 'intercept' && e.shot !== undefined) {
        out.set(e.shot, `${level.pdcs.find((p) => p.id === e.entity)?.name ?? 'PDC'} T${e.tick}`)
      }
    }
    return out
  }, [level, plan, platform])

  function flash(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2200)
  }

  function add(target: Target) {
    if (!weapon) return
    if (!canTarget(level, weapon, target)) {
      audio.play('denied')
      flash(`${WEAPONS[weapon].name} can’t aim at ${targetLabel(level, target)}.`)
      return
    }
    if (energy + WEAPONS[weapon].energy > platform.energy) {
      audio.play('denied')
      flash(`Not enough energy: ${WEAPONS[weapon].energy} MW needed, ${platform.energy - energy} left.`)
      return
    }
    audio.init()
    audio.play('click')
    onPlan([...plan, { w: weapon, tick, target }])
    setCard(plan.length)
  }

  function move(i: number, t: number) {
    if (plan[i].tick === t) return
    onPlan(plan.map((a, j) => (j === i ? { ...a, tick: t } : a)))
  }

  function remove(i: number) {
    onPlan(plan.filter((_, j) => j !== i))
    setCard(null)
  }

  function armWeapon(w: WeaponId | null) {
    audio.init()
    setWeapon((cur) => (cur === w ? null : w))
    setCard(null)
  }

  function execute() {
    if (problem) {
      audio.play('denied')
      flash(problem)
      return
    }
    audio.init()
    props.onExecute()
  }

  // Keyboard: 1-8 weapons, arrows pick the tick, Enter executes,
  // Ctrl+Z/Y undo/redo, Delete removes the selected card, Esc disarms.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) props.onRedo()
        else props.onUndo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        props.onRedo()
        return
      }
      const n = Number(e.key)
      if (n >= 1 && n <= weapons.length && !e.ctrlKey && !e.metaKey) {
        armWeapon(weapons[n - 1])
      } else if (e.key === 'ArrowLeft') {
        setTick((t) => Math.max(1, t - 1))
      } else if (e.key === 'ArrowRight') {
        setTick((t) => Math.min(level.ticks, t + 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        execute()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && card !== null) {
        remove(card)
      } else if (e.key === 'Escape') {
        setWeapon(null)
        setCard(null)
        setIntel(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const canvasRef = useCanvasLoop((ctx, w, h, _dt, time) => {
    drawBattlefield(ctx, w, h, { level, time, plan, valid: weapon ? valid : undefined, hover, selected: intel })
  })

  function resolveHit(e: MouseEvent<HTMLCanvasElement>) {
    const c = canvasRef.current
    if (!c) return null
    const { x, y } = pointerPos(e, c)
    const rect = c.getBoundingClientRect()
    const hit = hitTest(level, rect.width, rect.height, x, y)
    if (weapon) {
      if (hit.specific && valid.has(hit.specific)) return hit.specific
      return hit.col && valid.has(hit.col) ? hit.col : (hit.specific ?? hit.col)
    }
    return hit.specific ?? hit.col
  }

  function copyCode() {
    void copyText(encodePlan(level, plan)).then((ok) => ok && flash('Share code copied.'))
  }

  const usedFrac = Math.min(1, energy / platform.energy)

  return (
    <div className="os-screen os-mission">
      <header className="os-bar">
        <button className="os-btn" onClick={props.onBack}>
          ◀ Map
        </button>
        <h2>
          <span className="os-muted">{props.isDaily ? 'Daily' : level.id}</span> {level.name}
        </h2>
        <div className="os-meters">
          <div className={`os-energy ${energy > platform.energy ? 'over' : ''}`} title="Energy used / capacity">
            <span>⚡ {energy}/{platform.energy} MW</span>
            <div className="os-meter">
              <div style={{ width: `${usedFrac * 100}%` }} />
            </div>
          </div>
          <span className="os-muted" title="Heat cap / cooling per tick">
            🌡 cap {platform.heatCap}, −{platform.cool}/tick
          </span>
        </div>
      </header>

      <div className="os-mission-main">
        <div className="os-field">
          <canvas
            ref={canvasRef}
            className={weapon ? 'armed' : ''}
            onPointerMove={(e) => setHover(resolveHit(e))}
            onPointerLeave={() => setHover(null)}
            onClick={(e) => {
              const t = resolveHit(e)
              if (!t) return
              if (weapon) add(t)
              else {
                audio.init()
                setIntel(t === intel ? null : t)
              }
            }}
          />
          {toast && <div className="os-toast">{toast}</div>}
        </div>
        <aside className="os-side">
          <div className="os-tabs" role="tablist">
            <button role="tab" aria-selected={!weapon} className={!weapon ? 'active' : ''} onClick={() => armWeapon(null)}>
              🔭 Recon
            </button>
            <button
              role="tab"
              aria-selected={!!weapon}
              className={weapon ? 'active' : ''}
              onClick={() => !weapon && armWeapon(weapons[0])}
            >
              🧮 Sequence
            </button>
          </div>
          <IntelCard level={level} target={intel} />
          <div className="os-goals">
            {badgesFor(level).map((b) => (
              <span key={b} title={BADGE_INFO[b].name}>
                {BADGE_INFO[b].icon} {badgeGoal(level, b)}
              </span>
            ))}
          </div>
        </aside>
      </div>

      <div className="os-tray" role="toolbar" aria-label="Weapons">
        {weapons.map((w, i) => {
          const d = WEAPONS[w]
          return (
            <button
              key={w}
              className={`os-weapon ${weapon === w ? 'armed' : ''}`}
              style={{ ['--wc' as string]: d.color }}
              onClick={() => armWeapon(w)}
              title={d.blurb}
            >
              <span className="os-weapon-icon">{d.icon}</span>
              <span className="os-weapon-name">
                <kbd>{i + 1}</kbd> {d.short}
              </span>
              <span className="os-weapon-stats">
                {d.energy}MW · 🌡{d.heat} · {d.charge ? `chg ${d.charge} · ` : ''}
                {d.transit ? `fall ${d.transit}` : 'instant'}
              </span>
            </button>
          )
        })}
      </div>
      {weapon && (
        <div className="os-aim">
          <span className="os-muted">
            {WEAPONS[weapon].blurb} Fire on <b>T{tick}</b>, aim at:
          </span>
          <div className="os-aim-chips">
            {validTargets(level, weapon).map((t) => (
              <button key={t} className="os-chip-btn" onClick={() => add(t)} onPointerEnter={() => setHover(t)} onPointerLeave={() => setHover(null)}>
                {targetLabel(level, t)}
              </button>
            ))}
          </div>
        </div>
      )}

      <Timeline
        level={level}
        plan={plan}
        platform={platform}
        selectedTick={tick}
        onSelectTick={setTick}
        selectedCard={card}
        onSelectCard={setCard}
        onMove={move}
        onRemove={remove}
        shotDown={shotDown}
      />

      <footer className="os-actions">
        <button className="os-btn" onClick={props.onUndo} disabled={!props.canUndo} title="Undo (Ctrl+Z)">
          ↶ Undo
        </button>
        <button className="os-btn" onClick={props.onRedo} disabled={!props.canRedo} title="Redo (Ctrl+Y)">
          ↷ Redo
        </button>
        <button className="os-btn" onClick={() => (onPlan([]), setCard(null))} disabled={!plan.length}>
          🗑 Clear
        </button>
        <button className="os-btn" onClick={copyCode} disabled={!plan.length} title="Copy a share code for this plan">
          🔗 Code
        </button>
        {!props.isDaily && props.fails >= SOLUTION_AFTER_FAILS && (
          <button
            className="os-btn"
            onClick={() => {
              if (window.confirm('Load the reference solution? You can still earn badges with it.')) onPlan(level.solution)
            }}
          >
            🗝 Show solution
          </button>
        )}
        <span className="os-problem">{problem && plan.length ? problem : ''}</span>
        <button className="os-btn os-btn-primary" onClick={execute} disabled={!!problem} title="Execute (Enter)">
          ▶ EXECUTE
        </button>
      </footer>
    </div>
  )
}
