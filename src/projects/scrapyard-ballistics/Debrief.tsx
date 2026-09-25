import { PART_DEFS, type PartId } from './parts'
import type { Debrief } from './economy'
import type { SaveData } from './progress'
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
