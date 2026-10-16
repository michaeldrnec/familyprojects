import type { ReactNode } from 'react'
import Confetti from './Confetti'
import './ui.css'

// The end-of-round results card: a headline score, any extra lines, and
// the buttons passed as children. `celebrate` fires a confetti burst.
export default function ResultCard({ score, celebrate = false, children }: { score: ReactNode; celebrate?: boolean; children?: ReactNode }) {
  return (
    <div className="result-card">
      {celebrate && <Confetti />}
      <p className="result-score">{score}</p>
      {children}
    </div>
  )
}
