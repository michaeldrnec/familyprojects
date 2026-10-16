// Debrief: the outcome, the first thing that went wrong, badges and salvage.
import { BADGE_INFO, badgeGoal, badgesFor, earnedBadges } from './badges'
import type { Settlement } from './progress'
import type { SimResult } from './sim'
import type { Level } from './types'

interface Props {
  level: Level
  result: SimResult
  settlement: Settlement | null // null for replays
  isDaily: boolean
  streak: number
  onRetry: () => void
  onNext: (() => void) | null
  onMap: () => void
  onCopy: () => void
}

export default function Debrief({ level, result, settlement, isDaily, streak, onRetry, onNext, onMap, onCopy }: Props) {
  const win = result.outcome === 'win'
  const earned = earnedBadges(level, result)
  return (
    <div className={`os-debrief ${win ? 'win' : 'lose'}`} role="dialog" aria-label="Debrief">
      <h2>{win ? '✅ Fortress offline' : '❌ Mission failed'}</h2>
      <p className="os-reason">{result.reason}</p>
      {!win && result.cause && result.cause !== result.reason && (
        <p className="os-cause">
          First thing that went wrong: <b>{result.cause}</b>
        </p>
      )}
      <p className="os-muted">
        {result.energy} MW used{win ? ` · won on tick ${result.winTick}` : ''}
        {result.collateral > 0 ? ` · ${result.collateral} protected site${result.collateral > 1 ? 's' : ''} hit` : ''}
      </p>
      {win && (
        <ul className="os-badges">
          {badgesFor(level).map((b) => (
            <li key={b} className={earned.includes(b) ? 'got' : ''}>
              {BADGE_INFO[b].icon} <b>{BADGE_INFO[b].name}</b> <span className="os-muted">{badgeGoal(level, b)}</span>
              {settlement?.newBadges.includes(b) && <em> new!</em>}
            </li>
          ))}
        </ul>
      )}
      {settlement && settlement.salvage > 0 && <p className="os-salvage">+{settlement.salvage} salvage ⚙️</p>}
      {settlement?.newBest && <p className="os-muted">New best plan saved. Replay it from the star map.</p>}
      {isDaily && win && settlement && <p className="os-salvage">Daily streak: {streak} 🔥</p>}
      {!settlement && <p className="os-muted">Replay: no rewards.</p>}
      <div className="os-debrief-btns">
        <button className="os-btn" onClick={onRetry}>
          ✏️ {win ? 'Edit plan' : 'Retry'}
        </button>
        {onNext && (
          <button className="os-btn os-btn-primary" onClick={onNext}>
            Next ▶
          </button>
        )}
        <button className="os-btn" onClick={onCopy}>
          🔗 Copy code
        </button>
        <button className="os-btn" onClick={onMap}>
          🪐 Star map
        </button>
      </div>
    </div>
  )
}
