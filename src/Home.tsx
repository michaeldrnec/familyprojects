import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { projects, type Project } from './projects'
import './Home.css'

// Exposes a project's accent color to CSS as --card-accent.
function accentStyle(p: Project): CSSProperties {
  return { '--card-accent': p.accent } as CSSProperties
}

// The newest project as a big featured card, the rest in a bento grid
// where every fifth tile (and the last) runs double-wide.
function Home() {
  const featured = projects[projects.length - 1]
  const rest = projects.slice(0, -1).reverse()
  return (
    <div className="hd-bento">
      <Link to={`/${featured.slug}`} className="hd-feature" style={accentStyle(featured)}>
        <div className="hd-feature-text">
          <span className="hd-pill">New</span>
          <h2>{featured.title}</h2>
          <p>{featured.description}</p>
          <span className="hd-feature-btn">Play now →</span>
        </div>
        <div className="hd-feature-art" aria-hidden="true">
          {featured.icon}
        </div>
      </Link>
      <div className="hd-bento-grid">
        {rest.map((p, i) => (
          <Link
            key={p.slug}
            to={`/${p.slug}`}
            className={`hd-bento-tile ${i % 5 === 0 || i === rest.length - 1 ? 'wide' : ''}`}
            style={accentStyle(p)}
          >
            <span className="hd-bento-icon">{p.icon}</span>
            <span className="hd-bento-cat">{p.category}</span>
            <h3>{p.title}</h3>
            <p>{p.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default Home
