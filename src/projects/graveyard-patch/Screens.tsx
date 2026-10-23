// The screens around a night: the week menu (pick a night, read the
// briefing, buy upgrades) and the end-of-night results.
import ResultCard from '../../shared/ui/ResultCard'
import { NIGHTS, UPGRADES, clockLabel, type UpgradeId } from './sim/config'
import type { NightResult } from './sim/night'
import type { Progress } from './progress'

// "★★★☆☆ 3.5"
function starText(stars: number) {
  const full = Math.floor(stars)
  return `${'★'.repeat(full)}${'☆'.repeat(5 - full)} ${stars.toFixed(1)}`
}

export function Menu({
  progress,
  selected,
  onSelect,
  onStart,
  onBuy,
}: {
  progress: Progress
  selected: number
  onSelect: (night: number) => void
  onStart: () => void
  onBuy: (id: UpgradeId) => void
}) {
  const cfg = NIGHTS[selected]
  return (
    <div className="gp-menu">
      <header className="gp-title">
        <h1>Graveyard Patch</h1>
        <p className="gp-tagline">
          It’s 11:00 PM. Galaxy Gardeners launches at 6:00 AM, the bug reports won’t stop, and your eyelids weigh a ton. Fix bugs, ship
          patches, stay awake.
        </p>
      </header>

      <nav className="gp-week" aria-label="Choose a night">
        {NIGHTS.map((n, i) => {
          const locked = i > progress.unlocked
          return (
            <button
              key={n.day}
              type="button"
              className={'gp-night' + (i === selected ? ' selected' : '')}
              disabled={locked}
              aria-pressed={i === selected}
              onClick={() => onSelect(i)}
            >
              <span className="gp-night-day">{n.day}</span>
              <span className="gp-night-stars">{locked ? '🔒' : progress.bestStars[i] > 0 ? starText(progress.bestStars[i]) : 'not shipped'}</span>
            </button>
          )
        })}
      </nav>

      <section className="gp-card gp-briefing">
        <h2>{cfg.day} night</h2>
        <ul>
          {cfg.briefing.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <button type="button" className="gp-primary" onClick={onStart}>
          Clock in
        </button>
      </section>

      <section className="gp-card gp-shop">
        <div className="gp-shop-head">
          <h2>Upgrade your setup</h2>
          <span className="gp-wallet">💰 {progress.pay} Overtime Pay</span>
        </div>
        <div className="gp-upgrades">
          {UPGRADES.map((u) => {
            const owned = progress.owned.includes(u.id)
            return (
              <div key={u.id} className={'gp-upgrade' + (owned ? ' owned' : '')}>
                <span className="gp-upgrade-icon" aria-hidden="true">
                  {u.icon}
                </span>
                <div>
                  <strong>{u.name}</strong>
                  <p>{u.blurb}</p>
                </div>
                <button type="button" className="gp-btn" disabled={owned || progress.pay < u.cost} onClick={() => onBuy(u.id)}>
                  {owned ? 'Owned' : `Buy · ${u.cost}`}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      <details className="gp-card gp-help">
        <summary>How to play</summary>
        <ul>
          <li>Bugs arrive as tickets. Open ones drain your star rating: P3 slowly, P1 fast, P0 server fires fastest.</li>
          <li>
            <strong>Fix</strong> a ticket to play its mini-game. <strong>Bug Hunt</strong>: tap or click the bugs before they crawl off
            the screen. <strong>Spaghetti Unravel</strong>: drag the nodes until no wires cross.
          </li>
          <li>
            <strong>🎲 Quick Patch</strong> fixes a bug instantly, but 1 in 5 quietly creates two new ones. Server fires need a real fix.
          </li>
          <li>
            Fixed bugs are staged. <strong>Deploy</strong> (<kbd>Enter</kbd>) ships them and wins back stars. Nothing ships while a P0 is
            open, and deploying while half asleep can break the build.
          </li>
          <li>
            Stay awake: mash <kbd>Space</kbd>, drink coffee (<kbd>C</kbd>), splash water (<kbd>W</kbd>). Three coffees without water
            means a crash.
          </li>
          <li>
            <kbd>1</kbd>–<kbd>9</kbd> open tickets, <kbd>Q</kbd> quick-patches the oldest small bug, <kbd>Backspace</kbd> puts a ticket
            back, <kbd>P</kbd> or <kbd>Esc</kbd> pauses.
          </li>
          <li>Last until 6:00 AM without hitting zero stars or falling asleep.</li>
        </ul>
      </details>
    </div>
  )
}

const HEADLINE = {
  survived: 'Shipped it! ☀️',
  asleep: 'You fell asleep 💤',
  rating: 'Zero stars 📉',
}

export function Results({
  night,
  result,
  progress,
  onNext,
  onRetry,
  onMenu,
}: {
  night: number
  result: NightResult
  progress: Progress
  onNext: (() => void) | null
  onRetry: () => void
  onMenu: () => void
}) {
  const survived = result.outcome === 'survived'
  const s = result.stats
  return (
    <div className="gp-menu gp-results">
      <h1>{HEADLINE[result.outcome]}</h1>
      <p className="gp-tagline">
        {survived
          ? `${NIGHTS[night].day} night is done. Standup is in five minutes.`
          : result.outcome === 'asleep'
            ? `Face down on the keyboard at ${clockLabel(result.reached)}. The keyboard typed “zzzzzzzzzzz” into production.`
            : `Your rating hit zero at ${clockLabel(result.reached)}. The players have moved on to a farming game about bees.`}
      </p>
      <ResultCard score={survived ? <span className="gp-result-stars">{starText(result.stars)}</span> : '☕'} celebrate={survived && result.stars >= 4}>
        <ul className="gp-result-stats">
          <li>
            🚀 {s.shipped} patch{s.shipped === 1 ? '' : 'es'} shipped
          </li>
          <li>
            🎲 {s.quickPatches} quick patch{s.quickPatches === 1 ? '' : 'es'} ({s.quickBackfires} backfired)
          </li>
          {s.broken > 0 && <li>💥 {s.broken} broken build{s.broken === 1 ? '' : 's'}</li>}
          <li>
            ☕ {s.coffees} coffee{s.coffees === 1 ? '' : 's'} · 💧 {s.waters} splash{s.waters === 1 ? '' : 'es'}
          </li>
          <li className="gp-pay">
            💰 +{result.pay} Overtime Pay{!survived && ' (half pay)'} · {progress.pay} in the bank
          </li>
        </ul>
        <div className="gp-result-buttons">
          {onNext && (
            <button type="button" className="gp-primary" onClick={onNext}>
              {NIGHTS[night + 1].day} night
            </button>
          )}
          <button type="button" className={onNext ? 'gp-secondary' : 'gp-primary'} onClick={onRetry}>
            {survived ? 'Replay night' : 'Try again'}
          </button>
          <button type="button" className="gp-secondary" onClick={onMenu}>
            Week &amp; upgrades
          </button>
        </div>
      </ResultCard>
      {survived && night === NIGHTS.length - 1 && <p className="gp-tagline">🎉 Launch day! You made it through the whole week.</p>}
    </div>
  )
}
