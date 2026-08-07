import { useMemo, useState } from 'react'
import { isOneLetterOff, isValidWord, PUZZLES } from './words'
import './LetterLadder.css'

function randomPuzzle() {
  return PUZZLES[Math.floor(Math.random() * PUZZLES.length)]
}

function LetterLadder() {
  const [puzzle, setPuzzle] = useState(randomPuzzle)
  const [ladder, setLadder] = useState<string[]>([puzzle.start])
  const [guess, setGuess] = useState('')
  const [error, setError] = useState('')

  const solved = ladder[ladder.length - 1] === puzzle.end

  const currentWord = ladder[ladder.length - 1]

  function newPuzzle() {
    const p = randomPuzzle()
    setPuzzle(p)
    setLadder([p.start])
    setGuess('')
    setError('')
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
  }

  const undo = useMemo(
    () => () => {
      if (ladder.length > 1) {
        setLadder(ladder.slice(0, -1))
        setError('')
      }
    },
    [ladder],
  )

  return (
    <div className="letter-ladder">
      <h1>Letter Ladder</h1>
      <p>
        Get from <strong>{puzzle.start}</strong> to <strong>{puzzle.end}</strong>,
        changing one letter at a time. Every step must be a real word.
      </p>

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
          <button type="button" onClick={newPuzzle}>New puzzle</button>
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
          <button type="button" onClick={newPuzzle}>
            New puzzle
          </button>
        </form>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  )
}

export default LetterLadder
