import { useState } from 'react'
import { colorDistance, mixColor, toCss, type LensCounts } from './colors'
import { LEVELS } from './levels'
import './Rainglow.css'

const MATCH_TOLERANCE = 12
const EMPTY: LensCounts = { red: 0, yellow: 0, blue: 0 }

const LENS_COLORS: { key: keyof LensCounts; label: string }[] = [
  { key: 'red', label: 'Red' },
  { key: 'yellow', label: 'Yellow' },
  { key: 'blue', label: 'Blue' },
]

function Rainglow() {
  const [levelIndex, setLevelIndex] = useState(0)
  const [counts, setCounts] = useState<LensCounts>(EMPTY)

  const finished = levelIndex >= LEVELS.length
  const level = !finished ? LEVELS[levelIndex] : null
  const required = level ? level.target.red + level.target.yellow + level.target.blue : 0
  const currentTotal = counts.red + counts.yellow + counts.blue

  const targetColor = level ? mixColor(level.target) : null
  const currentColor = mixColor(counts)
  const matched =
    level !== null &&
    currentTotal === required &&
    colorDistance(currentColor, targetColor!) <= MATCH_TOLERANCE

  function addLens(key: keyof LensCounts) {
    if (matched || currentTotal >= required) return
    setCounts((c) => ({ ...c, [key]: c[key] + 1 }))
  }

  function removeLens(key: keyof LensCounts) {
    if (matched || counts[key] <= 0) return
    setCounts((c) => ({ ...c, [key]: c[key] - 1 }))
  }

  function resetLevel() {
    setCounts(EMPTY)
  }

  function nextLevel() {
    setLevelIndex((i) => i + 1)
    setCounts(EMPTY)
  }

  function restart() {
    setLevelIndex(0)
    setCounts(EMPTY)
  }

  return (
    <div className="rainglow">
      <h1>Rainglow</h1>
      <p>
        Add colored lenses so the light hitting the sensor matches the target
        color. Level <em>N</em> needs exactly <em>N</em> lenses.
      </p>

      {finished ? (
        <div className="results">
          <p className="score">🎉 You completed all {LEVELS.length} levels!</p>
          <button type="button" onClick={restart}>Play Again</button>
        </div>
      ) : (
        <>
          <p className="progress">
            Level {level!.number} of {LEVELS.length} — {currentTotal} / {required} lenses
          </p>

          <div className="swatches">
            <div className="swatch-block">
              <span className="swatch-label">Target</span>
              <div className="swatch" style={{ background: toCss(targetColor!) }} />
            </div>
            <div className="swatch-block">
              <span className="swatch-label">Sensor</span>
              <div className="swatch" style={{ background: toCss(currentColor) }} />
            </div>
          </div>

          {matched ? (
            <div className="win">
              🎉 Matched!
              <button type="button" onClick={nextLevel}>
                {level!.number === LEVELS.length ? 'Finish' : 'Next Level'}
              </button>
            </div>
          ) : (
            <>
              <div className="tray">
                {LENS_COLORS.map(({ key, label }) => (
                  <div key={key} className={`lens lens-${key}`}>
                    <span className="lens-label">{label}</span>
                    <span className="lens-count">{counts[key]}</span>
                    <div className="lens-buttons">
                      <button
                        type="button"
                        onClick={() => removeLens(key)}
                        disabled={counts[key] <= 0}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        onClick={() => addLens(key)}
                        disabled={currentTotal >= required}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button type="button" className="reset-button" onClick={resetLevel}>
                Reset Level
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default Rainglow
