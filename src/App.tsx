import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './Layout'
import Home from './Home'
import LetterLadder from './projects/letter-ladder/LetterLadder'
import Trigaword from './projects/trigaword/Trigaword'
import Flashigana from './projects/flashigana/Flashigana'
import Rainglow from './projects/rainglow/Rainglow'
import LexiCon from './projects/lexicon/LexiCon'
import GravityWell from './projects/gravity-well/GravityWell'
import Xenofuse from './projects/xenofuse/Xenofuse'
import Starwarden from './projects/starwarden/Starwarden'
import SolarWard from './projects/solar-ward/SolarWard'
import IonPerimeter from './projects/ion-perimeter/IonPerimeter'

// Sentence Spin bundles a full ~370k-word dictionary (for free-form word
// validation) that would otherwise bloat every route's initial load, so
// it's code-split into its own chunk, fetched only when this route is hit.
const SentenceSpin = lazy(() => import('./projects/sentence-spin/SentenceSpin'))
// Scrapyard Ballistics is the only project pulling in a physics engine
// (matter-js), so it gets the same code-split treatment.
const ScrapyardBallistics = lazy(() => import('./projects/scrapyard-ballistics/ScrapyardBallistics'))

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/letter-ladder" element={<LetterLadder />} />
        <Route path="/trigaword" element={<Trigaword />} />
        <Route path="/flashigana" element={<Flashigana />} />
        <Route path="/rainglow" element={<Rainglow />} />
        <Route path="/lexicon" element={<LexiCon />} />
        <Route path="/gravity-well" element={<GravityWell />} />
        <Route path="/xenofuse" element={<Xenofuse />} />
        <Route path="/starwarden" element={<Starwarden />} />
        <Route path="/solar-ward" element={<SolarWard />} />
        <Route path="/ion-perimeter" element={<IonPerimeter />} />
        <Route
          path="/scrapyard-ballistics"
          element={
            <Suspense fallback={<p>Loading…</p>}>
              <ScrapyardBallistics />
            </Suspense>
          }
        />
        <Route
          path="/sentence-spin"
          element={
            <Suspense fallback={<p>Loading…</p>}>
              <SentenceSpin />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  )
}

export default App
