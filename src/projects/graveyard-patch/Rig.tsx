// The in-game screen: the HUD, the Chirp feed (left monitor), the IDE with
// tickets, the mini-game bench and Deploy (right monitor), the desk, and the
// overlays that come with being very, very tired.
import type { CSSProperties } from 'react'
import { MAX_RATING, clockLabel } from './sim/config'
import {
  coffeeRefillSeconds,
  coffeeReady,
  crashZone,
  deployBlock,
  hallucinating,
  inverted,
  tiredness,
  waterReady,
  type NightState,
  type Ticket,
} from './sim/night'
import type { MiniEnv } from './minigames/env'
import BugHunt from './minigames/BugHunt'
import SpaghettiUnravel from './minigames/SpaghettiUnravel'

export interface RigActions {
  open: (id: number) => void
  quick: (id: number) => void
  abandon: () => void
  deploy: () => void
  coffee: () => void
  water: () => void
  shake: () => void
  petCat: () => void
  pause: () => void
  mute: () => void
  finishFix: (id: number, success: boolean) => void
}

const GAME_ICON = { hunt: '🐞', unravel: '🍝' } as const
const GAME_NAME = { hunt: 'Bug Hunt', unravel: 'Spaghetti Unravel' } as const

function Stars({ rating }: { rating: number }) {
  return (
    <span className="gp-stars" role="img" aria-label={`Rating ${rating.toFixed(1)} of 5 stars`}>
      <span className="gp-stars-empty">★★★★★</span>
      <span className="gp-stars-fill" style={{ width: `${(rating / MAX_RATING) * 100}%` }}>
        ★★★★★
      </span>
    </span>
  )
}

function TicketRow({ t, index, s, actions }: { t: Ticket; index: number; s: NightState; actions: RigActions }) {
  const busy = s.activeId !== null || s.away > 0
  const tag = t.conflict ? '🔀 ' : t.root ? '🎥 ' : ''
  return (
    <li className={`gp-ticket sev-${t.severity}` + (s.activeId === t.id ? ' active' : '')}>
      <span className="gp-sev">{t.severity}</span>
      <span className="gp-ticket-title">
        {tag}
        {t.title}
      </span>
      <span className="gp-ticket-meta">
        {index < 9 && <kbd className="gp-keyhint">{index + 1}</kbd>}
        {GAME_ICON[t.game]} {Math.floor(t.age)}s
      </span>
      <span className="gp-ticket-actions">
        <button type="button" className="gp-btn gp-fix" disabled={busy} onClick={() => actions.open(t.id)} aria-label={`Fix: ${t.title}`}>
          Fix
        </button>
        <button
          type="button"
          className="gp-btn gp-dice"
          disabled={busy || t.severity === 'P0'}
          onClick={() => actions.quick(t.id)}
          aria-label={`Quick Patch: ${t.title}`}
          title={t.severity === 'P0' ? 'Server fires need a real fix' : 'Quick Patch: 80% clean, 20% two new bugs'}
        >
          🎲
        </button>
      </span>
    </li>
  )
}

function DeployPanel({ s, actions }: { s: NightState; actions: RigActions }) {
  const block = deployBlock(s)
  const d = s.deploy
  let label = `🚀 Deploy ${s.staged.length} patch${s.staged.length === 1 ? '' : 'es'}`
  if (d) label = d.halted ? '🔥 Halted: P0 open' : `Uploading… ${Math.floor(d.progress * 100)}%`
  else if (block === 'p0') label = '🔥 Fix the P0 first'
  else if (block === 'nothing') label = 'Nothing staged'
  return (
    <div className="gp-ship">
      <div className="gp-staged" aria-label="Staged patches">
        {s.staged.length === 0 && !d && <span className="gp-muted">Fixed bugs wait here until you deploy.</span>}
        {s.staged.map((t) => (
          <span key={t.id} className={`gp-chip sev-${t.severity}`} title={t.title}>
            {t.severity}
          </span>
        ))}
      </div>
      <button type="button" className={'gp-deploy' + (d ? ' running' : '') + (d?.halted ? ' halted' : '')} disabled={!!block} onClick={actions.deploy}>
        {d && <span className="gp-deploy-bar" style={{ width: `${d.progress * 100}%` }} />}
        <span className="gp-deploy-label">
          {label} {!block && <kbd className="gp-keyhint">Enter</kbd>}
        </span>
      </button>
      {hallucinating(s) && !d && s.staged.length > 0 && <p className="gp-warn">⚠ You’re half asleep. This build might break.</p>}
    </div>
  )
}

