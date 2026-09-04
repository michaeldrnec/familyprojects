import { Link, Outlet, useLocation } from 'react-router-dom'
import './App.css'

function Layout() {
  const location = useLocation()
  const isHome = location.pathname === '/'
  const isGravityWell = location.pathname === '/gravity-well'
  const isStarwarden = location.pathname === '/starwarden'

  return (
    <>
      <header className="site-header">
        <Link to="/" className="brand">
          <img
            src={isHome ? '/drnec_projects_logo.jpg' : '/drnec_project_icon.jpeg'}
            alt="Drnec Family A.I. Projects"
            className="brand-logo"
          />
        </Link>
        {isGravityWell && (
          <>
            <span className="header-divider" aria-hidden="true" />
            <img src="/GravityWellHeader2.jpeg" alt="Gravity Well" className="header-game-logo" />
          </>
        )}
        {isStarwarden && (
          <>
            <span className="header-divider" aria-hidden="true" />
            <img src="/StarwardenHeader.svg" alt="Starwarden" className="header-game-logo" />
          </>
        )}
      </header>
      <main className="site-main">
        <Outlet />
      </main>
    </>
  )
}

export default Layout
