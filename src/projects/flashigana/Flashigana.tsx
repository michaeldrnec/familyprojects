import { useState } from 'react'
import { HIRAGANA, type Kana } from './hiragana'
import './Flashigana.css'

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
  deck: Kana[]
  index: number
  choices: string[]
}

function newRound(): Round {
  const deck = shuffle(HIRAGANA)
  return { deck, index: 0, choices: buildChoices(deck[0]) }
}

function Flashigana() {
  const [round, setRound] = useState<Round>(() => newRound())
  const [selected, setSelected] = useState<string | null>(null)
  const [correctCount, setCorrectCount] = useState(0)

  const card = round.deck[round.index]
  const total = round.deck.length
  const finished = round.index >= total
  const answered = selected !== null

  function choose(romaji: string) {
    if (answered || finished) return
    setSelected(romaji)
    if (romaji === card.romaji) {
      setCorrectCount((n) => n + 1)
    }
  }

  function next() {
    const nextIndex = round.index + 1
    setSelected(null)
    if (nextIndex >= total) {
      setRound((r) => ({ ...r, index: nextIndex }))
      return
    }
    setRound((r) => ({
      ...r,
      index: nextIndex,
      choices: buildChoices(r.deck[nextIndex]),
    }))
  }

  function restart() {
    setRound(newRound())
    setSelected(null)
    setCorrectCount(0)
  }

  return (
    <div className="flashigana">
      <h1 className="sr-only">Flashigana</h1>
      <img
        src="/flashigana_logo.png"
        alt="Flashigana — Hiragana Flashcard Game"
        className="banner"
      />
      <p>Pick the correct romaji reading for each hiragana character.</p>

      {finished ? (
        <div className="results">
          <p className="score">
            {correctCount} / {total} correct
          </p>
          <button type="button" onClick={restart}>Play Again</button>
        </div>
      ) : (
        <>
          <p className="progress">
            Card {round.index + 1} of {total} — {correctCount} correct so far
          </p>

          <div className="card">{card.char}</div>

          <div className="choices">
            {round.choices.map((romaji) => {
              const isCorrect = romaji === card.romaji
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

          {answered && (
            <div className={selected === card.romaji ? 'feedback good' : 'feedback bad'}>
              {selected === card.romaji
                ? '🎉 Correct!'
                : `Not quite — "${card.char}" is "${card.romaji}".`}
              <button type="button" onClick={next}>
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Flashigana
