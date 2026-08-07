import { Link } from 'react-router-dom'
import { projects } from './projects'

function Home() {
  return (
    <div>
      <h1>Projects</h1>
      <p>A collection of small games and tools.</p>
      <div className="project-grid">
        {projects.map((p) => (
          <Link key={p.slug} to={`/${p.slug}`} className="project-card">
            <h3>{p.title}</h3>
            <p>{p.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default Home
