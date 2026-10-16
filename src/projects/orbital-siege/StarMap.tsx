// Star map: the four sectors with their level nodes and badge pips, the
// daily puzzle, the Refit Bay and share-code loading.
import { useState } from 'react'
import { BADGE_INFO, badgeGoal, badgesFor } from './badges'
import { prettyDate } from './daily'
import { LEVELS, SECTORS } from './levels'
import { isUnlocked, levelSave, liveStreak, type SaveData } from './progress'
import { WEAPONS, WEAPON_ORDER } from './weapons'

interface Props {
  save: SaveData
  today: string
  onPlay: (id: string) => void
  onReplay: (id: string) => void
  onCopyBest: (id: string) => void
  onDaily: () => void
  onReplayDaily: () => void
  onRefit: () => void
  onLoadCode: (code: string) => string | null
  onReset: () => void
}

export default function StarMap(props: Props) {
  const { save, today } = props
  const firstOpen = LEVELS.find((l) => isUnlocked(save, l.id) && !levelSave(save, l.id).cleared) ?? LEVELS[LEVELS.length - 1]
  const [selected, setSelected] = useState(firstOpen.id)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const level = LEVELS.find((l) => l.id === selected)!
  const ls = levelSave(save, level.id)
  const cleared = LEVELS.filter((l) => levelSave(save, l.id).cleared).length
  const streak = liveStreak(save, today)
  const dailyBest = save.daily.date === today && save.daily.best

  return (
    <div className="os-screen os-map">
      <header className="os-map-title">
        <div>
          <h1>🪐 Orbital Siege</h1>
          <p className="os-muted">
            Program the Warden Platform’s strike timeline and shut down the rogue Sentinel fortresses, one layer at a
            time. Every tick is deterministic: every failure is a flaw in the plan.
          </p>
        </div>
        <div className="os-map-stats">
          <span title="Salvage">⚙️ {save.salvage}</span>
          <span title="Levels cleared">
            ✓ {cleared}/{LEVELS.length}
          </span>
          <button className="os-btn" onClick={props.onRefit}>
            🔧 Refit Bay
          </button>
        </div>
      </header>

      <div className="os-map-grid">
        <section className="os-sectors">
          {SECTORS.map((sec) => {
            const open = isUnlocked(save, sec.levels[0].id)
            const newWeapons = WEAPON_ORDER.filter((w) => WEAPONS[w].sector === sec.n)
            return (
              <div key={sec.n} className={`os-sector ${open ? '' : 'locked'}`}>
                <div className="os-sector-head">
                  <h3>
                    Sector {sec.n}: {sec.name}
                  </h3>
                  <span className="os-muted" title="Weapons unlocked here">
                    {newWeapons.map((w) => WEAPONS[w].icon).join(' ')}
                  </span>
                </div>
                <div className="os-nodes">
                  {sec.levels.map((l) => {
                    const s = levelSave(save, l.id)
                    const unlocked = isUnlocked(save, l.id)
                    return (
                      <button
                        key={l.id}
                        className={`os-node ${s.cleared ? 'cleared' : ''} ${selected === l.id ? 'selected' : ''}`}
                        disabled={!unlocked}
                        onClick={() => setSelected(l.id)}
                        title={unlocked ? l.name : 'Locked: clear the previous level'}
                      >
                        <span className="os-node-id">{unlocked ? l.id : '🔒'}</span>
                        <span className="os-pips">
                          {badgesFor(l).map((b) => (
                            <i key={b} className={s.badges.includes(b) ? 'on' : ''} />
                          ))}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </section>

        <aside className="os-map-side">
          <div className="os-panel">
            <h3>
              {level.id} · {level.name}
            </h3>
            <p>{level.brief}</p>
            <ul className="os-badges">
              {badgesFor(level).map((b) => (
                <li key={b} className={ls.badges.includes(b) ? 'got' : ''}>
                  {BADGE_INFO[b].icon} <b>{BADGE_INFO[b].name}</b> <span className="os-muted">{badgeGoal(level, b)}</span>
                </li>
              ))}
            </ul>
            {ls.best && (
              <p className="os-muted">
                Best: {ls.bestEnergy} MW, won on tick {ls.bestTick}
              </p>
            )}
            <div className="os-row">
              <button className="os-btn os-btn-primary" onClick={() => props.onPlay(level.id)}>
                ▶ {ls.cleared ? 'Replay mission' : 'Start mission'}
              </button>
              {ls.best && (
                <>
                  <button className="os-btn" onClick={() => props.onReplay(level.id)}>
                    🎞 Watch best
                  </button>
                  <button className="os-btn" onClick={() => props.onCopyBest(level.id)}>
                    🔗 Best code
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="os-panel os-daily">
            <h3>📅 Daily siege · {prettyDate(today)}</h3>
            <p className="os-muted">
              A fresh fortress every day, the same for everyone. Base platform only. Never solvable in two moves.
            </p>
            <p>
              Streak: <b>{streak}</b> 🔥
              {dailyBest && (
                <>
                  {' '}
                  · today’s best: {save.daily.bestEnergy} MW, tick {save.daily.bestTick}
                </>
              )}
            </p>
            <div className="os-row">
              <button className="os-btn os-btn-primary" onClick={props.onDaily}>
                ▶ Play today’s siege
              </button>
              {dailyBest && (
                <button className="os-btn" onClick={props.onReplayDaily}>
                  🎞 Watch best
                </button>
              )}
            </div>
          </div>

          <div className="os-panel">
            <h3>🔗 Load a share code</h3>
            <form
              className="os-row"
              onSubmit={(e) => {
                e.preventDefault()
                setCodeError(props.onLoadCode(code))
              }}
            >
              <input
                className="os-input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="OS1-3-2-…"
                aria-label="Share code"
              />
              <button className="os-btn" type="submit" disabled={!code.trim()}>
                Load
              </button>
            </form>
            {codeError && <p className="os-error">{codeError}</p>}
          </div>

          <details className="os-panel os-howto">
            <summary>How to play</summary>
            <ol>
              <li>
                <b>Recon.</b> Tap anything on the cross-section for its intel: armor, timers, PDC priorities, what
                powers what.
              </li>
              <li>
                <b>Sequence.</b> Pick a weapon (or press 1–8), pick a tick on the timeline (← →), then tap a target. Each
                card shows when it lands. Drag cards, or tap one for ◀ ▶ ✕.
              </li>
              <li>
                <b>Watch the heat.</b> Each launch adds heat; the platform cools a little every tick. Anything that would
                overheat it waits a tick (amber).
              </li>
              <li>
                <b>Execute.</b> The battle plays out exactly the same every time. Read the event log, fix the plan, try
                again.
              </li>
              <li>
                Each tick runs in order: launches → EMP and chaff land → PDCs fire → strikes (beams first) → batteries
                fire.
              </li>
            </ol>
          </details>

          <div className="os-reset">
            {confirmReset ? (
              <>
                <span>Erase all progress?</span>
                <button className="os-btn danger" onClick={props.onReset}>
                  Yes, reset
                </button>
                <button className="os-btn" onClick={() => setConfirmReset(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button className="os-btn subtle" onClick={() => setConfirmReset(true)}>
                Reset progress
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
