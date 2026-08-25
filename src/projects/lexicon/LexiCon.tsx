import { useState } from 'react'
import { QUESTIONS, type Question } from './questions'
import Confetti from './Confetti'
import './LexiCon.css'

const CONFETTI_THRESHOLD = 80

const ROUND_LENGTHS = [5, 10, 20] as const
type RoundLength = (typeof ROUND_LENGTHS)[number]

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

interface Round {
  deck: Question[]
  index: number
  choices: string[]
}

function newRound(length: RoundLength): Round {
  const deck = shuffle(QUESTIONS).slice(0, length)
  return { deck, index: 0, choices: shuffle(deck[0].choices) }
}

function LexiCon() {
  const [roundLength, setRoundLength] = useState<RoundLength>(10)
  const [round, setRound] = useState<Round | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [correctCount, setCorrectCount] = useState(0)

  const total = round?.deck.length ?? 0
  const finished = round !== null && round.index >= total
  const question = round && !finished ? round.deck[round.index] : null
  const percent = total > 0 ? Math.round((correctCount / total) * 100) : 0
  const answered = selected !== null

  function begin() {
    setRound(newRound(roundLength))
    setSelected(null)
    setCorrectCount(0)
  }

  function choose(choice: string) {
    if (!round || answered || finished) return
    setSelected(choice)
    if (choice === question!.answer) setCorrectCount((n) => n + 1)
  }

  function next() {
    setRound((r) => {
      if (!r) return r
      const nextIndex = r.index + 1
      if (nextIndex >= r.deck.length) return { ...r, index: nextIndex }
      return { ...r, index: nextIndex, choices: shuffle(r.deck[nextIndex].choices) }
    })
    setSelected(null)
  }

  function restart() {
    setRound(null)
  }

  if (!round) {
    return (
      <div className="lexicon">
        <h1 className="sr-only">LexiCon</h1>
        <img src="/LexiconLogo.jpeg" alt="LexiCon — A Word Trivia Game" className="banner" />
        <p>Trivia — pick a round length and see how many you can get right.</p>

        <div className="setup">
          <div className="setup-group">
            <span className="setup-label">Round length</span>
            <div className="setup-options">
              {ROUND_LENGTHS.map((len) => (
                <button
                  key={len}
                  type="button"
                  className={roundLength === len ? 'active' : ''}
                  onClick={() => setRoundLength(len)}
                >
                  {len} questions
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
    <div className="lexicon">
      <h1 className="sr-only">LexiCon</h1>
      <img src="/LexiconLogo.jpeg" alt="LexiCon — A Word Trivia Game" className="banner" />
      <p>Trivia — pick a round length and see how many you can get right.</p>

      {finished ? (
        <div className="results">
          {percent >= CONFETTI_THRESHOLD && <Confetti />}
          <p className="score">
            {correctCount} / {total} correct ({percent}%)
          </p>
          <button type="button" onClick={restart}>Play Again</button>
        </div>
      ) : (
        <>
          <p className="progress">
            Question {round.index + 1} of {total} — {correctCount} correct so far
          </p>

          <div className="question">{question!.question}</div>

          <div className="choices">
            {round.choices.map((choice) => {
              const isCorrect = choice === question!.answer
              const isSelected = choice === selected
              const cls =
                'choice' +
                (answered && isCorrect ? ' correct' : '') +
                (answered && isSelected && !isCorrect ? ' wrong' : '')
              return (
                <button
                  key={choice}
                  type="button"
                  className={cls}
                  onClick={() => choose(choice)}
                  disabled={answered}
                >
                  {choice}
                </button>
              )
            })}
          </div>

          {answered && (
            <div className={selected === question!.answer ? 'feedback good' : 'feedback bad'}>
              <span>
                {selected === question!.answer
                  ? '🎉 Correct!'
                  : `Not quite — the answer is "${question!.answer}".`}
              </span>
              <button type="button" onClick={next}>
                {round.index + 1 === total ? 'See Results' : 'Next Question'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default LexiCon
