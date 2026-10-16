// The sequencer timeline: one column per tick, action cards stacked in the
// tick they're triggered, with live heat (and stutter) and the windows the
// plan opens. It previews timing only -- never the battle's outcome.
import { useState } from 'react'
import { targetLabel } from './defenses'
import { empDuration, schedule } from './sim'
import type { Level, Plan, Platform } from './types'
import { WEAPONS } from './weapons'

interface Props {
  level: Level
  plan: Plan
  platform: Platform
  selectedTick: number
  onSelectTick: (t: number) => void
  selectedCard: number | null
  onSelectCard: (i: number | null) => void
  onMove: (i: number, tick: number) => void
  onRemove: (i: number) => void
  shotDown?: Map<number, string> // Targeting Computer predictions, by card
}

export default function Timeline(props: Props) {
  const { level, plan, platform, selectedTick, selectedCard, shotDown } = props
  const [dragging, setDragging] = useState<number | null>(null)
  const N = level.ticks
  const ticks = Array.from({ length: N }, (_, i) => i + 1)
  const sched = schedule(plan, platform, N)
  const empLen = empDuration(level)

  // Windows the plan opens (by when its EMPs and chaff will land).
  const emp = new Array(N + 2).fill(0)
  const chaff = new Array(N + 2).fill(0)
  plan.forEach((a, i) => {
    const launch = sched.launch[i]
    if (launch === null) return
    const arrive = launch + WEAPONS[a.w].transit
    if (a.w === 'emp') for (let t = arrive; t < arrive + empLen && t <= N; t++) emp[t]++
    if (a.w === 'chaff') for (let t = arrive; t < arrive + 2 && t <= N; t++) chaff[t]++
  })

  return (
    <div className="os-timeline" style={{ gridTemplateColumns: `repeat(${N}, minmax(42px, 1fr))` }}>
      {ticks.map((t) => (
        <button
          key={`h${t}`}
          className={`os-tl-head ${t === selectedTick ? 'active' : ''}`}
          onClick={() => props.onSelectTick(t)}
          aria-label={`Select tick ${t}`}
        >
          T{t}
        </button>
      ))}
      {ticks.map((t) => (
        <div
          key={`c${t}`}
          className={`os-tl-col ${t === selectedTick ? 'active' : ''} ${dragging !== null ? 'droppable' : ''}`}
          onClick={() => {
            props.onSelectTick(t)
            props.onSelectCard(null)
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            if (dragging !== null) props.onMove(dragging, t)
            setDragging(null)
          }}
        >
          {plan.map((a, i) => {
            if (a.tick !== t) return null
            const d = WEAPONS[a.w]
            const launch = sched.launch[i]
            const arrive = launch === null ? null : launch + d.transit
            const stutter = sched.stutter[i]
            const down = shotDown?.get(i)
            return (
              <div
                key={i}
                className={`os-card ${stutter ? 'stutter' : ''} ${selectedCard === i ? 'selected' : ''}`}
                style={{ borderColor: d.color }}
                draggable
                onDragStart={() => setDragging(i)}
                onDragEnd={() => setDragging(null)}
                onClick={(e) => {
                  e.stopPropagation()
                  props.onSelectCard(selectedCard === i ? null : i)
                }}
                title={`${d.name} → ${targetLabel(level, a.target)}`}
              >
                <span className="os-card-icon">{d.icon}</span>
                <span className="os-card-target">{targetLabel(level, a.target)}</span>
                <span className="os-card-arc">
                  {arrive === null ? 'never' : `→T${arrive}`}
                  {stutter > 0 && <b> +{stutter}</b>}
                </span>
                {down && <span className="os-card-down">🎯 {down}</span>}
                {selectedCard === i && (
                  <span className="os-card-ctl">
                    <button onClick={(e) => (e.stopPropagation(), props.onMove(i, Math.max(1, t - 1)))} aria-label="Earlier">
                      ◀
                    </button>
                    <button onClick={(e) => (e.stopPropagation(), props.onMove(i, Math.min(N, t + 1)))} aria-label="Later">
                      ▶
                    </button>
                    <button onClick={(e) => (e.stopPropagation(), props.onRemove(i))} aria-label="Remove">
                      ✕
                    </button>
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ))}
      {ticks.map((t) => {
        const heat = sched.heat[t] ?? 0
        const frac = Math.min(1, heat / platform.heatCap)
        return (
          <div key={`heat${t}`} className="os-tl-heat" title={`Heat after tick ${t} launches: ${heat}/${platform.heatCap}`}>
            <div className={`os-heat-bar ${frac >= 1 ? 'max' : frac > 0.7 ? 'hot' : ''}`} style={{ height: `${frac * 100}%` }} />
            <span>{heat}</span>
          </div>
        )
      })}
      {ticks.map((t) => (
        <div key={`def${t}`} className="os-tl-def">
          {level.structures
            .filter((s) => s.kind === 'battery' && s.fireAt === t)
            .map((s) => (
              <span key={s.id} className="os-chip bad" title={`${s.name} fires at the end of tick ${t}`}>
                ⊥ {s.name.split(' ')[0]}
              </span>
            ))}
          {level.modifiers?.dustTicks?.includes(t) && <span className="os-chip dust">🪨 dust</span>}
          {emp[t] > 0 && <span className="os-chip emp">🌀{emp[t] > 1 ? `×${emp[t]}` : ''}</span>}
          {chaff[t] > 0 && <span className="os-chip chaff">✨{chaff[t] > 1 ? `×${chaff[t]}` : ''}</span>}
        </div>
      ))}
    </div>
  )
}
