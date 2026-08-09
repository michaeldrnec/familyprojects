import { useMemo, useState } from 'react'
import {
  buildGraph,
  isOneLetterOff,
  isValidWord,
  randomPuzzleFromGraph,
  shortestPath,
  wordsForLength,
  type Puzzle,
  type WordLength,
} from './words'
import './LetterLadder.css'

const WORD_LENGTHS: WordLength[] = [3, 4, 5]

function LetterLadder() {
  const [wordLength, setWordLength] = useState<WordLength>(3)

  // Graphs are only rebuilt when the player switches word length.
  const graph = useMemo(() => buildGraph(wordsForLength(wordLength)), [wordLength])

  const [puzzle, setPuzzle] = useState<Puzzle>(() => randomPuzzleFromGraph(graph))
  const [ladder, setLadder] = useState<string[]>([puzzle.start])
  const [guess, setGuess] = useState('')
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [hintsUsed, setHintsUsed] = useState(0)

  const solved = ladder[ladder.length - 1] === puzzle.end
  const currentWord = ladder[ladder.length - 1]

  const stepsRemaining = useMemo(
    () => shortestPath(graph, currentWord, puzzle.end),
    [graph, currentWord, puzzle.end],
  )

  function newPuzzle(length: WordLength = wordLength) {
    const g = length === wordLength ? graph : buildGraph(wordsForLength(length))
    const p = randomPuzzleFromGraph(g)
    setWordLength(length)
    setPuzzle(p)
    setLadder([p.start])
    setGuess('')
    setError('')
    setHint('')
    setHintsUsed(0)
  }

  function submitGuess(e: React.FormEvent) {
    e.preventDefault()
    const word = guess.trim().toUpperCase()
    if (!word) return

    if (word.length !== currentWord.length) {
      setError(`Word must be ${currentWord.length} letters.`)
      return
    }
    if (!isOneLetterOff(currentWord, word)) {
      setError('Change exactly one letter from the last word.')
      return
    }
    if (!isValidWord(word)) {
      setError(`"${word}" isn't in the word list.`)
      return
    }
    if (ladder.includes(word)) {
      setError('You already used that word.')
      return
    }

    setLadder([...ladder, word])
    setGuess('')
    setError('')
    setHint('')
  }

  const undo = useMemo(
    () => () => {
      if (ladder.length > 1) {
        setLadder(ladder.slice(0, -1))
        setError('')
        setHint('')
      }
    },
    [ladder],
  )

  function useHint() {
    const path = shortestPath(graph, currentWord, puzzle.end)
    if (!path || path.length < 2) return
    const nextWord = path[1]
    for (let i = 0; i < currentWord.length; i++) {
      if (currentWord[i] !== nextWord[i]) {
        setHint(`Hint: letter ${i + 1} becomes "${nextWord[i]}"`)
        setHintsUsed((n) => n + 1)
        return
      }
    }
  }

  return (
    <div className="letter-ladder">
      <h1 className="sr-only">Letter Ladder</h1>
      <img
        src="/letter_ladders_logo.png"
        alt="Letter Ladder — the ultimate word-climbing adventure"
        className="banner"
      />

      <div className="length-select">
        {WORD_LENGTHS.map((len) => (
          <button
            key={len}
            type="button"
            className={len === wordLength ? 'active' : ''}
            onClick={() => newPuzzle(len)}
          >
            {len} letters
          </button>
        ))}
      </div>

      <p>
        Get from <strong>{puzzle.start}</strong> to <strong>{puzzle.end}</strong>,
        changing one letter at a time. Every step must be a real word.
      </p>

      {!solved && (
        <p className="steps-remaining">
          {stepsRemaining
            ? `Shortest path: ${stepsRemaining.length - 1} more step${stepsRemaining.length - 1 === 1 ? '' : 's'}`
            : 'No path found from here — try Undo.'}
        </p>
      )}

      <div className="ladder">
        {ladder.map((word, i) => (
          <div key={i} className="rung">
            {word.split('').map((letter, j) => (
              <span key={j} className="letter">{letter}</span>
            ))}
          </div>
        ))}
        {!solved && (
          <div className="rung target">
            {puzzle.end.split('').map((letter, j) => (
              <span key={j} className="letter">{letter}</span>
            ))}
          </div>
        )}
      </div>

      {solved ? (
        <div className="win">
          🎉 Solved in {ladder.length - 1} steps!
          <button type="button" onClick={() => newPuzzle()}>New puzzle</button>
        </div>
      ) : (
        <form onSubmit={submitGuess} className="guess-form">
          <input
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            maxLength={currentWord.length}
            placeholder={`Next word (${currentWord.length} letters)`}
            autoFocus
          />
          <button type="submit">Submit</button>
          <button type="button" onClick={undo} disabled={ladder.length <= 1}>
            Undo
          </button>
          <button type="button" onClick={useHint}>
            Hint
          </button>
          <button type="button" onClick={() => newPuzzle()}>
            New puzzle
          </button>
        </form>
      )}

      {hint && (
        <p className="hint">
          {hint} {hintsUsed > 1 && `(hints used: ${hintsUsed})`}
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}

export default LetterLadder
