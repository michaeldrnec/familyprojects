import { useMemo, useState } from 'react'
import { ALPHABET, randomTheme, themeContainsWord, type Theme } from './themes'
import { isValidWord } from './words'
import './SentenceSpin.css'

const WIN_LENGTH = 7
const SEGMENT_DEG = 360 / ALPHABET.length
const SPIN_DURATION_MS = 3500
const CHARGES = 2

function SentenceSpin() {
  const [theme, setTheme] = useState<Theme>(() => randomTheme())
  const [currentLetter, setCurrentLetter] = useState<string | null>(null)
  const [sentenceWords, setSentenceWords] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [checkedWin, setCheckedWin] = useState(false)
  const [checkError, setCheckError] = useState('')

  const [respinsLeft, setRespinsLeft] = useState(CHARGES)
  const [hintsLeft, setHintsLeft] = useState(CHARGES)
  const [reusesLeft, setReusesLeft] = useState(CHARGES)
  const [reuseMode, setReuseMode] = useState(false)
  const [hint, setHint] = useState('')

  // Derived from sentenceWords rather than tracked separately, so removing
  // a word (to fix a failed theme check) automatically frees its letter
  // again — unless another word still on the board uses the same letter
  // (possible via Reuse Letter).
  const usedLetters = useMemo(
    () => new Set(sentenceWords.map((w) => w[0])),
    [sentenceWords],
  )
  const sentenceFull = sentenceWords.length >= WIN_LENGTH
  const won = checkedWin

  function newGame() {
    setTheme(randomTheme())
    setCurrentLetter(null)
    setSentenceWords([])
    setInput('')
    setError('')
    setSpinning(false)
    setRotation(0)
    setCheckedWin(false)
    setCheckError('')
    setRespinsLeft(CHARGES)
    setHintsLeft(CHARGES)
    setReusesLeft(CHARGES)
    setReuseMode(false)
    setHint('')
  }

  function pickAndSpinTo(target: string) {
    const targetIndex = ALPHABET.indexOf(target)
    const targetAngle = targetIndex * SEGMENT_DEG + SEGMENT_DEG / 2
    const desiredFinalMod = (360 - targetAngle) % 360
    const currentMod = ((rotation % 360) + 360) % 360
    const delta = (desiredFinalMod - currentMod + 360) % 360
    const extraSpins = 4 + Math.floor(Math.random() * 3)
    const newRotation = rotation + extraSpins * 360 + delta

    setSpinning(true)
    setError('')
    setHint('')
    setRotation(newRotation)

    setTimeout(() => {
      setSpinning(false)
      setCurrentLetter(target)
    }, SPIN_DURATION_MS)
  }

  function spin() {
    if (spinning || currentLetter || won || sentenceFull) return
    const available = ALPHABET.filter((l) => !usedLetters.has(l))
    if (available.length === 0) return
    pickAndSpinTo(available[Math.floor(Math.random() * available.length)])
  }

  function respin() {
    if (spinning || !currentLetter || respinsLeft <= 0 || won) return
    const available = ALPHABET.filter((l) => !usedLetters.has(l))
    if (available.length === 0) return
    setRespinsLeft((n) => n - 1)
    setCurrentLetter(null)
    setInput('')
    pickAndSpinTo(available[Math.floor(Math.random() * available.length)])
  }

  function useHint() {
    if (!currentLetter || hintsLeft <= 0 || hint) return
    const ideas = theme.words[currentLetter]
    setHintsLeft((n) => n - 1)
    setHint(
      ideas && ideas.length > 0
        ? `${theme.name}: ${ideas.slice(0, 4).join(', ')}`
        : `No ${theme.name.toLowerCase()} suggestions for "${currentLetter}" — any real word will do.`,
    )
  }

  function toggleReuseMode() {
    if (spinning || currentLetter || won || reusesLeft <= 0 || sentenceFull) return
    setReuseMode((v) => !v)
  }

  function reuseLetter(letter: string) {
    if (!reuseMode || spinning || currentLetter || won || reusesLeft <= 0) return
    setReusesLeft((n) => n - 1)
    setReuseMode(false)
    setError('')
    setHint('')
    setCurrentLetter(letter)
  }

  function submitWord(e: React.FormEvent) {
    e.preventDefault()
    if (!currentLetter) return
    const word = input.trim()
    if (!word) return
    const upper = word.toUpperCase()

    if (upper[0] !== currentLetter) {
      setError(`Word must start with "${currentLetter}".`)
      return
    }
    if (sentenceWords.includes(upper)) {
      setError(`You already used "${upper}".`)
      return
    }
    if (!isValidWord(currentLetter, word) && !themeContainsWord(theme, word)) {
      setError(`"${word}" isn't a word we recognize.`)
      return
    }

    setSentenceWords((prev) => [...prev, upper])
    setCurrentLetter(null)
    setInput('')
    setError('')
    setHint('')
  }

  function removeWord(index: number) {
    if (currentLetter || spinning || won) return
    setSentenceWords((prev) => prev.filter((_, i) => i !== index))
    setCheckError('')
  }

  function checkSentence() {
    if (!sentenceFull) return
    const fits = sentenceWords.some((w) => themeContainsWord(theme, w))
    if (fits) {
      setCheckedWin(true)
      setCheckError('')
    } else {
      setCheckError(
        `None of your words connect to the "${theme.name}" theme — click a word below to remove it and try another.`,
      )
    }
  }

  return (
    <div className="sentence-spin">
      <h1>Sentence Spin</h1>
      <p>
        Spin the wheel for a letter, then type any word that starts with it —
        any real word works, but at least one word in your finished sentence
        must connect to the theme. Fill {WIN_LENGTH} boxes, then Check —
        each starting letter can only be used once, unless you spend a Reuse
        Letter.
      </p>

      <div className="board">
        <div className="boxes">
          {Array.from({ length: WIN_LENGTH }).map((_, i) => {
            const filled = i < sentenceWords.length
            const removable = filled && !currentLetter && !spinning && !won
            return (
              <button
                key={i}
                type="button"
                className={
                  'box' +
                  (filled ? ' filled' : '') +
                  (i === sentenceWords.length && currentLetter && !spinning ? ' active' : '') +
                  (removable ? ' removable' : '')
                }
                onClick={removable ? () => removeWord(i) : undefined}
                disabled={!removable}
              >
                {sentenceWords[i] ?? ''}
              </button>
            )
          })}
        </div>

        <div className="theme-badge">
          <span className="theme-label">Theme</span>
          <span className="theme-name">{theme.name}</span>
        </div>
      </div>

      {won ? (
        <div className="win">
          🎉 You built a {sentenceWords.length}-word sentence for the "
          {theme.name}" theme!
          <button type="button" onClick={newGame}>New Game</button>
        </div>
      ) : (
        <>
          {currentLetter && !spinning && (
            <>
              <form onSubmit={submitWord} className="guess-form">
                <span className="current-letter">Letter: {currentLetter}</span>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`Word starting with "${currentLetter}"`}
                  autoFocus
                />
                <button type="submit">Submit</button>
              </form>
              {hint && <p className="ideas">{hint}</p>}
            </>
          )}
          {reuseMode && (
            <p className="ideas">Click a greyed-out letter on the wheel to reuse it.</p>
          )}
          {sentenceFull && !currentLetter && (
            <button type="button" className="check-button" onClick={checkSentence}>
              Check Sentence
            </button>
          )}
          {checkError && <p className="error">{checkError}</p>}
          {error && <p className="error">{error}</p>}

          <div className="powerups">
            <button
              type="button"
              onClick={respin}
              disabled={spinning || !currentLetter || respinsLeft <= 0}
            >
              Re-spin ({respinsLeft} left)
            </button>
            <button
              type="button"
              onClick={useHint}
              disabled={!currentLetter || spinning || hintsLeft <= 0 || !!hint}
            >
              Hint ({hintsLeft} left)
            </button>
            <button
              type="button"
              className={reuseMode ? 'active' : ''}
              onClick={toggleReuseMode}
              disabled={spinning || !!currentLetter || reusesLeft <= 0 || sentenceFull}
            >
              {reuseMode ? 'Cancel Reuse' : `Reuse Letter (${reusesLeft} left)`}
            </button>
          </div>
        </>
      )}

      <div className="wheel-area">
        <div className="pointer" />
        <div className="wheel-outer">
          <div className="wheel" style={{ transform: `rotate(${rotation}deg)` }}>
            {ALPHABET.map((letter, i) => {
              const angle = i * SEGMENT_DEG + SEGMENT_DEG / 2
              const used = usedLetters.has(letter)
              const clickable = reuseMode && used
              return (
                <span
                  key={letter}
                  className="wheel-slot"
                  style={{ transform: `rotate(${angle}deg)` }}
                >
                  <span
                    className={
                      'wheel-letter' + (used ? ' used' : '') + (clickable ? ' reusable' : '')
                    }
                    onClick={clickable ? () => reuseLetter(letter) : undefined}
                  >
                    {letter}
                  </span>
                </span>
              )
            })}
          </div>
        </div>
        <button
          type="button"
          className="spin-button"
          onClick={spin}
          disabled={spinning || !!currentLetter || won || reuseMode || sentenceFull}
        >
          {spinning ? 'Spinning…' : 'Spin'}
        </button>
      </div>

      {!won && (
        <button type="button" className="new-game" onClick={newGame}>
          New Game
        </button>
      )}
    </div>
  )
}

export default SentenceSpin
