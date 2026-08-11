import { useEffect, useState } from 'react'
import { HIRAGANA, type Kana } from './hiragana'
import './Flashigana.css'

const REVIEW_ADVANCE_DELAY_MS = 3000
const CORRECT_ADVANCE_DELAY_MS = 1000
const WRONG_ADVANCE_DELAY_MS = 5000
const ROUND_SIZES = [15, 30, 46] as const
type RoundSize = (typeof ROUND_SIZES)[number]
type Mode = 'quiz' | 'review'

const PRAISE = ["You're on fire! 🔥", 'Great streak! 🌟', "Keep it up, you're crushing it!"]
const ENCOURAGEMENT = [
  "Hang in there — you'll get the next one!",
  "Don't give up, mistakes help you learn!",
  'Shake it off, keep going!',
]

const REWARD_TIERS: { min: number; label: string }[] = [
  { min: 95, label: 'Master' },
  { min: 85, label: 'Expert' },
  { min: 75, label: 'Veteran' },
  { min: 65, label: 'Adept' },
  { min: 50, label: 'Apprentice' },
  { min: 0, label: 'Novice' },
]

function rewardTier(percent: number): string {
  return REWARD_TIERS.find((t) => percent >= t.min)!.label
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function buildChoices(card: Kana): string[] {
  const distractors = shuffle(
    HIRAGANA.filter((k) => k.romaji !== card.romaji).map((k) => k.romaji),
  ).slice(0, 2)
  return shuffle([card.romaji, ...distractors])
}

interface Round {
  mode: Mode
  deck: Kana[]
  index: number
  choices: string[]
}

function newRound(mode: Mode, size: RoundSize): Round {
  const deck = shuffle(HIRAGANA).slice(0, size)
  return { mode, deck, index: 0, choices: buildChoices(deck[0]) }
}

function Flashigana() {
  const [mode, setMode] = useState<Mode>('quiz')
  const [roundSize, setRoundSize] = useState<RoundSize>(46)
  const [round, setRound] = useState<Round | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [, setCorrectStreak] = useState(0)
  const [, setWrongStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [streakMessage, setStreakMessage] = useState('')

  const total = round?.deck.length ?? 0
  const finished = round !== null && round.index >= total
  const card = round && !finished ? round.deck[round.index] : null
  const answered = round?.mode === 'quiz' ? selected !== null : true

  const advanceDelay =
    round?.mode === 'quiz'
      ? selected === card?.romaji
        ? CORRECT_ADVANCE_DELAY_MS
        : WRONG_ADVANCE_DELAY_MS
      : REVIEW_ADVANCE_DELAY_MS

  function begin() {
    setRound(newRound(mode, roundSize))
    setSelected(null)
    setCorrectCount(0)
    setCorrectStreak(0)
    setWrongStreak(0)
    setBestStreak(0)
    setStreakMessage('')
  }

  function choose(romaji: string) {
    if (!round || round.mode !== 'quiz' || selected !== null || finished) return
    setSelected(romaji)

    const isCorrect = romaji === card!.romaji
    if (isCorrect) {
      setCorrectCount((n) => n + 1)
      setWrongStreak(0)
      setCorrectStreak((n) => {
        const next = n + 1
        setBestStreak((best) => Math.max(best, next))
        if (next > 0 && next % 3 === 0) setStreakMessage(pickRandom(PRAISE))
        return next
      })
    } else {
      setCorrectStreak(0)
      setWrongStreak((n) => {
        const next = n + 1
        if (next > 0 && next % 3 === 0) setStreakMessage(pickRandom(ENCOURAGEMENT))
        return next
      })
    }
  }

  function next() {
    setRound((r) => {
      if (!r) return r
      const nextIndex = r.index + 1
      if (nextIndex >= r.deck.length) return { ...r, index: nextIndex }
      return { ...r, index: nextIndex, choices: buildChoices(r.deck[nextIndex]) }
    })
    setSelected(null)
    setStreakMessage('')
  }

  function restart() {
    setRound(null)
  }

  // Auto-advance: once a card is "answered" (review mode is always
  // considered answered; quiz mode once a choice is picked), move on
  // automatically instead of requiring a click. Wrong answers linger
  // longer (5s) so there's time to read the correction; correct answers
  // move on quickly (1s); review mode uses a fixed pace (3s).
  useEffect(() => {
    if (!round || finished || !answered) return
    const timer = setTimeout(next, advanceDelay)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.index, answered, finished, advanceDelay])

  if (!round) {
    return (
      <div className="flashigana">
        <h1 className="sr-only">Flashigana</h1>
        <img
          src="/flashigana_logo.png"
          alt="Flashigana — Hiragana Flashcard Game"
          className="banner"
        />
        <p>Pick the correct romaji reading for each hiragana character.</p>

        <div className="setup">
          <div className="setup-group">
            <span className="setup-label">Mode</span>
            <div className="setup-options">
              <button
                type="button"
                className={mode === 'quiz' ? 'active' : ''}
                onClick={() => setMode('quiz')}
              >
                Quiz
              </button>
              <button
                type="button"
                className={mode === 'review' ? 'active' : ''}
                onClick={() => setMode('review')}
              >
                Review Only
              </button>
            </div>
          </div>

          <div className="setup-group">
            <span className="setup-label">Round length</span>
            <div className="setup-options">
              {ROUND_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={roundSize === size ? 'active' : ''}
                  onClick={() => setRoundSize(size)}
                >
                  {size === 46 ? 'All 46' : `${size} questions`}
                </button>
              ))}
            </div>
          </div>

          <button type="button" className="start-button" onClick={begin}>
            Start
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flashigana">
      <h1 className="sr-only">Flashigana</h1>
      <img
        src="/flashigana_logo.png"
        alt="Flashigana — Hiragana Flashcard Game"
        className="banner"
      />
      <p>
        {round.mode === 'quiz'
          ? 'Pick the correct romaji reading for each hiragana character.'
          : 'Review mode — study each character and its reading.'}
      </p>

      {finished ? (
        <div className="results">
          {round.mode === 'quiz' ? (
            <>
              <p className="score">
                {correctCount} / {total} correct ({Math.round((correctCount / total) * 100)}%)
              </p>
              <p className="stat-line">Best streak: {bestStreak} in a row</p>
              <p className="reward">
                Rank: <span>{rewardTier(Math.round((correctCount / total) * 100))}</span>
              </p>
            </>
          ) : (
            <p className="score">Review complete!</p>
          )}
          <button type="button" onClick={restart}>Play Again</button>
        </div>
      ) : (
        <>
          <p className="progress">
            Card {round.index + 1} of {total}
            {round.mode === 'quiz' && ` — ${correctCount} correct so far`}
          </p>

          <div className="card">{card!.char}</div>

          {round.mode === 'review' ? (
            <div className="reveal">{card!.romaji}</div>
          ) : (
            <div className="choices">
              {round.choices.map((romaji) => {
                const isCorrect = romaji === card!.romaji
                const isSelected = romaji === selected
                const cls =
                  'choice' +
                  (answered && isCorrect ? ' correct' : '') +
                  (answered && isSelected && !isCorrect ? ' wrong' : '')
                return (
                  <button
                    key={romaji}
                    type="button"
                    className={cls}
                    onClick={() => choose(romaji)}
                    disabled={answered}
                  >
                    {romaji}
                  </button>
                )
              })}
            </div>
          )}

          {answered && (
            <div className={round.mode === 'quiz' && selected !== card!.romaji ? 'feedback bad' : 'feedback good'}>
              {round.mode === 'review'
                ? `"${card!.char}" is "${card!.romaji}"`
                : selected === card!.romaji
                  ? '🎉 Correct!'
                  : `Not quite — "${card!.char}" is "${card!.romaji}".`}
              <span className="advance-bar" key={round.index}>
                <span
                  className="advance-bar-fill"
                  style={{ animationDuration: `${advanceDelay}ms` }}
                />
              </span>
            </div>
          )}

          {streakMessage && <p className="streak-message">{streakMessage}</p>}
        </>
      )}
    </div>
  )
}

export default Flashigana
