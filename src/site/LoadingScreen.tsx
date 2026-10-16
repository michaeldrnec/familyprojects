import './site.css'

// Shown while a game's code downloads. It only appears after a short delay
// (in CSS), so fast loads don't flash a spinner.
export default function LoadingScreen() {
  return (
    <div className="site-loading" role="status">
      <span className="site-spinner" aria-hidden="true" />
      <span>Loading…</span>
    </div>
  )
}
