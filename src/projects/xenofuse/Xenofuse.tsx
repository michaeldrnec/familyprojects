import { useEffect, useRef, useState } from 'react'
import { generateBomb, type Bomb, type Puzzle } from './bombGen'
import { makeRng } from './rng'
import './Xenofuse.css'

// Tunable constants (spec.md section 12's open questions, resolved for v1):
const WRONG_ANSWER_PENALTY = 10 // seconds lost on a wrong submission
const HINT_TIME_COST = 15 // seconds lost per extra clue reveal
const TICK_MS = 100
const LOW_TIME_THRESHOLD = 20 // seconds remaining that triggers the "critical" visual state

interface ClueEntry {
  glyph: string
  value: string
}

// Every puzzle kind exposes the same shape for its always-partial mapping
// clue (a starting subset plus a hint-revealed remainder), so the UI can
// render all three puzzle types through one code path.
function clueEntries(puzzle: Puzzle, extraRevealed: number): ClueEntry[] {
  if (puzzle.kind === 'cipher') {
    const entries = Object.entries(puzzle.given).map(([glyph, value]) => ({ glyph, value }))
    puzzle.revealOrder.slice(0, extraRevealed).forEach((glyph) => {
      entries.push({ glyph, value: puzzle.full[glyph] })
    })
    return entries.sort((a, b) => a.value.localeCompare(b.value))
  }
  // numerals and sequence both key their mapping by digit value 0-9/0-base
  const entries = puzzle.given.map((d) => ({ glyph: puzzle.digitGlyphs[d], value: String(d) }))
  puzzle.revealOrder.slice(0, extraRevealed).forEach((d) => {
    entries.push({ glyph: puzzle.digitGlyphs[d], value: String(d) })
  })
  return entries.sort((a, b) => Number(a.value) - Number(b.value))
}

function hintsRemaining(puzzle: Puzzle, extraRevealed: number): number {
  return puzzle.revealOrder.length - extraRevealed
}

function stageLabel(puzzle: Puzzle): string {
  switch (puzzle.kind) {
    case 'cipher':
      return 'Substitution panel'
    case 'numerals':
      return `Base-${puzzle.base} numeral panel`
    case 'sequence':
      return 'Sequence panel'
  }
}

type Phase = 'intro' | 'playing' | 'won' | 'lost'

function newRunSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000)
}

