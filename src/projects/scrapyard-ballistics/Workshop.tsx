import { useEffect, useMemo, useRef, useState } from 'react'
import { PART_DEFS, PART_ORDER, type PartCategory, type PartId } from './parts'
import {
  blueprintStats,
  canPlace,
  emptyBlueprint,
  inventoryShortfall,
  missingUids,
  partAt,
  partCounts,
  placePart,
  removePart,
  rotatePart,
  type Blueprint,
  type Rot,
} from './workshop'
import type { SaveData } from './progress'
import { drawBlueprint, hitTest, layoutBlueprint } from './render/blueprint'
import { pointerPos, useCanvasLoop } from './useCanvas'
import { formatSpeed, partSpecs } from './format'
import * as audio from './audio'

interface Props {
  save: SaveData
  onChange: (bp: Blueprint) => void
  onBack: () => void
  onWiring: () => void
  onLaunch: () => void
}

const CATEGORY_LABEL: Record<PartCategory, string> = {
  command: 'Seats',
  engine: 'Engines',
  tank: 'Fuel',
  structure: 'Structure',
  utility: 'Gadgets',
}

export default function Workshop({ save, onChange, onBack, onWiring, onLaunch }: Props) {
  const bp = save.blueprint
  const [palette, setPalette] = useState<PartId | null>(null)
  const [rot, setRot] = useState<Rot>(0)
  const [selectedUid, setSelectedUid] = useState<number | null>(null)
  const hoverRef = useRef<{ c: number; r: number } | null>(null)

  const stats = useMemo(() => blueprintStats(bp), [bp])
  const used = useMemo(() => partCounts(bp), [bp])
  const missing = useMemo(() => missingUids(bp, save.inventory), [bp, save.inventory])
  const shortfall = inventoryShortfall(bp, save.inventory)
  const canLaunch = bp.parts.length > 0 && Object.keys(shortfall).length === 0

  const available = (id: PartId) => (save.inventory[id] ?? 0) - (used[id] ?? 0)
  const selected = selectedUid !== null ? bp.parts.find((p) => p.uid === selectedUid) : undefined

  const canvasRef = useCanvasLoop((ctx, w, h, _dt, time) => {
    const l = layoutBlueprint(w, h)
    const hover = hoverRef.current
    const ghost =
      palette && hover
        ? { partId: palette, c: hover.c, r: hover.r, rot, valid: canPlace(bp, palette, hover.c, hover.r, rot) && available(palette) > 0 }
        : undefined
    drawBlueprint(ctx, l, bp, { mode: 'build', ghost, selectedUid, missing, stats, time })
  })

  function cellFrom(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const pos = pointerPos(e, canvas)
    const hit = hitTest(layoutBlueprint(rect.width, rect.height), pos.x, pos.y)
    return hit?.kind === 'cell' ? hit : null
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const cell = cellFrom(e)
    hoverRef.current = cell ? { c: cell.c, r: cell.r } : null
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    audio.init()
    const cell = cellFrom(e)
    hoverRef.current = cell ? { c: cell.c, r: cell.r } : null
    if (!cell) {
      setSelectedUid(null)
      return
    }
    const existing = partAt(bp, cell.c, cell.r)
    if (palette && !existing) {
      if (available(palette) <= 0 || !canPlace(bp, palette, cell.c, cell.r, rot)) {
        audio.playDenied()
        return
      }
      onChange(placePart(bp, palette, cell.c, cell.r, rot))
      audio.playPlace()
      if (available(palette) <= 1) setPalette(null)
      return
    }
    if (existing) {
      setPalette(null)
      setSelectedUid(existing.uid === selectedUid ? null : existing.uid)
      return
    }
    setSelectedUid(null)
  }

  function rotate() {
    if (selected) {
      const next = rotatePart(bp, selected.uid)
      if (!next) return audio.playDenied()
      audio.playPlace()
      onChange(next)
    } else {
      setRot((r) => ((r + 1) % 4) as Rot)
    }
  }

  function remove() {
    if (!selected) return
    onChange(removePart(bp, selected.uid))
    audio.playRemove()
    setSelectedUid(null)
  }

  function removeMissing() {
    let next = bp
    for (const uid of missing) next = removePart(next, uid)
    onChange(next)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'r' || e.key === 'R') rotate()
      else if (e.key === 'Delete' || e.key === 'Backspace') remove()
      else if (e.key === 'Escape') {
        setPalette(null)
        setSelectedUid(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const categories = (Object.keys(CATEGORY_LABEL) as PartCategory[]).map((cat) => ({
    cat,
    ids: PART_ORDER.filter((id) => PART_DEFS[id].category === cat && ((save.inventory[id] ?? 0) > 0 || (used[id] ?? 0) > 0)),
  }))

  return (
    <div className="sb-screen sb-workshop">
      <header className="sb-bar">
        <button className="sb-btn" onClick={onBack}>
          ← Barn
        </button>
        <h2>Workshop</h2>
        <div className="sb-bar-right">
          <button className="sb-btn" onClick={onWiring}>
            Wiring →
          </button>
          <button className="sb-btn sb-btn-launch" disabled={!canLaunch} onClick={onLaunch}>
            🚀 Launch
          </button>
        </div>
      </header>
      <div className="sb-build-layout">
        <div className="sb-board">
          <canvas
            ref={canvasRef}
            className="sb-canvas"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerLeave={() => (hoverRef.current = null)}
          />
        </div>
        <aside className="sb-panel">
          {selected ? (
            <section className="sb-card sb-selected">
              <h3>{PART_DEFS[selected.partId].name}</h3>
              <p className="sb-muted">{PART_DEFS[selected.partId].blurb}</p>
              <p className="sb-specs">{partSpecs(PART_DEFS[selected.partId]).join(' · ')}</p>
              <div className="sb-row">
                <button className="sb-btn" onClick={rotate}>
                  ⟳ Rotate (R)
                </button>
                <button className="sb-btn sb-btn-danger" onClick={remove}>
                  Remove
                </button>
              </div>
            </section>
          ) : (
            <section className="sb-card sb-palette">
              <div className="sb-palette-head">
                <h3>Scrap pile</h3>
                <button className="sb-btn sb-btn-small" onClick={rotate} title="Rotate (R)">
                  ⟳ {rot * 90}°
                </button>
              </div>
              {categories.map(({ cat, ids }) =>
                ids.length === 0 ? null : (
                  <div key={cat} className="sb-palette-group">
                    <h4>{CATEGORY_LABEL[cat]}</h4>
                    <div className="sb-palette-items">
                      {ids.map((id) => {
                        const n = available(id)
                        return (
                          <button
                            key={id}
                            className={`sb-chip${palette === id ? ' active' : ''}`}
                            disabled={n <= 0}
                            onClick={() => {
                              setSelectedUid(null)
                              setPalette(palette === id ? null : id)
                            }}
                            title={PART_DEFS[id].blurb}
                          >
                            {PART_DEFS[id].name} <b>×{n}</b>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ),
              )}
              {palette && <p className="sb-muted">Tap the grid to place. {PART_DEFS[palette].blurb}</p>}
            </section>
          )}

          <section className="sb-card sb-readout">
            <dl className="sb-stats">
              <dt>Mass</dt>
              <dd>{Math.round(stats.mass).toLocaleString()} kg</dd>
              <dt>Liftoff TWR</dt>
              <dd className={stats.twr > 0 && stats.twr < 1.1 ? 'warn' : ''}>{stats.twr.toFixed(2)}</dd>
              <dt>Thrust torque</dt>
              <dd className={Math.abs(stats.torque) > 1500 ? 'warn' : ''}>
                {(stats.torque / 1000).toFixed(2)} kN·m {Math.abs(stats.torque) > 150 ? (stats.torque > 0 ? '↻' : '↺') : ''}
              </dd>
              <dt>Δv (rough)</dt>
              <dd>{formatSpeed(stats.deltaV)}</dd>
            </dl>
            {stats.warnings.length > 0 && (
              <ul className="sb-warnings">
                {stats.warnings.map((w) => (
                  <li key={w}>⚠ {w}</li>
                ))}
              </ul>
            )}
            {missing.size > 0 && (
              <div className="sb-missing">
                <p>
                  ✖ {missing.size} part(s) on the board aren’t in your scrap pile anymore (lost last flight).
                </p>
                <button className="sb-btn sb-btn-small" onClick={removeMissing}>
                  Remove them
                </button>
              </div>
            )}
            <button
              className="sb-link"
              onClick={() => {
                onChange(emptyBlueprint())
                setSelectedUid(null)
              }}
            >
              Clear the board
            </button>
          </section>
        </aside>
      </div>
    </div>
  )
}