function Bench({ s, actions, env, seed }: { s: NightState; actions: RigActions; env: () => MiniEnv; seed: number }) {
  const ticket = s.tickets.find((t) => t.id === s.activeId)
  if (!ticket) {
    return (
      <div className="gp-bench gp-bench-idle">
        <p className="gp-bench-title">// pick a ticket</p>
        <p>
          <strong>Fix</strong> opens a mini-game. <strong>🎲</strong> rolls a Quick Patch.
        </p>
        <p>Then <strong>Deploy</strong>: patches only win stars back once they ship.</p>
      </div>
    )
  }
  const done = (success: boolean) => actions.finishFix(ticket.id, success)
  return (
    <div className="gp-bench">
      <div className="gp-bench-head">
        <span className={`gp-sev sev-${ticket.severity}`}>{ticket.severity}</span>
        <span className="gp-bench-name">
          {GAME_ICON[ticket.game]} {GAME_NAME[ticket.game]}
        </span>
        <button type="button" className="gp-btn gp-back" onClick={actions.abandon} aria-label="Put this ticket back">
          ✕ <kbd className="gp-keyhint">Bksp</kbd>
        </button>
      </div>
      <div className="gp-bench-play">
        {ticket.game === 'hunt' ? (
          <BugHunt key={seed} severity={ticket.severity} seed={seed} speed={s.cfg.speed} env={env} onDone={done} />
        ) : (
          <SpaghettiUnravel key={seed} severity={ticket.severity} seed={seed} env={env} onDone={done} />
        )}
      </div>
    </div>
  )
}

function Desk({ s, actions }: { s: NightState; actions: RigActions }) {
  const refill = s.coffeeRefill / coffeeRefillSeconds(s)
  const urgent = s.sleep > 0.7
  return (
    <footer className="gp-desk">
      {s.cfg.coffee && (
        <button type="button" className="gp-desk-btn" disabled={!coffeeReady(s)} onClick={actions.coffee} style={{ '--fill': `${(1 - refill) * 100}%` } as CSSProperties}>
          <span aria-hidden="true">☕</span> {refill > 0 ? 'Brewing…' : 'Coffee'} <kbd className="gp-keyhint">C</kbd>
        </button>
      )}
      <button type="button" className="gp-desk-btn" disabled={!waterReady(s)} onClick={actions.water}>
        <span aria-hidden="true">💧</span> Splash water <kbd className="gp-keyhint">W</kbd>
      </button>
      <button type="button" className={'gp-desk-btn gp-shake-btn' + (urgent ? ' urgent' : '')} onPointerDown={(e) => {
        e.preventDefault()
        actions.shake()
      }}>
        <span aria-hidden="true">🙃</span> Shake it off <kbd className="gp-keyhint">Space</kbd>
      </button>
      {s.cat.phase !== 'away' && (
        <button
          type="button"
          className={'gp-cat' + (s.cat.phase === 'sitting' ? ' sitting' : '')}
          style={s.cat.phase === 'walking' ? { left: `${8 + s.cat.x * 80}%` } : undefined}
          onClick={actions.petCat}
          aria-label={s.cat.phase === 'sitting' ? 'The cat is lying across your screen. Pet it to move it' : 'Pet the cat'}
        >
          🐈{s.cat.phase === 'sitting' && <span> on your screen! Pet me</span>}
        </button>
      )}
    </footer>
  )
}

