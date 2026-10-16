import { Component, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import './site.css'

interface State {
  failed: boolean
}

// Catches a game that fails to load (offline before it was cached, a bad
// deploy) or crashes, so the header and the way back home keep working
// instead of the whole page going blank. Layout remounts it per page.
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="site-message">
        <p className="site-message-icon" aria-hidden="true">
          🔌
        </p>
        <h1>This game didn't load</h1>
        <p>{navigator.onLine ? 'Something went wrong while starting it.' : "You're offline, and this game hasn't been saved for offline play yet."}</p>
        <div className="site-message-actions">
          <button type="button" className="site-button" onClick={() => window.location.reload()}>
            Try again
          </button>
          <Link to="/" className="site-button">
            All games
          </Link>
        </div>
      </div>
    )
  }
}
