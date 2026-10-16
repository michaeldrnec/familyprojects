import type { CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CATEGORIES, projectBySlug, projects, type Project } from './projects'
import { useActivity } from './shared/activity'
import { useProfiles } from './shared/profiles'
import './Home.css'

// Exposes a project's accent color to CSS as --card-accent.
function accentStyle(p: Project): CSSProperties {
  return { '--card-accent': p.accent } as CSSProperties
}

// Picks which bento tiles run double-wide: enough of them (at least two)
// that the 4-column grid comes out with full rows, spread evenly.
function wideTiles(count: number): Set<number> {
  if (count < 4) return new Set()
  let wide = (4 - (count % 4)) % 4
  if (wide < 2) wide += 4
  return new Set(Array.from({ length: wide }, (_, j) => Math.round((j * count) / wide)))
}

const RECENT = 'recent'
const CONTINUE_COUNT = 3

// Filter chips: everything, what this player played lately, or one category.
const FILTERS: { id: string; label: string }[] = [
  { id: '', label: 'All games' },
  { id: RECENT, label: 'Recently played' },
  ...CATEGORIES.map((c) => ({ id: c, label: c })),
]

function Tile({ p, wide, note }: { p: Project; wide: boolean; note?: string }) {
  return (
    <Link to={`/${p.slug}`} className={`hd-bento-tile ${wide ? 'wide' : ''}`} style={accentStyle(p)}>
      <span className="hd-bento-icon" aria-hidden="true">
        {p.icon}
      </span>
      <span className="hd-bento-cat">{p.category}</span>
      <h3>{p.title}</h3>
      <p>{p.description}</p>
      {note && <span className="hd-note">{note}</span>}
    </Link>
  )
}

function Home() {
  const [params, setParams] = useSearchParams()
  const filter = params.get('show') ?? ''
  const { profiles, activeId } = useProfiles()
  const player = profiles.find((p) => p.id === activeId)
  const { recent, summaries } = useActivity()
  const recentProjects = recent.map(projectBySlug).filter((p): p is Project => !!p)

  function choose(id: string) {
    setParams(id ? { show: id } : {}, { replace: true })
  }

  const featured = projects[projects.length - 1]
  let list: Project[]
  if (filter === RECENT) list = recentProjects
  else if (filter) list = projects.filter((p) => p.category === filter).reverse()
  else list = projects.slice(0, -1).reverse()
  const wide = wideTiles(list.length)

  return (
    <div className="hd-bento">
      <h1 className="sr-only">Drnec Family Projects</h1>

      <nav className="hd-filters" aria-label="Filter games">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={'hd-filter' + (filter === f.id ? ' active' : '')}
            aria-pressed={filter === f.id}
            onClick={() => choose(f.id)}
          >
            {f.label}
          </button>
        ))}
      </nav>

      {!filter && recentProjects.length > 0 && (
        <section className="hd-continue" aria-label="Continue playing">
          <h2>{player ? `Welcome back, ${player.name}` : 'Continue playing'}</h2>
          <div className="hd-continue-row">
            {recentProjects.slice(0, CONTINUE_COUNT).map((p) => (
              <Link key={p.slug} to={`/${p.slug}`} className="hd-continue-card" style={accentStyle(p)}>
                <span className="hd-continue-icon" aria-hidden="true">
                  {p.icon}
                </span>
                <span className="hd-continue-text">
                  <strong>{p.title}</strong>
                  <span>{summaries[p.slug] ?? 'Continue →'}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!filter && (
        <Link to={`/${featured.slug}`} className="hd-feature" style={accentStyle(featured)}>
          <div className="hd-feature-text">
            <span className="hd-pill">New</span>
            <h2>{featured.title}</h2>
            <p>{featured.description}</p>
            {summaries[featured.slug] && <span className="hd-note">{summaries[featured.slug]}</span>}
            <span className="hd-feature-btn">Play now →</span>
          </div>
          <div className="hd-feature-art" aria-hidden="true">
            {featured.icon}
          </div>
        </Link>
      )}

      {list.length > 0 ? (
        <div className="hd-bento-grid">
          {list.map((p, i) => (
            <Tile key={p.slug} p={p} wide={wide.has(i)} note={summaries[p.slug]} />
          ))}
        </div>
      ) : (
        <p className="hd-empty">
          {filter === RECENT ? "Nothing played yet on this profile. Pick any game to get started!" : 'No games here yet.'}
        </p>
      )}
    </div>
  )
}

export default Home
