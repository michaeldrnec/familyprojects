import { Link } from 'react-router-dom'
import './site.css'

export default function NotFound() {
  return (
    <div className="site-message">
      <p className="site-message-icon" aria-hidden="true">
        🛸
      </p>
      <h1>Page not found</h1>
      <p>There's no game at this address. It may have been renamed, or the link has a typo.</p>
      <Link to="/" className="site-button">
        Back to all games
      </Link>
    </div>
  )
}
