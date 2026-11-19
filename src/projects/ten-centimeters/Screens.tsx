// The screens around a shift: the menu (pick a shift, read its briefing,
// how to play) and the end-of-shift results.
import ResultCard from '../../shared/ui/ResultCard'
import { RANKS, RESULT_LINES } from './content'
import type { Progress } from './progress'
import { SHIFTS } from './sim/config'
import type { ShiftResult } from './sim/shift'
import type { BabyLog } from './sim/types'

function starText(stars: number) {
  return '★'.repeat(stars) + '☆'.repeat(3 - stars)
}

export function Menu({
  selected,
  progress,
  onSelect,
  onStart,
}: {
  selected: number
  progress: Progress
  onSelect: (shift: number) => void
  onStart: () => void
}) {
  const cfg = SHIFTS[selected]
  const locked = selected > progress.unlocked
  return (
    <div className="tc-menu">
      <header className="tc-title">
        <h1>10 Centimeters</h1>
        <p className="tc-tagline">
          It’s 7:00 PM on the Labor &amp; Delivery floor. Four bays, one OR, one doctor: you. Keep every mom comfortable, every baby’s heart
          steady, and catch every baby before 7:00 AM.
        </p>
      </header>

      <nav className="tc-shifts" aria-label="Choose a shift">
        {SHIFTS.map((sh, i) => {
          const open = i <= progress.unlocked
          return (
            <button
              key={sh.name}
              type="button"
              className={'tc-shift' + (i === selected ? ' is-selected' : '') + (open ? '' : ' is-locked')}
              aria-pressed={i === selected}
              onClick={() => onSelect(i)}
            >
              <span className="tc-shift-num">Shift {i + 1}</span>
              <span className="tc-shift-name">{open ? sh.name : '🔒 Locked'}</span>
              <span className="tc-shift-stars" aria-label={`Best: ${progress.bestStars[i]} stars`}>
                {open ? starText(progress.bestStars[i]) : ''}
              </span>
            </button>
          )
        })}
      </nav>

      <section className="tc-card">
        <h2>
          Shift {selected + 1}: {cfg.name}
        </h2>
        {locked ? (
          <p className="tc-dim">Earn a star on Shift {selected} to open this one.</p>
        ) : (
          <>
            <ul>
              {cfg.briefing.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {progress.bestScore[selected] > 0 && (
              <p className="tc-dim tc-small">
                Best: {starText(progress.bestStars[selected])} · {progress.bestScore[selected]} points
              </p>
            )}
            <button type="button" className="tc-primary" onClick={onStart}>
              Start shift
            </button>
          </>
        )}
      </section>

      <details className="tc-card tc-help">
        <summary>How to play</summary>
        <ul>
          <li>
            <strong>Move:</strong> tap or click a room to walk there, or use <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> / arrow keys. <kbd>1</kbd>–<kbd>4</kbd> walk to a bay, <kbd>5</kbd> Supply, <kbd>6</kbd> the sink, <kbd>7</kbd> the
            OR.
          </li>
          <li>
            <strong>Dilation</strong> climbs toward 10 cm. At 10 cm, <strong>Deliver</strong> (<kbd>Space</kbd>). Wait too long and the
            midwife steps in for fewer points.
          </li>
          <li>
            <strong>Delivering:</strong> push (tap, or <kbd>Space</kbd>) when the marker is in the green zone. A calmer mom gives a slower
            meter.
          </li>
          <li>
            <strong>Supply</strong> holds Pitocin, epidurals, magnesium and oxygen masks. You can carry two. Tap an item in the top bar to
            put it back.
          </li>
          <li>
            <strong>Pitocin</strong> (<kbd>Z</kbd>) doubles the pace for a while and restarts a stalled labor. Two bags at once risks the
            baby’s heart rate. <strong>Epidural</strong> (<kbd>X</kbd>) keeps Mom calm, but only before 8 cm.
          </li>
          <li>
            <strong>Heart rate strips:</strong> green is fine, yellow is a warning, red means baby’s oxygen is dropping. An oxygen mask
            (<kbd>V</kbd>) or repositioning (<kbd>B</kbd>) buys time; delivery fixes it.
          </li>
          <li>
            <strong>Code Stork</strong> (<kbd>Enter</kbd>) sends a mom with a complication to the OR for a C-section. Scrub in at the sink
            first (stand still for a moment), then walk into the OR. Surgery is five quick steps: trace the incision, pop the fluid
            bubbles, lift the baby out gently, clamp and cut the cord, and stitch up.
          </li>
          <li>
            <strong>Preeclampsia:</strong> magnesium (<kbd>C</kbd>) calms her blood pressure. If her stress reaches 100, the baby goes
            into distress.
          </li>
          <li>If a baby’s oxygen runs out, the specialist team takes over. Three calls and the shift is over.</li>
          <li>
            Each baby earns up to 3 stars: keep baby’s oxygen up, Mom’s stress down, and play the delivery well. Earn a star on a shift to
            open the next.
          </li>
          <li>
            <kbd>P</kbd> or <kbd>Esc</kbd> pauses.
          </li>
        </ul>
      </details>
    </div>
  )
}

const HOW: Record<BabyLog['how'], string> = {
  delivery: '👶 Delivered',
  csection: '🚨 Code Stork',
  midwife: '🤱 Midwife',
  transfer: '🚑 Specialists',
}

export function Results({
  shift,
  result,
  best,
  newBest,
  onNext,
  onRetry,
  onMenu,
}: {
  shift: number
  result: ShiftResult
  best: number
  newBest: boolean
  onNext: (() => void) | null
  onRetry: () => void
  onMenu: () => void
}) {
  const done = result.outcome === 'complete'
  const l = result.ledger
  const rows: [string, number][] = [
    ['Baby stars', l.babies],
    ['Delivery skill', l.skill],
    ['Code Stork bonus', l.codeStork],
    ['Midwife deliveries', l.midwife],
    ['Specialist calls', l.transfers],
    ['Stressed moms', l.stress],
    ['Waiting in triage', l.waiting],
  ]
  return (
    <div className="tc-menu tc-results">
      <h1>{done ? 'Shift complete! 🌅' : 'Specialists to the floor 🚑'}</h1>
      <p className="tc-tagline">{done ? RESULT_LINES.complete : RESULT_LINES.sentHome}</p>
      <ResultCard score={<span className="tc-result-stars">{starText(result.stars)}</span>} celebrate={done && result.stars === 3}>
        <p className="tc-rank">
          {RANKS[result.stars]}
          {newBest && <span className="tc-new-best">New best!</span>}
        </p>
        <ul className="tc-result-stats">
          <li>⭐ {result.score} points</li>
          <li>
            👶 {result.deliveries} {result.deliveries === 1 ? 'baby' : 'babies'} delivered
            {result.csections > 0 && ` (${result.csections} by Code Stork)`}
          </li>
          {result.deliveries > 0 && <li>🍼 Average grade {result.babyStars.toFixed(1)} ★</li>}
          {result.midwife > 0 && <li>🤱 {result.midwife} caught by the midwife</li>}
          <li>⚠️ {result.complications} complications</li>
          {result.transfers > 0 && <li>🚑 {result.transfers} specialist calls</li>}
        </ul>

        <details className="tc-scorecard">
          <summary>Scorecard</summary>
          <table>
            <tbody>
              {rows
                .filter(([, v]) => Math.round(v) !== 0)
                .map(([name, v]) => (
                  <tr key={name}>
                    <th scope="row">{name}</th>
                    <td className={v < 0 ? 'is-minus' : ''}>{(v > 0 ? '+' : '') + Math.round(v)}</td>
                  </tr>
                ))}
              <tr className="tc-total">
                <th scope="row">Total</th>
                <td>{result.score}</td>
              </tr>
            </tbody>
          </table>
          {result.log.length > 0 && (
            <ol className="tc-babies">
              {result.log.map((b, i) => (
                <li key={i}>
                  <span>{b.name}</span>
                  <span className="tc-dim">{HOW[b.how]}</span>
                  <span className="tc-baby-stars">{b.stars > 0 ? starText(b.stars) : ''}</span>
                </li>
              ))}
            </ol>
          )}
        </details>

        <p className="tc-dim tc-small">
          Stars at {SHIFTS[shift].stars.join(' / ')} points{best > 0 ? ` · your best ${best}` : ''}
        </p>
        <div className="tc-result-buttons">
          {onNext && (
            <button type="button" className="tc-primary" onClick={onNext}>
              Shift {shift + 2}
            </button>
          )}
          <button type="button" className={onNext ? 'tc-secondary' : 'tc-primary'} onClick={onRetry}>
            {done ? 'Replay shift' : 'Try again'}
          </button>
          <button type="button" className="tc-secondary" onClick={onMenu}>
            All shifts
          </button>
        </div>
      </ResultCard>
    </div>
  )
}