function Xenofuse() {
  const [runSeed, setRunSeed] = useState(newRunSeed)
  const [bombIndex, setBombIndex] = useState(0)
  const [bomb, setBomb] = useState<Bomb | null>(null)
  const [stageIndex, setStageIndex] = useState(0)
  const [extraReveals, setExtraReveals] = useState<number[]>([])
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [phase, setPhase] = useState<Phase>('intro')
  const [input, setInput] = useState('')
  const [wrongFlash, setWrongFlash] = useState(false)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [totalScore, setTotalScore] = useState(0)
  const [lastBombScore, setLastBombScore] = useState<number | null>(null)

  const timeRef = useRef(0)
  const phaseRef = useRef<Phase>('intro')
  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  // Countdown loop -- one shared timer for the whole bomb (spec.md 7),
  // running only while a bomb is actively being worked.
  useEffect(() => {
    if (phase !== 'playing') return
    const id = window.setInterval(() => {
      timeRef.current = Math.max(0, timeRef.current - TICK_MS / 1000)
      setTimeRemaining(timeRef.current)
      if (timeRef.current <= 0) {
        setPhase('lost')
      }
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [phase])

  function startBomb(index: number, seed: number) {
    const rng = makeRng(seed + index * 104729)
    const generated = generateBomb(rng, index)
    setBomb(generated)
    setStageIndex(0)
    setExtraReveals(generated.stages.map(() => 0))
    timeRef.current = generated.timeLimit
    setTimeRemaining(generated.timeLimit)
    setHintsUsed(0)
    setInput('')
    setWrongFlash(false)
    setLastBombScore(null)
    setPhase('playing')
  }

  function begin() {
    startBomb(0, runSeed)
  }

  function nextBomb() {
    startBomb(bombIndex + 1, runSeed)
    setBombIndex((i) => i + 1)
  }

  function retryBomb() {
    startBomb(bombIndex, runSeed)
  }

  function restart() {
    const seed = newRunSeed()
    setRunSeed(seed)
    setBombIndex(0)
    setTotalScore(0)
    startBomb(0, seed)
  }

  function requestHint() {
    if (!bomb) return
    const puzzle = bomb.stages[stageIndex]
    if (hintsRemaining(puzzle, extraReveals[stageIndex]) <= 0) return
    setExtraReveals((prev) => {
      const next = [...prev]
      next[stageIndex] = next[stageIndex] + 1
      return next
    })
    setHintsUsed((n) => n + 1)
    timeRef.current = Math.max(0, timeRef.current - HINT_TIME_COST)
    setTimeRemaining(timeRef.current)
    if (timeRef.current <= 0) setPhase('lost')
  }

  function submit() {
    if (!bomb || phase !== 'playing') return
    const puzzle = bomb.stages[stageIndex]
    const correct = input.trim().toUpperCase() === puzzle.answer.toUpperCase()
    if (!correct) {
      setWrongFlash(true)
      window.setTimeout(() => setWrongFlash(false), 500)
      timeRef.current = Math.max(0, timeRef.current - WRONG_ANSWER_PENALTY)
      setTimeRemaining(timeRef.current)
      if (timeRef.current <= 0) setPhase('lost')
      return
    }
    setInput('')
    if (stageIndex + 1 >= bomb.stages.length) {
      const score = Math.round(timeRef.current * 2 + bomb.stages.length * 50 - hintsUsed * 15)
      const finalScore = Math.max(0, score)
      setLastBombScore(finalScore)
      setTotalScore((t) => t + finalScore)
      setPhase('won')
    } else {
      setStageIndex((i) => i + 1)
    }
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') submit()
  }

  const stage = bomb ? bomb.stages[stageIndex] : null
  const critical = timeRemaining <= LOW_TIME_THRESHOLD

  return (
    <div className="xenofuse">
      <h1 className="sr-only">Xenofuse</h1>

      {phase === 'intro' && (
        <div className="xf-intro">
          <p className="xf-tagline">
            You've salvaged a live alien device. Crack its glyphs, deduce its logic, and enter the
            defuse code for each panel before the shared timer runs out.
          </p>
          <button type="button" className="xf-primary" onClick={begin}>
            Start Defusal
          </button>
        </div>
      )}

      {phase !== 'intro' && bomb && (
        <>
          <div className="xf-topbar">
            <span className="xf-score">Score: {totalScore}</span>
            <span className="xf-bomb-badge">Bomb {bombIndex + 1}</span>
            <span className={'xf-timer' + (critical ? ' critical' : '')}>
              {timeRemaining.toFixed(1)}s
            </span>
          </div>

          <div className="xf-stages">
            {bomb.stages.map((_, i) => (
              <span
                key={i}
                className={
                  'xf-stage-dot' +
                  (i < stageIndex || phase === 'won' ? ' cleared' : i === stageIndex && phase === 'playing' ? ' active' : '')
                }
              />
            ))}
          </div>

          {phase === 'playing' && stage && (
            <div className={'xf-panel' + (wrongFlash ? ' wrong' : '')}>
              <p className="xf-panel-label">
                {stageLabel(stage)} — {stageIndex + 1} of {bomb.stages.length}
              </p>

              <div className="xf-code">{stage.code}</div>

              <p className="xf-clue-text">{stage.clueText}</p>

              <div className="xf-clue-table">
                {clueEntries(stage, extraReveals[stageIndex]).map((entry) => (
                  <span key={entry.glyph} className="xf-clue-pair">
                    <span className="xf-clue-glyph">{entry.glyph}</span>
                    <span className="xf-clue-eq">=</span>
                    <span className="xf-clue-value">{entry.value}</span>
                  </span>
                ))}
              </div>

              <div className="xf-input-row">
                <input
                  type="text"
                  className="xf-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onInputKeyDown}
                  placeholder="Enter defuse code"
                  autoFocus
                />
                <button type="button" className="xf-primary" onClick={submit} disabled={!input.trim()}>
                  Submit
                </button>
              </div>

              <button
                type="button"
                className="xf-hint-button"
                onClick={requestHint}
                disabled={hintsRemaining(stage, extraReveals[stageIndex]) <= 0}
              >
                Reveal another glyph (−{HINT_TIME_COST}s)
              </button>

              {wrongFlash && <p className="xf-wrong-msg">Not it — try again. (−{WRONG_ANSWER_PENALTY}s)</p>}
            </div>
          )}

          {phase === 'won' && (
            <div className="xf-result xf-result-good">
              <p className="xf-result-headline">💥❌ Bomb disarmed!</p>
              <p className="xf-result-detail">
                +{lastBombScore} points · {timeRemaining.toFixed(1)}s remaining · {hintsUsed} hint
                {hintsUsed === 1 ? '' : 's'} used
              </p>
              <div className="xf-result-buttons">
                <button type="button" className="xf-primary" onClick={nextBomb}>
                  Next Bomb
                </button>
                <button type="button" className="xf-secondary" onClick={restart}>
                  Restart Run
                </button>
              </div>
            </div>
          )}

          {phase === 'lost' && (
            <div className="xf-result xf-result-bad">
              <p className="xf-result-headline">💥 Detonated</p>
              {stage && (
                <p className="xf-result-detail">
                  This panel's code was <strong>{stage.answer}</strong>.
                </p>
              )}
              <div className="xf-result-buttons">
                <button type="button" className="xf-primary" onClick={retryBomb}>
                  Retry This Bomb
                </button>
                <button type="button" className="xf-secondary" onClick={restart}>
                  Restart Run
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Xenofuse
