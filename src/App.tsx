import { Routes, Route } from 'react-router-dom'
import Layout from './Layout'
import Home from './Home'
import LetterLadder from './projects/letter-ladder/LetterLadder'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/letter-ladder" element={<LetterLadder />} />
      </Route>
    </Routes>
  )
}

export default App