export default function Rig({
  s,
  actions,
  env,
  benchSeed,
  muted,
  reducedMotion,
  shaking,
}: {
  s: NightState
  actions: RigActions
  env: () => MiniEnv
  benchSeed: number
  muted: boolean
  reducedMotion: boolean
  shaking: boolean
}) {
  const tired = tiredness(s)
  const p0 = s.tickets.some((t) => t.severity === 'P0' && !t.phantom)
  // With reduced motion the Crash Zone is a gentle, steady tint instead of flips.
  let colorFilter = ''
  if (reducedMotion) {
    if (s.invert > 0) colorFilter = `sepia(${(s.invert * 0.5).toFixed(2)}) hue-rotate(${Math.round(s.invert * 60)}deg)`
  } else if (inverted(s)) colorFilter = 'invert(0.92) hue-rotate(180deg)'
  const blurPx = tired.blur * 1.2
  const viewStyle: CSSProperties = { filter: `${blurPx > 0.05 ? `blur(${blurPx.toFixed(2)}px)` : ''} ${colorFilter}`.trim() || undefined }
  const sleepPct = Math.round(s.sleep * 100)
  const dozing = s.sleep >= 1

  return (
    <div className={'gp-rig' + (shaking && !reducedMotion ? ' gp-shaking' : '')}>
      <div className="gp-view" style={viewStyle}>
        <header className="gp-hud">
          <div className="gp-clock">
            <span className="gp-time">{clockLabel(s.t)}</span>
            <span className="gp-day">{s.cfg.day}</span>
          </div>
          <div className="gp-rating">
            <Stars rating={s.rating} />
            <span className="gp-num">{s.rating.toFixed(1)}</span>
          </div>
          <div className="gp-sleep" aria-label={`Sleepiness ${sleepPct}%`}>
            <span aria-hidden="true">😴</span>
            <span className="gp-meter">
              <span className={'gp-meter-fill' + (s.sleep > 0.8 ? ' danger' : '')} style={{ width: `${sleepPct}%` }} />
            </span>
            <span className="gp-num">{sleepPct}%</span>
          </div>
          <div className="gp-status">
            {s.jitters > 0 && <span className="gp-pill jitter">☕ Jitters</span>}
            {s.crash > 0 && <span className="gp-pill bad">📉 Crash</span>}
            {s.bomb && !s.bomb.closed && <span className="gp-pill bad">🎥 Review bomb</span>}
            {crashZone(s) && <span className="gp-pill bad">🌀 Crash Zone</span>}
          </div>
          <div className="gp-hud-buttons">
            <button type="button" className="gp-icon-btn" onClick={actions.pause} aria-label="Pause">
              ⏸
            </button>
            <button type="button" className="gp-icon-btn" onClick={actions.mute} aria-label={muted ? 'Unmute sound' : 'Mute sound'}>
              {muted ? '🔇' : '🔊'}
            </button>
          </div>
        </header>

        <div className="gp-screens">
          <section className="gp-monitor gp-feed" aria-label="Chirp feed">
            <div className="gp-monitor-head">
              <span className="gp-brand">chirp</span>
              <span className="gp-muted">👥 {Math.round(s.users).toLocaleString()} playing</span>
            </div>
            <ol className="gp-posts">
              {s.feed.map((p) => (
                <li key={p.id} className={`gp-post tone-${p.tone}`}>
                  <span className="gp-avatar" aria-hidden="true">
                    {p.handle.avatar}
                  </span>
                  <div>
                    <div className="gp-post-head">
                      <strong>{p.handle.name}</strong> <span className="gp-muted">{clockLabel(p.at)}</span>
                    </div>
                    <p>{p.text}</p>
                  </div>
                </li>
              ))}
              {s.feed.length === 0 && <li className="gp-muted gp-quiet">Quiet… for now.</li>}
            </ol>
          </section>

          <section className={'gp-monitor gp-ide' + (p0 ? (reducedMotion ? ' p0-still' : ' p0') : '')} aria-label="IDE">
            <div className="gp-queue">
              <div className="gp-monitor-head">
                <span className="gp-brand">tickets</span>
                <span className="gp-muted">{s.tickets.length} open</span>
              </div>
              <ol className="gp-tickets">
                {s.tickets.map((t, i) => (
                  <TicketRow key={t.id} t={t} index={i} s={s} actions={actions} />
                ))}
                {s.tickets.length === 0 && <li className="gp-muted gp-quiet">Inbox zero. Enjoy it while it lasts.</li>}
              </ol>
              <DeployPanel s={s} actions={actions} />
            </div>
            <Bench s={s} actions={actions} env={env} seed={benchSeed} />
          </section>
        </div>

        <Desk s={s} actions={actions} />
      </div>

      <div className="gp-vignette" style={{ opacity: tired.vignette * 0.9 }} aria-hidden="true" />
      <div className="gp-lid top" style={{ height: `${tired.lids * 50}%` }} aria-hidden="true" />
      <div className="gp-lid bottom" style={{ height: `${tired.lids * 50}%` }} aria-hidden="true" />

      {dozing && (
        <button type="button" className="gp-doze" onPointerDown={(e) => {
          e.preventDefault()
          actions.shake()
        }}>
          <span className="gp-zzz">Zzz…</span>
          <span>Mash Space or tap here to wake up!</span>
        </button>
      )}
      {s.away > 0 && (
        <div className="gp-away" role="status">
          🚰 Splashing your face… {s.away.toFixed(1)}s
        </div>
      )}
      {s.banner && (
        <div className="gp-banner" role="status">
          <strong>{s.banner.title}</strong>
          <span>{s.banner.text}</span>
        </div>
      )}
      {s.toast && (
        <div className="gp-toast" role="status">
          {s.toast.text}
        </div>
      )}
    </div>
  )
}
