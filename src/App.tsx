import { Routes, Route } from 'react-router-dom'
import Layout from './Layout'
import Home from './Home'
import NotFound from './site/NotFound'
import { projects } from './projects'

// Every game route comes from the registry in projects.ts, and every game
// is code-split: Layout's <Suspense> shows a loading screen while a game's
// chunk downloads.
function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        {projects.map((p) => (
          <Route key={p.slug} path={`/${p.slug}`} element={<p.component />} />
        ))}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default App
