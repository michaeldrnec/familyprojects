import { useState } from 'react'
import { CONTRACTS, contractVisible } from './contracts'
import { PART_DEFS } from './parts'
import type { SaveData } from './progress'
import { formatAlt } from './format'
import { STRATEGY_GUIDE } from './hints'
import { jobBrief, jobTitle, refillJobs } from './jobs'

interface Props {
  save: SaveData
  onChange: (save: SaveData) => void
  onWorkshop: () => void
  onShop: () => void
  onReset: () => void
}

export default function Hub({ save, onChange, onWorkshop, onShop, onReset }: Props) {
  const [confirmReset, setConfirmReset] = useState(false)
  const visible = CONTRACTS.filter((c) => contractVisible(c, save.completed))
  const hidden = CONTRACTS.length - visible.length

  return (
    <div className="sb-screen sb-hub">
      <header className="sb-hub-title">
        <h1>Scrapyard Ballistics</h1>
        <p className="sb-tagline">The Junker’s Space Program — reach orbit on a budget of zero.</p>
      </header>

      <div className="sb-hub-grid">
        <section className="sb-card sb-hub-status">
          <h2>The Barn</h2>
          <dl className="sb-stats">
            <dt>Cash</dt>
            <dd className="sb-cash">${save.cash.toLocaleString()}</dd>
            <dt>Best altitude</dt>
            <dd>{formatAlt(save.bestAltitude)}</dd>
            <dt>Flights</dt>
            <dd>{save.flights}</dd>
          </dl>
          <div className="sb-hub-actions">
            <button className="sb-btn sb-btn-primary" onClick={onWorkshop}>
              🔧 Workshop
            </button>
            <button className="sb-btn" onClick={onShop}>
              🕶️ Black Market
            </button>
          </div>
          <details className="sb-howto">
            <summary>How to play</summary>
            <ol>
              <li>
                <b>Build</b> in the Workshop: tap a part, tap the grid, drag to move. Welds (yellow ticks) form wherever
                faces touch. Watch the center-of-mass roundel and the red thrust-torque arrow. A ready-made Fence Hopper
                is waiting on the board for your first flight.
              </li>
              <li>
                <b>Wire</b> it: tap a dashboard terminal (IGNITE, STAGE 1–4) then a part to run a wire. Or hit{' '}
                <b>Auto-wire</b>.
              </li>
              <li>
                <b>Fly</b>: IGNITE, then steer with A/D (or ◀ ▶), throttle W/S. Throttle down through Max-Q or the
                welds snap. Blow bolts to stage. Pop the chute low and slow.
              </li>
              <li>
                <b>Salvage</b>: parts that land softly come back. Cash buys better junk.
              </li>
            </ol>
          </details>
          <details className="sb-howto">
            <summary>Strategy guide</summary>
            {STRATEGY_GUIDE.map((g) => (
              <div key={g.title}>
                <h4>{g.title}</h4>
                <ul>
                  {g.tips.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            ))}
          </details>
        </section>

        <section className="sb-card sb-contracts">
          <h2>Contract Board</h2>
          <ul>
            {visible.map((c) => {
              const done = save.completed.includes(c.id)
              return (
                <li key={c.id} className={done ? 'done' : ''}>
                  <div className="sb-contract-head">
                    <span className="sb-contract-title">
                      {done ? '✔ ' : ''}
                      {c.title}
                    </span>
                    <span className="sb-contract-pay">{done ? 'paid' : `$${c.payout.toLocaleString()}`}</span>
                  </div>
                  <p>{c.brief}</p>
                  {c.grants && !done && (
                    <p className="sb-contract-grant">Bonus: {c.grants.map((g) => PART_DEFS[g].name).join(', ')}</p>
                  )}
                </li>
              )
            })}
            {hidden > 0 && <li className="sb-contract-locked">+ {hidden} more contract(s) once you prove yourself…</li>}
          </ul>
        </section>

        <section className="sb-card sb-contracts sb-jobs">
          <h2>Side Jobs</h2>
          <p className="sb-muted">Pay every time. A finished job is replaced by a new one.</p>
          <ul>
            {save.jobs.map((j) => (
              <li key={j.id}>
                <div className="sb-contract-head">
                  <span className="sb-contract-title">{jobTitle(j)}</span>
                  <span className="sb-contract-pay">${j.payout.toLocaleString()}</span>
                </div>
                <p>{jobBrief(j)}</p>
                <button
                  className="sb-link"
                  onClick={() =>
                    onChange({
                      ...save,
                      jobs: refillJobs(
                        save.jobs.filter((q) => q.id !== j.id),
                        save.bestAltitude,
                        save.blueprint,
                        (Date.now() ^ j.payout) >>> 0,
                        j.kind,
                      ),
                    })
                  }
                >
                  Pass on this one
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="sb-hub-footer">
        {confirmReset ? (
          <span>
            Wipe cash, parts and contracts?{' '}
            <button className="sb-btn sb-btn-danger sb-btn-small" onClick={onReset}>
              Yes, reset
            </button>{' '}
            <button className="sb-btn sb-btn-small" onClick={() => setConfirmReset(false)}>
              Keep it
            </button>
          </span>
        ) : (
          <button className="sb-link" onClick={() => setConfirmReset(true)}>
            Reset save
          </button>
        )}
      </footer>
    </div>
  )
}
