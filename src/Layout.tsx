import { Link, Outlet } from 'react-router-dom'
import './App.css'

function Layout() {
  return (
    <>
      <header className="site-header">
        <Link to="/" className="brand">🧩 Family Projects</Link>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
    </>
  )
}

export default Layout
