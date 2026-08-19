import { useEffect, useState } from 'react'
import { HIRAGANA, type Kana } from './hiragana'
import { WORDS, type JapaneseWord } from './words'
import './Flashigana.css'

const REVIEW_ADVANCE_DELAY_MS = 3000
const CORRECT_ADVANCE_DELAY_MS = 1000
const WRONG_ADVANCE_DELAY_MS = 5000
const QUIZ_ROUND_SIZES = [15, 30, 46] as const
const WORD_ROUND_SIZES = [15, 30] as const
const MAX_TILES = 10
type RoundSize = 15 | 30 | 46
type Mode = 'quiz' | 'review' | 'words'

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

interface Tile {
  id: string
  char: string
}

let tileId = 0

function buildTiles(word: JapaneseWord): { tray: Tile[]; filled: (Tile | null)[] } {
  const required = Array.from(word.hiragana)
  const distractorPool = HIRAGANA.map((k) => k.char).filter((c) => !required.includes(c))
  const distractorCount = Math.max(0, MAX_TILES - required.length)
  const distractors = shuffle(distractorPool).slice(0, distractorCount)
  const tray = shuffle([...required, ...distractors]).map((char) => ({
    id: `t${tileId++}`,
    char,
  }))
  return { tray, filled: new Array(required.length).fill(null) }
}

interface QuizRound {
  mode: 'quiz'
  deck: Kana[]
  index: number
  choices: string[]
}
interface ReviewRound {
  mode: 'review'
  deck: Kana[]
  index: number
}
interface WordsRound {
  mode: 'words'
  deck: JapaneseWord[]
  index: number
  tray: Tile[]
  filled: (Tile | null)[]
}
type Round = QuizRound | ReviewRound | WordsRound

