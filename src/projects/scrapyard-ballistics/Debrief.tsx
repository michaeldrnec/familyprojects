import { PART_DEFS, type PartId } from './parts'
import type { Debrief } from './economy'
import type { SaveData, TrackPoint } from './progress'
import { formatAlt, formatSpeed, formatTime } from './format'

interface Props {
  debrief: Debrief
  save: SaveData
  onHub: () => void
  onRebuild: () => void
}

const HEADLINE: Record<Debrief['outcome']['kind'], string> = {
  landed: 'The pilot walked away. Mostly upright.',
  splashdown: 'Splashdown! Fished out by a bass boat.',
  crashed: 'Rapid unplanned disassembly.',
  abandoned: 'You walked away from a flying rocket. Bold.',
  orbit: 'Still up there. Wave when it goes over.',
  scrubbed: 'Scrubbed on the pad. The neighbors are disappointed.',
}

function PartList({ counts }: { counts: Partial<Record<PartId, number>> }) {
  const entries = Object.entries(counts) as [PartId, number][]
  if (entries.length === 0) return <p className="sb-muted">nothing</p>
  return (
    <ul className="sb-part-list">
      {entries.map(([id, n]) => (
        <li key={id}>
          {PART_DEFS[id].name} ×{n}
        </li>
      ))}
    </ul>
  )
}

// Altitude over time: this flight against the previous record.
function ProfileChart({ track, best }: { track: TrackPoint[]; best: TrackPoint[] }) {
  if (track.length < 2) return null
  const W = 320
  const H = 130
  const pad = { l: 44, r: 8, t: 8, b: 20 }
  const tMax = Math.max(1, ...track.map((p) => p[0]), ...best.map((p) => p[0]))
  const aMax = Math.max(10, ...track.map((p) => p[1]), ...best.map((p) => p[1]))
  const pts = (tr: TrackPoint[]) =>
    tr
      .map(([t, a]) => `${(pad.l + (t / tMax) * (W - pad.l - pad.r)).toFixed(1)},${(H - pad.b - (Math.max(0, a) / aMax) * (H - pad.t - pad.b)).toFixed(1)}`)
      .join(' ')
  return (
    <svg className="sb-profile" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Altitude over time">
      <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} className="axis" />
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} className="axis" />
      <text x={pad.l - 4} y={pad.t + 8} textAnchor="end">
        {formatAlt(aMax)}
      </text>
      <text x={pad.l - 4} y={H - pad.b} textAnchor="end">
        0
      </text>
      <text x={W - pad.r} y={H - 5} textAnchor="end">
        {formatTime(tMax)}
      </text>
      {best.length > 1 && <polyline points={pts(best)} className="best" />}
      <polyline points={pts(track)} className="this" />
    </svg>
  )
}

export default function DebriefScreen({ debrief, save, onHub, onRebuild }: Props) {
  const o = debrief.outcome
  const s = o.stats
  return (
    <div className="sb-screen sb-debrief">
      <header className="sb-bar">
        <h2>Debrief</h2>
        <span className="sb-cash">${save.cash.toLocaleString()}</span>
      </header>
      <p className="sb-debrief-headline">{HEADLINE[o.kind]}</p>
      <div className="sb-debrief-grid">
        <section className="sb-card">
          <h3>Telemetry</h3>
          <dl className="sb-stats">
            <dt>Max altitude</dt>
            <dd>
              {formatAlt(s.maxAltitude)} {debrief.newBest && <span className="sb-badge">NEW BEST</span>}
            </dd>
            <dt>Top speed</dt>
            <dd>{formatSpeed(s.maxSpeed)}</dd>
            <dt>Top Mach</dt>
            <dd>{s.maxMach.toFixed(2)}</dd>
            <dt>Max-Q</dt>
            <dd>{(s.maxQ / 1000).toFixed(1)} kPa</dd>
            <dt>Flight time</dt>
            <dd>{formatTime(o.flightTime)}</dd>
            {o.impactSpeed > 0 && (
              <>
                <dt>Impact</dt>
                <dd>{formatSpeed(o.impactSpeed)}</dd>
              </>
            )}
          </dl>
        </section>
        <section className="sb-card">
          <h3>Payday</h3>
          <dl className="sb-stats">
            <dt>Altitude cash</dt>
            <dd>${debrief.altitudeCash.toLocaleString()}</dd>
            {debrief.orbitBonus > 0 && (
              <>
                <dt>Orbit bonus</dt>
                <dd>${debrief.orbitBonus.toLocaleString()}</dd>
              </>
            )}
            {debrief.contractsDone.map((c) => (
              <span key={c.id} className="sb-contents">
                <dt>✔ {c.title}</dt>
                <dd>${c.payout.toLocaleString()}</dd>
              </span>
            ))}
            {debrief.jobsDone.map((j) => (
              <span key={j.id} className="sb-contents">
                <dt>✔ Job: {j.title}</dt>
                <dd>${j.payout.toLocaleString()}</dd>
              </span>
            ))}
            <dt>
              <b>Total</b>
            </dt>
            <dd className="sb-cash">+${debrief.totalCash.toLocaleString()}</dd>
          </dl>
        </section>
        <section className="sb-card">
          <h3>Salvaged</h3>
          <PartList counts={debrief.recovered} />
          <h3>Lost</h3>
          <PartList counts={debrief.lost} />
          {Object.keys(debrief.wornOut).length > 0 && (
            <>
              <h3>Came back worn (hard landing)</h3>
              <PartList counts={debrief.wornOut} />
              <p className="sb-muted">Worn parts have weaker welds and flakier engines. Repair them at the Black Market.</p>
            </>
          )}
          {Object.keys(debrief.granted).length > 0 && (
            <>
              <h3>Mysterious crate</h3>
              <PartList counts={debrief.granted} />
            </>
          )}
          {Object.keys(debrief.scrapPile).length > 0 && (
            <>
              <h3>Dug out of the scrap pile (free)</h3>
              <PartList counts={debrief.scrapPile} />
            </>
          )}
        </section>
      </div>
      <div className="sb-debrief-grid sb-debrief-lower">
        {o.track.length > 1 && (
          <section className="sb-card">
            <h3>Altitude profile</h3>
            <ProfileChart track={o.track} best={debrief.newBest ? debrief.prevBest : save.bestTrack} />
            <p className="sb-legend">
              <span className="sw this" /> this flight
              {(debrief.newBest ? debrief.prevBest : save.bestTrack).length > 1 && (
                <>
                  {' '}
                  <span className="sw best" /> {debrief.newBest ? 'previous best' : 'your best'}
                </>
              )}
            </p>
          </section>
        )}
        <section className="sb-card sb-timeline">
          <h3>Flight log</h3>
          <ol>
            {o.log.map((l, i) => (
              <li key={i} className={`tone-${l.tone}`}>
                <span className="t">{formatTime(l.t)}</span> {l.text}
              </li>
            ))}
          </ol>
        </section>
      </div>
      {debrief.hints.length > 0 && (
        <section className="sb-card sb-hints">
          <h3>🔧 Junker’s notes</h3>
          <ul>
            {debrief.hints.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>
      )}
      <div className="sb-row sb-debrief-actions">
        <button className="sb-btn sb-btn-primary" onClick={onRebuild}>
          🔧 Rebuild
        </button>
        <button className="sb-btn" onClick={onHub}>
          Back to the barn
        </button>
      </div>
    </div>
  )
}
