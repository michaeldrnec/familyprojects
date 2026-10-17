import { Suspense, useEffect } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { projectBySlug } from './projects'
import { markPlayed } from './shared/activity'
import { useMuted } from './shared/audio'
import { useProfiles } from './shared/profiles'
import ErrorBoundary from './site/ErrorBoundary'
import LoadingScreen from './site/LoadingScreen'
import ProfileMenu from './site/ProfileMenu'
import './App.css'

const SITE_TITLE = 'Drnec Family Projects'

function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { activeId } = useProfiles()
  const [muted, toggleMute] = useMuted()
  const isHome = location.pathname === '/'
  const project = projectBySlug(location.pathname.slice(1))

  useEffect(() => {
    if (project) markPlayed(project.slug)
    document.title = project ? `${project.title} · ${SITE_TITLE}` : isHome ? SITE_TITLE : `Page not found · ${SITE_TITLE}`
  }, [project, isHome])

  return (
    <>
      <header className="site-header">
        {/* The full logo's stacked text is unreadable at header size, so the
            header pairs just its icon with the name set as real text. */}
        <Link to="/" className="brand" title="All games">
          <img src="/drnec_project_icon.webp" alt="" className="brand-logo" />
          <span className="brand-name">
            <span className="brand-name-top">Drnec Family</span>
            <span className="brand-name-bottom">A.I. Projects</span>
          </span>
        </Link>
        {project?.headerLogo && (
          <>
            <span className="header-divider" aria-hidden="true" />
            <img src={project.headerLogo.src} alt={project.headerLogo.alt} className="header-game-logo" />
          </>
        )}
        <div className="header-actions">
          {isHome && <span className="site-version">v{__APP_VERSION__}</span>}
          <button
            type="button"
            className="header-icon-btn"
            onClick={toggleMute}
            aria-label={muted ? 'Unmute all games' : 'Mute all games'}
            title={muted ? 'Sound is off' : 'Sound is on'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          {/* A profile switch mid-game would save into the wrong profile, so
              switching always returns to the homepage. */}
          <ProfileMenu onChange={() => navigate('/')} />
        </div>
      </header>
      <main className={'site-main' + (project?.fullscreen ? ' is-fullscreen' : '')}>
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<LoadingScreen />}>
            {/* Remounting on a profile change makes every screen re-read its saves. */}
            <Outlet key={activeId} />
          </Suspense>
        </ErrorBoundary>
      </main>
    </>
  )
}

export default Layout
