import { useMemo } from 'react'

const COLORS = ['#f87171', '#fbbf24', '#4ade80', '#60a5fa', '#c084fc', '#f472b6']
const PIECE_COUNT = 80

interface Piece {
  id: number
  left: number
  size: number
  color: string
  tx: number
  ty: number
  rotation: number
  delay: number
  duration: number
}

function randomPieces(): Piece[] {
  return Array.from({ length: PIECE_COUNT }, (_, id) => ({
    id,
    left: 50 + (Math.random() * 2 - 1) * 12, // cluster near center, like a cannon burst
    size: 6 + Math.random() * 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    tx: (Math.random() * 2 - 1) * 320,
    ty: 220 + Math.random() * 320,
    rotation: (Math.random() * 2 - 1) * 720,
    delay: Math.random() * 0.25,
    duration: 2.2 + Math.random() * 1.3,
  }))
}

// A one-shot confetti burst, styled to look like it fired from a cannon near
// the bottom center of the results card. Pieces are generated once per
// mount (via useMemo) so the animation doesn't restart on unrelated
// re-renders — this component should be mounted fresh each time a burst is
// wanted (e.g. only rendered while the qualifying score screen is shown).
function Confetti() {
  const pieces = useMemo(randomPieces, [])

  return (
    <div className="confetti-container" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={
            {
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size * 0.4}px`,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              '--tx': `${p.tx}px`,
              '--ty': `${p.ty}px`,
              '--rot': `${p.rotation}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}

export default Confetti
