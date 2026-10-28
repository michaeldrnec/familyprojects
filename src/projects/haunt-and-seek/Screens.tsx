// The screens around a round: the manor menu (pick a manor, read its
// briefing, choose difficulty and camera, meet the ghosts) and the results.
import ResultCard from '../../shared/ui/ResultCard'
import { TAGLINE, TIPS } from './content'
import type { Progress } from './progress'
import type { CameraMode } from './render/camera'
import { ABILITIES, DIFFICULTIES, GHOSTS, MANORS, type DifficultyId } from './sim/config'
import type { RoundResult } from './sim/world'

const CAMERAS: { id: CameraMode; name: string; blurb: string }[] = [
  { id: 'overhead', name: 'Overhead', blurb: 'See the whole hallway. Easiest.' },
  { id: 'shoulder', name: 'Over the shoulder', blurb: 'Fly right behind your ghost.' },
  { id: 'first', name: 'First person', blurb: 'See through your ghost’s eyes.' },
]

function stars(n: number) {
  return '★'.repeat(n) + '☆'.repeat(3 - n)
}

export function Menu({
  progress,
  selected,
  camera,
  onSelect,
  onStart,
  onDifficulty,
  onCamera,
  onFov,
  onSensitivity,
}: {
  progress: Progress
  selected: number
  camera: CameraMode
  onSelect: (manor: number) => void
  onStart: () => void
  onDifficulty: (d: DifficultyId) => void
  onCamera: (c: CameraMode) => void
  onFov: (fov: number) => void
  onSensitivity: (s: number) => void
}) {
  const manor = MANORS[selected]
  return (
    <div className="hs-menu">
      <header className="hs-title">
        <h1>Haunt &amp; Seek</h1>
        <p className="hs-tagline">{TAGLINE}</p>
      </header>

      <nav className="hs-manors" aria-label="Choose a manor">
        {MANORS.map((m, i) => {
          const locked = i > progress.unlocked
          return (
            <button key={m.name} type="button" className={'hs-manor' + (i === selected ? ' selected' : '')} disabled={locked} aria-pressed={i === selected} onClick={() => onSelect(i)}>
              <span className="hs-manor-name">
                {i + 1}. {m.name}
              </span>
              <span className="hs-manor-stars">{locked ? '🔒' : progress.bestStars[i] > 0 ? stars(progress.bestStars[i]) : 'not haunted yet'}</span>
            </button>
          )
        })}
      </nav>

      <section className="hs-card hs-briefing">
        <h2>{manor.name}</h2>
        <ul>
          {manor.briefing.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="hs-muted">Ghosts here: {manor.ghosts.map((id) => GHOSTS.find((g) => g.id === id)!.name).join(', ')}</p>

        <div className="hs-options">
          <fieldset className="hs-choice">
            <legend>Difficulty</legend>
            {DIFFICULTIES.map((d) => (
              <button key={d.id} type="button" aria-pressed={progress.difficulty === d.id} className={progress.difficulty === d.id ? 'selected' : ''} onClick={() => onDifficulty(d.id)} title={d.blurb}>
                {d.name}
              </button>
            ))}
          </fieldset>
          <fieldset className="hs-choice">
            <legend>Camera</legend>
            {CAMERAS.map((c) => (
              <button key={c.id} type="button" aria-pressed={camera === c.id} className={camera === c.id ? 'selected' : ''} onClick={() => onCamera(c.id)} title={c.blurb}>
                {c.name}
              </button>
            ))}
          </fieldset>
          {camera !== 'overhead' && (
            <label className="hs-fov">
              Mouse speed ×{progress.sensitivity.toFixed(1)}
              <input type="range" min={0.3} max={3} step={0.1} value={progress.sensitivity} onChange={(e) => onSensitivity(Number(e.target.value))} />
            </label>
          )}
          {camera === 'first' && (
            <label className="hs-fov">
              Field of view {progress.fov}°
              <input type="range" min={55} max={95} step={5} value={progress.fov} onChange={(e) => onFov(Number(e.target.value))} />
            </label>
          )}
        </div>
        <p className="hs-muted">{DIFFICULTIES.find((d) => d.id === progress.difficulty)?.blurb}</p>

        <button type="button" className="hs-primary" onClick={onStart}>
          Start haunting
        </button>
      </section>

      <section className="hs-card">
        <h2>How to haunt</h2>
        <ul className="hs-rules">
          <li>
            <b>Win:</b> fill Snaxley’s <span className="hs-fear">Fear</span> meter to 100% and he runs out the front door.
          </li>
          <li>
            <b>Lose:</b> his <span className="hs-hunger">Hunger</span> reaches 100%, meaning every sweet is gone.
          </li>
          <li>
            Abilities cost <span className="hs-ecto">Ecto</span>, which the whole squad shares. It refills by itself, faster with the green wisps.
          </li>
          <li>
            Stars: ★★★ if he flees with half the sweets still left, ★★ with a quarter.
          </li>
          {TIPS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="hs-muted">
          Keyboard: <kbd>WASD</kbd> to fly, mouse or <kbd>←</kbd>
          <kbd>→</kbd> to look, <kbd>Q</kbd> <kbd>E</kbd> <kbd>R</kbd> for abilities, <kbd>1</kbd>–<kbd>4</kbd> or <kbd>Tab</kbd> to swap ghosts, <kbd>P</kbd> to pause. A gamepad works too. On a phone or tablet: the thumb stick and buttons on screen.
        </p>
      </section>

      <section className="hs-card">
        <h2>The ghosts</h2>
        <div className="hs-roster">
          {GHOSTS.map((g) => (
            <div key={g.id} className="hs-ghost-card" style={{ borderColor: g.color }}>
              <h3 style={{ color: g.color }}>
                👻 {g.name} <span className="hs-muted">· {g.role}</span>
              </h3>
              <ul>
                {g.abilities.map((id, slot) => (
                  <li key={id}>
                    <b>
                      {ABILITIES[id].icon} {ABILITIES[id].name}
                    </b>
                    {slot === 2 ? ' (ultimate)' : ''}: {ABILITIES[id].blurb}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="hs-ghost-card hs-defense-card">
            <h3>🍭 During a Sugar Rush</h3>
            <ul>
              {(['slip', 'decoy', 'dash'] as const).map((id) => (
                <li key={id}>
                  <b>
                    {ABILITIES[id].icon} {ABILITIES[id].name}
                  </b>
                  : {ABILITIES[id].blurb}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}

export function Results({
  manor,
  result,
  onNext,
  onRetry,
  onMenu,
}: {
  manor: number
  result: RoundResult
  onNext: (() => void) | null
  onRetry: () => void
  onMenu: () => void
}) {
  const won = result.outcome === 'won'
  return (
    <div className="hs-overlay">
      <h1>{won ? 'Snaxley fled!' : 'The sweets are gone…'}</h1>
      <p className="hs-tagline">
        {won ? `${MANORS[manor].name} is haunted good and proper.` : 'Snaxley waddles off with a full sack. Try mixing up your scares!'}
      </p>
      <ResultCard score={won ? stars(result.stars) : '☆☆☆'} celebrate={won && result.stars === 3}>
        <ul className="hs-stats">
          <li>Sweets saved: {Math.round(result.sweetsLeft * 100)}%</li>
          <li>Scares: {result.scares}</li>
          <li>Best Boo-Combo: {result.bestCombo > 1 ? `×${result.bestCombo}` : 'none yet'}</li>
          <li>
            Time: {Math.floor(result.time / 60)}:{String(Math.floor(result.time % 60)).padStart(2, '0')}
          </li>
        </ul>
        <div className="hs-result-buttons">
          {onNext && (
            <button type="button" className="hs-primary" onClick={onNext}>
              Next manor
            </button>
          )}
          <button type="button" className={onNext ? 'hs-secondary' : 'hs-primary'} onClick={onRetry}>
            {won ? 'Play again' : 'Try again'}
          </button>
          <button type="button" className="hs-secondary" onClick={onMenu}>
            All manors
          </button>
        </div>
      </ResultCard>
    </div>
  )
}