function newRound(mode: Mode, size: RoundSize): Round {
  if (mode === 'words') {
    const deck = shuffle(WORDS).slice(0, size)
    const { tray, filled } = buildTiles(deck[0])
    return { mode, deck, index: 0, tray, filled }
  }
  const deck = shuffle(HIRAGANA).slice(0, size)
  if (mode === 'quiz') {
    return { mode, deck, index: 0, choices: buildChoices(deck[0]) }
  }
  return { mode, deck, index: 0 }
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
  const kana = round && !finished && round.mode !== 'words' ? round.deck[round.index] : null
  const word = round && !finished && round.mode === 'words' ? round.deck[round.index] : null

  const answered =
    round?.mode === 'quiz'
      ? selected !== null
      : round?.mode === 'words'
        ? round.filled.every((t) => t !== null)
        : true

  const wordAttempt =
    round?.mode === 'words' && answered ? round.filled.map((t) => t!.char).join('') : null
  const wordCorrect = wordAttempt !== null && wordAttempt === word?.hiragana

  const isCorrectNow =
    round?.mode === 'quiz' ? selected === kana?.romaji : round?.mode === 'words' ? wordCorrect : true

  const advanceDelay =
    round?.mode === 'review' ? REVIEW_ADVANCE_DELAY_MS : isCorrectNow ? CORRECT_ADVANCE_DELAY_MS : WRONG_ADVANCE_DELAY_MS

  function availableSizes(m: Mode): readonly RoundSize[] {
    return m === 'words' ? WORD_ROUND_SIZES : QUIZ_ROUND_SIZES
  }

  function selectMode(m: Mode) {
    setMode(m)
    const sizes = availableSizes(m)
    if (!sizes.includes(roundSize)) setRoundSize(sizes[0])
  }

  function begin() {
    setRound(newRound(mode, roundSize))
    setSelected(null)
    setCorrectCount(0)
    setCorrectStreak(0)
    setWrongStreak(0)
    setBestStreak(0)
    setStreakMessage('')
  }

  function recordAnswer(isCorrect: boolean) {
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

  function choose(romaji: string) {
    if (!round || round.mode !== 'quiz' || selected !== null || finished) return
    setSelected(romaji)
    recordAnswer(romaji === kana!.romaji)
  }

  function placeTile(id: string) {
    if (!round || round.mode !== 'words' || answered) return
    const tile = round.tray.find((t) => t.id === id)
    if (!tile) return
    const nextEmpty = round.filled.findIndex((t) => t === null)
    if (nextEmpty === -1) return

    const newFilled = [...round.filled]
    newFilled[nextEmpty] = tile
    const newTray = round.tray.filter((t) => t.id !== id)
    setRound({ ...round, tray: newTray, filled: newFilled })

    if (newFilled.every((t) => t !== null)) {
      const attempt = newFilled.map((t) => t!.char).join('')
      recordAnswer(attempt === round.deck[round.index].hiragana)
    }
  }

  function removeTile(index: number) {
    if (!round || round.mode !== 'words' || answered) return
    const tile = round.filled[index]
    if (!tile) return
    const newFilled = [...round.filled]
    newFilled[index] = null
    setRound({ ...round, tray: [...round.tray, tile], filled: newFilled })
  }

  function next() {
    setRound((r) => {
      if (!r) return r
      const nextIndex = r.index + 1
      if (nextIndex >= r.deck.length) return { ...r, index: nextIndex }
      if (r.mode === 'quiz') {
        return { ...r, index: nextIndex, choices: buildChoices(r.deck[nextIndex]) }
      }
      if (r.mode === 'words') {
        const { tray, filled } = buildTiles(r.deck[nextIndex])
        return { ...r, index: nextIndex, tray, filled }
      }
      return { ...r, index: nextIndex }
    })
    setSelected(null)
    setStreakMessage('')
  }

  function restart() {
    setRound(null)
  }

  // Auto-advance: once a card is "answered" (review mode is always
  // considered answered; quiz mode once a choice is picked; words mode
  // once every tile blank is filled), move on automatically instead of
  // requiring a click. Wrong answers linger longer (5s) so there's time
  // to read the correction; correct answers move on quickly (1s); review
  // mode uses a fixed pace (3s).
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
        <p>Choose a mode and round length to begin.</p>

        <div className="setup">
          <div className="setup-group">
            <span className="setup-label">Mode</span>
            <div className="setup-options">
              <button
                type="button"
                className={mode === 'quiz' ? 'active' : ''}
                onClick={() => selectMode('quiz')}
              >
                Quiz
              </button>
              <button
                type="button"
                className={mode === 'review' ? 'active' : ''}
                onClick={() => selectMode('review')}
              >
                Review Only
              </button>
              <button
                type="button"
                className={mode === 'words' ? 'active' : ''}
                onClick={() => selectMode('words')}
              >
                Words
              </button>
            </div>
          </div>

          <div className="setup-group">
            <span className="setup-label">Round length</span>
            <div className="setup-options">
              {availableSizes(mode).map((size) => (
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
        {round.mode === 'quiz' && 'Pick the correct romaji reading for each hiragana character.'}
        {round.mode === 'review' && 'Review mode — study each character and its reading.'}
        {round.mode === 'words' && 'Words mode — spell each word in hiragana using the tiles below.'}
      </p>

      {finished ? (
        <div className="results">
          {round.mode !== 'review' ? (
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
            {round.mode !== 'review' && ` — ${correctCount} correct so far`}
          </p>

          {round.mode === 'words' ? (
            <>
              <div className="word-prompt">
                <span className="word-romaji">{word!.romaji}</span>
                <span className="word-english">({word!.english})</span>
              </div>

              <div className="tile-blanks">
                {round.filled.map((tile, i) => {
                  const correctChar = word!.hiragana[i]
                  const cls =
                    'tile-blank' +
                    (tile ? ' filled' : '') +
                    (answered && tile
                      ? tile.char === correctChar
                        ? ' correct'
                        : ' wrong'
                      : '')
                  return (
                    <button
                      key={i}
                      type="button"
                      className={cls}
                      onClick={() => removeTile(i)}
                      disabled={!tile || answered}
                    >
                      {tile?.char ?? ''}
                    </button>
                  )
                })}
              </div>

              <div className="tile-tray">
                {round.tray.map((tile) => (
                  <button
                    key={tile.id}
                    type="button"
                    className="tile"
                    onClick={() => placeTile(tile.id)}
                    disabled={answered}
                  >
                    {tile.char}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="card">{kana!.char}</div>

              {round.mode === 'review' ? (
                <div className="reveal">{kana!.romaji}</div>
              ) : (
                <div className="choices">
                  {round.choices.map((romaji) => {
                    const isCorrect = romaji === kana!.romaji
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
            </>
          )}

          {answered && (
            <div className={round.mode !== 'review' && !isCorrectNow ? 'feedback bad' : 'feedback good'}>
              {round.mode === 'review' && `"${kana!.char}" is "${kana!.romaji}"`}
              {round.mode === 'quiz' &&
                (isCorrectNow
                  ? '🎉 Correct!'
                  : `Not quite — "${kana!.char}" is "${kana!.romaji}".`)}
              {round.mode === 'words' &&
                (isCorrectNow
                  ? '🎉 Correct!'
                  : `Not quite — "${word!.romaji}" (${word!.english}) is spelled "${word!.hiragana}".`)}
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
