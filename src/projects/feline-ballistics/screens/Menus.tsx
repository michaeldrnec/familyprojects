import { useEffect, useRef } from 'react'
import { BREEDS, BREED_ORDER } from '../game/breeds'
import { ROOMS, ROOM_UNLOCK_STARS, roomStars, roomUnlocked } from '../levels/index'
import type { RoomId } from '../levels/types'
import type { Progress } from '../progress'
import { drawCatIcon } from '../render/cat'

// Title, room select and level select (SPEC.md section 7). Plain DOM,
// with a small canvas per breed so the menu cats are the same squishy
// cats as in play.

function CatPortrait({ breed, size = 72 }: { breed: keyof typeof BREEDS; size?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = size * dpr
    c.height = size * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)
    const b = BREEDS[breed]
    drawCatIcon(ctx, b, size / 2, size / 2 + size * 0.06, (size * 0.3) / b.radius, 0)
  }, [breed, size])
  return <canvas ref={ref} className="fb-portrait" style={{ width: size, height: size }} aria-hidden="true" />
}

export function Title({ onPlay, settings, onToggleMotion, onToggleMute }: { onPlay: () => void; settings: Progress['settings']; onToggleMotion: () => void; onToggleMute: () => void }) {
  return (
    <div className="fb-screen fb-title">
      <div className="fb-moon" aria-hidden="true" />
      <h1>
        Feline Ballistics
        <small>The 3 AM Zoomies</small>
      </h1>
      <p className="fb-tagline">It’s 3:15 AM. The humans are asleep. Knock everything precious onto the floor before the snooze alarm rings.</p>
      <div className="fb-squad">
        {BREED_ORDER.map((id) => (
          <div key={id} className="fb-squad-cat">
            <CatPortrait breed={id} size={84} />
            <b>{BREEDS[id].name}</b>
            <span>{BREEDS[id].nickname}</span>
          </div>
        ))}
      </div>
      <button className="fb-btn fb-btn-primary fb-btn-big" onClick={onPlay}>
        Start the Zoomies
      </button>
      <div className="fb-settings">
        <label>
          <input type="checkbox" checked={settings.reducedMotion} onChange={onToggleMotion} /> Reduced motion (no shake or slow-mo)
        </label>
        <label>
          <input type="checkbox" checked={settings.muted} onChange={onToggleMute} /> Mute
        </label>
      </div>
      <details className="fb-howto">
        <summary>How to play</summary>
        <ul>
          <li><b>Aim:</b> drag back anywhere and let go (or arrow keys + Space).</li>
          <li><b>Tap</b> mid-air: your cat’s special move (Space).</li>
          <li><b>Hold</b> mid-air: go LOAF for a heavy hit — or dig claws into curtains and towels (Shift).</li>
          <li><b>Swipe</b> mid-air: flick your tail to nudge; swipe up to floof-glide (arrow keys).</li>
          <li>Knock every ✨sparkling✨ item down. Leftover cats and extra chaos earn more paws.</li>
        </ul>
      </details>
    </div>
  )
}

export function RoomSelect({ progress, onPick, onBack }: { progress: Progress; onPick: (room: RoomId) => void; onBack: () => void }) {
  return (
    <div className="fb-screen">
      <header className="fb-bar">
        <button className="fb-btn" onClick={onBack}>
          ← Title
        </button>
        <h2>Pick a room</h2>
      </header>
      <div className="fb-rooms">
        {ROOMS.map((r, i) => {
          const open = roomUnlocked(r.id, progress.stars)
          const earned = roomStars(r.id, progress.stars)
          return (
            <button key={r.id} className={`fb-card fb-room fb-room-${r.id}`} disabled={!open} onClick={() => onPick(r.id)}>
              <CatPortrait breed={r.breed} size={80} />
              <div>
                <h3>{r.title}</h3>
                <p>{r.blurb}</p>
                <p className="fb-muted">New cat: {BREEDS[r.breed].name}</p>
                <p className="fb-room-stars">
                  🐾 {earned} / {r.levels.length * 3}
                </p>
                {!open && (
                  <p className="fb-lock">
                    🔒 Earn {ROOM_UNLOCK_STARS} 🐾 in {ROOMS[i - 1].title}
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function LevelSelect({ room, progress, onPlay, onBack }: { room: RoomId; progress: Progress; onPlay: (id: string) => void; onBack: () => void }) {
  const r = ROOMS.find((q) => q.id === room)!
  return (
    <div className="fb-screen">
      <header className="fb-bar">
        <button className="fb-btn" onClick={onBack}>
          ← Rooms
        </button>
        <h2>{r.title}</h2>
      </header>
      <div className="fb-levels">
        {r.levels.map((l, i) => {
          const stars = progress.stars[l.id] ?? 0
          const prevDone = i === 0 || (progress.stars[r.levels[i - 1].id] ?? 0) > 0
          return (
            <button key={l.id} className="fb-card fb-level" disabled={!prevDone} onClick={() => onPlay(l.id)}>
              <span className="fb-level-num">{i + 1}</span>
              <b>{l.title}</b>
              <span className="fb-level-paws">{[1, 2, 3].map((n) => (n <= stars ? '🐾' : '·')).join(' ')}</span>
              <span className="fb-level-cats">
                {l.lineup.map((c, k) => (
                  <i key={k} style={{ background: BREEDS[c].fur, borderColor: BREEDS[c].furDark }} />
                ))}
              </span>
              {progress.best[l.id] ? <span className="fb-muted">best {progress.best[l.id].toLocaleString()}</span> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
