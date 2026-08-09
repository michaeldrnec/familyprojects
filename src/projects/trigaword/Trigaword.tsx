import { useMemo, useState } from 'react'
import { buildPuzzle, type PoolTile, type Puzzle } from './words'
import './Trigaword.css'

interface Cell {
  target: string
  filled: PoolTile | null
  locked: boolean
}

function boardFromPuzzle(puzzle: Puzzle): Cell[][] {
  return puzzle.rows.map((row) => {
    const cells: Cell[] = [
      { target: row.given, filled: { id: 'given', char: row.given }, locked: true },
    ]
    for (let i = 1; i < row.word.length; i++) {
      cells.push({ target: row.word[i], filled: null, locked: false })
    }
    return cells
  })
}

function Trigaword() {
  const [puzzle, setPuzzle] = useState<Puzzle>(() => buildPuzzle())
  const [board, setBoard] = useState<Cell[][]>(() => boardFromPuzzle(puzzle))
  const [pool, setPool] = useState<PoolTile[]>(() => puzzle.pool)
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null)
  const [wrongCells, setWrongCells] = useState<Set<string>>(new Set())

  const won = useMemo(
    () => board.every((row) => row.every((cell) => cell.locked)),
    [board],
  )

  function newPuzzle() {
    const p = buildPuzzle()
    setPuzzle(p)
    setBoard(boardFromPuzzle(p))
    setPool(p.pool)
    setSelectedTileId(null)
    setWrongCells(new Set())
  }

  function selectTile(id: string) {
    setSelectedTileId((cur) => (cur === id ? null : id))
  }

  function clickCell(rowIdx: number, colIdx: number) {
    const cell = board[rowIdx][colIdx]
    if (cell.locked) return

    setWrongCells(new Set())

    if (cell.filled) {
      // Return this tile to the pool and clear the cell.
      const tile = cell.filled
      setBoard((prev) =>
        prev.map((row, r) =>
          r !== rowIdx
            ? row
            : row.map((c, c2) => (c2 !== colIdx ? c : { ...c, filled: null })),
        ),
      )
      setPool((prev) => [...prev, tile])
      setSelectedTileId(null)
      return
    }

    if (!selectedTileId) return
    const tile = pool.find((t) => t.id === selectedTileId)
    if (!tile) return

    setBoard((prev) =>
      prev.map((row, r) =>
        r !== rowIdx
          ? row
          : row.map((c, c2) => (c2 !== colIdx ? c : { ...c, filled: tile })),
      ),
    )
    setPool((prev) => prev.filter((t) => t.id !== selectedTileId))
    setSelectedTileId(null)
  }

  function check() {
    const stillWrong = new Set<string>()
    const returnedTiles: PoolTile[] = []

    const nextBoard = board.map((row, r) =>
      row.map((cell, c) => {
        if (cell.locked || !cell.filled) return cell
        if (cell.filled.char === cell.target) {
          return { ...cell, locked: true }
        }
        returnedTiles.push(cell.filled)
        stillWrong.add(`${r}-${c}`)
        return { ...cell, filled: null }
      }),
    )

    setBoard(nextBoard)
    if (returnedTiles.length > 0) {
      setPool((prev) => [...prev, ...returnedTiles])
    }
    setWrongCells(stillWrong)
  }

  return (
    <div className="trigaword">
      <h1>Trigaword</h1>
      <p>
        Fill in every blank using the letters below. Each row is its own word;
        the first letter is already given. Click a letter, then click a blank
        to place it — click a filled blank to take it back. Use{' '}
        <strong>Check</strong> when you're ready.
      </p>

      {won && (
        <div className="win">
          🎉 Solved it!
          <button type="button" onClick={newPuzzle}>New puzzle</button>
        </div>
      )}

      <div className="pyramid">
        {board.map((row, rowIdx) => (
          <div key={rowIdx} className="pyramid-row">
            {row.map((cell, colIdx) => (
              <button
                key={colIdx}
                type="button"
                className={
                  'cell' +
                  (cell.locked ? ' locked' : '') +
                  (colIdx === 0 ? ' given' : '') +
                  (wrongCells.has(`${rowIdx}-${colIdx}`) ? ' wrong' : '')
                }
                onClick={() => clickCell(rowIdx, colIdx)}
                disabled={cell.locked}
              >
                {cell.filled?.char ?? ''}
              </button>
            ))}
          </div>
        ))}
      </div>

      {!won && (
        <>
          <div className="pool">
            {pool.map((tile) => (
              <button
                key={tile.id}
                type="button"
                className={'tile' + (tile.id === selectedTileId ? ' selected' : '')}
                onClick={() => selectTile(tile.id)}
              >
                {tile.char}
              </button>
            ))}
          </div>

          <div className="controls">
            <button type="button" onClick={check}>Check</button>
            <button type="button" onClick={newPuzzle}>New Puzzle</button>
          </div>
        </>
      )}
    </div>
  )
}

export default Trigaword
