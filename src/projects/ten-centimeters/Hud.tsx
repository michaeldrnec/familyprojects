// The in-shift HUD around the floor: the top bar (clock, score, hands,
// mute, pause), the action bar for the selected bay (or the supply shelf
// while standing at Supply), and the message toasts.
import { useMuted } from '../../shared/audio'
import { ACTION_LABELS, ITEM_LABELS } from './content'
import { HANDS, MAX_TRANSFERS, SHIFT_SECONDS, SHIFTS, clockLabel } from './sim/config'
import { actionAvailable, actionCheck, itemAvailable, patientInBay } from './sim/shift'
import { ACTIONS, ITEMS, type Action, type Item, type ShiftState } from './sim/types'
import { ACTION_KEYS, ITEM_KEYS } from './keys'

export function TopBar({ s, onDrop, onPause }: { s: ShiftState; onDrop: (i: number) => void; onPause: () => void }) {
  const d = s.doctor
  const [muted, toggleMuted] = useMuted()
  const elapsed = 1 - s.timeRemaining / SHIFT_SECONDS
  return (
    <div className="tc-topbar">
      <div className="tc-clock" title="Shift ends at 7:00 AM">
        <strong>{clockLabel(s.timeRemaining)}</strong>
        <span className="tc-clock-bar">
          <span style={{ width: `${elapsed * 100}%` }} />
        </span>
      </div>
      <span className="tc-stat" title="Score">
        ⭐ {Math.max(0, Math.round(s.score))}
      </span>
      <span className="tc-stat" title="Babies delivered">
        👶 {s.deliveriesCompleted + s.midwifeDeliveries}
      </span>
      <span className={'tc-stat' + (s.transfers ? ' is-alert' : '')} title={`Specialist team calls (${MAX_TRANSFERS} ends the shift)`}>
        🚑 {s.transfers}/{MAX_TRANSFERS}
      </span>
      <div className="tc-hands" aria-label="What you're carrying">
        {Array.from({ length: HANDS }, (_, i) => {
          const item = d.hands[i]
          return item ? (
            <button key={i} type="button" className="tc-hand" onClick={() => onDrop(i)} title={`Put back ${ITEM_LABELS[item].name}`}>
              {ITEM_LABELS[item].icon}
              <span>{ITEM_LABELS[item].short}</span>
            </button>
          ) : (
            <span key={i} className="tc-hand is-empty" aria-hidden="true">
              ✋
            </span>
          )
        })}
      </div>
      <span className={'tc-task' + (d.isScrubbedIn ? ' is-scrubbed' : '')}>{d.isScrubbedIn ? '🧼 Scrubbed in' : d.currentTask}</span>
      <button type="button" className="tc-icon-btn" onClick={toggleMuted} title={muted ? 'Sound off' : 'Sound on'} aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted}>
        {muted ? '🔇' : '🔊'}
      </button>
      <button type="button" className="tc-icon-btn" onClick={onPause} title="Pause (P or Esc)" aria-label="Pause">
        ⏸
      </button>
    </div>
  )
}

export function ActionBar({
  s,
  selected,
  onAction,
  onPick,
}: {
  s: ShiftState
  selected: number | null
  onAction: (a: Action) => void
  onPick: (item: Item) => void
}) {
  const d = s.doctor
  if (d.at === 'supply') {
    const full = d.hands.length >= HANDS
    return (
      <div className="tc-actionbar">
        <div className="tc-actionbar-head">
          <strong>Supply</strong>
          <span className="tc-dim">{full ? 'Hands full. Tap an item up top to put it back.' : `Pick up to ${HANDS} items.`}</span>
        </div>
        <div className="tc-actions">
          {ITEMS.filter((item) => itemAvailable(s, item)).map((item) => (
            <button key={item} type="button" className="tc-action" disabled={full} onClick={() => onPick(item)}>
              <span className="tc-action-icon">{ITEM_LABELS[item].icon}</span>
              <span className="tc-action-name">{ITEM_LABELS[item].name}</span>
              <kbd>{ITEM_KEYS[item]}</kbd>
            </button>
          ))}
        </div>
      </div>
    )
  }
  if (d.at === 'sink' && !d.isScrubbedIn) {
    return (
      <div className="tc-actionbar">
        <div className="tc-actionbar-head">
          <strong>Scrub sink</strong>
          <span className="tc-dim">Stand still to scrub in…</span>
        </div>
      </div>
    )
  }
  const p = selected === null ? undefined : patientInBay(s, selected)
  if (selected === null || !p) {
    return (
      <div className="tc-actionbar">
        <div className="tc-actionbar-head">
          <strong>{selected === null ? 'Tap a bay to see your patient' : `Bay ${selected + 1} is empty`}</strong>
          <span className="tc-dim">Supply has Pitocin and epidurals{SHIFTS[s.shift].codeStork ? ', and the OR needs a scrub first' : ''}.</span>
        </div>
      </div>
    )
  }
  const here = d.at === `bay${selected}`
  return (
    <div className="tc-actionbar">
      <div className="tc-actionbar-head">
        <strong>
          Bay {selected + 1} · {p.name}
        </strong>
        <span className="tc-dim">{here ? 'At the bedside' : 'Tap an action to walk over and do it'}</span>
      </div>
      <div className="tc-actions">
        {ACTIONS.filter((a) => actionAvailable(s, a)).map((a) => {
          const check = actionCheck(s, p, a)
          const urgent = check.ok && (a === 'deliver' || (a === 'codeStork' && p.distress))
          return (
            <button
              key={a}
              type="button"
              className={'tc-action' + (urgent ? ' is-urgent' : '') + (a === 'codeStork' ? ' is-code' : '')}
              disabled={!check.ok}
              onClick={() => onAction(a)}
              title={check.reason}
            >
              <span className="tc-action-icon">{ACTION_LABELS[a].icon}</span>
              <span className="tc-action-name">{ACTION_LABELS[a].name}</span>
              {check.ok ? <kbd>{ACTION_KEYS[a]}</kbd> : <span className="tc-reason">{check.reason}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function Toasts({ s }: { s: ShiftState }) {
  return (
    <ul className="tc-toasts" aria-live="polite">
      {s.toasts.map((t) => (
        <li key={t.id} className={`tc-toast is-${t.tone}`}>
          {t.text}
        </li>
      ))}
    </ul>
  )
}
