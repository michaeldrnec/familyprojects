import './ui.css'

// A word game's logo banner, plus the page's (visually hidden) heading so
// screen readers still get a proper <h1>.
export default function GameBanner({ title, src, alt, maxWidth }: { title: string; src: string; alt: string; maxWidth: number }) {
  return (
    <>
      <h1 className="sr-only">{title}</h1>
      <img src={src} alt={alt} className="game-banner" style={{ maxWidth }} />
    </>
  )
}
