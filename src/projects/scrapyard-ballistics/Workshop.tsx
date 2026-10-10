import { useEffect, useMemo, useRef, useState } from 'react'
import { PART_DEFS, PART_ORDER, type PartCategory, type PartId } from './parts'
import {
  autoFlip,
  blueprintStats,
  canPlace,
  emptyBlueprint,
  flipPart,
  inventoryShortfall,
  isHanded,
  mirrorPlacement,
  missingUids,
  movePart,
  partAt,
  partCounts,
  placePart,
  removePart,
  rotatePart,
  type Blueprint,
  type Rot,
} from './workshop'
import { MAX_DESIGNS, STARTER_DESIGN_NAME, starterBlueprint, type SaveData } from './progress'
import { planStaging } from './staging'
import { wornUids } from './wear'
import { WIRE_COLORS, drawBlueprint, hitTest, layoutBlueprint, type Ghost } from './render/blueprint'
import { pointerPos, useCanvasLoop } from './useCanvas'
import { formatSpeed, partSpecs } from './format'
import * as audio from './audio'

interface Props {
  save: SaveData
  onChange: (bp: Blueprint) => void
  onSaveChange: (save: SaveData) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
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

interface Drag {
  uid: number
  dc: number // grabbed cell, relative to the part's top-left
  dr: number
  startC: number
  startR: number
  moved: boolean
}

export default function Workshop(props: Props) {
  const { save, onChange, onSaveChange, onUndo, onRedo, canUndo, canRedo, onBack, onWiring, onLaunch } = props
  const bp = save.blueprint
  const [palette, setPalette] = useState<PartId | null>(null)
  const [rot, setRot] = useState<Rot>(0)
  const [flip, setFlip] = useState(false)
  const [symmetry, setSymmetry] = useState(false)
  const [stageTint, setStageTint] = useState(true)
  const [selectedUid, setSelectedUid] = useState<number | null>(null)
  const [designName, setDesignName] = useState('')
  const hoverRef = useRef<{ c: number; r: number } | null>(null)
  const dragRef = useRef<Drag | null>(null)

  const stats = useMemo(() => blueprintStats(bp), [bp])
  const staging = useMemo(() => planStaging(bp), [bp])
  const used = useMemo(() => partCounts(bp), [bp])
  const missing = useMemo(() => missingUids(bp, save.inventory), [bp, save.inventory])
  const worn = useMemo(() => wornUids(bp, save.worn), [bp, save.worn])
  const stageColors = useMemo(() => {
    const m = new Map<number, string>()
    if (staging.stages.length < 2) return m // one stage: nothing to tell apart
    for (const [uid, i] of staging.stageOf) if (i >= 0) m.set(uid, WIRE_COLORS[staging.stages[i].color])
    return m
  }, [staging])
  const shortfall = inventoryShortfall(bp, save.inventory)
  const canLaunch = bp.parts.length > 0 && Object.keys(shortfall).length === 0

  const available = (id: PartId) => (save.inventory[id] ?? 0) - (used[id] ?? 0)
  const selected = selectedUid !== null ? bp.parts.find((p) => p.uid === selectedUid) : undefined

  // The part (and, with symmetry on, its mirror twin) that a tap at
  // (c, r) would place right now.
  function placements(c: number, r: number) {
    if (!palette) return []
    const f = autoFlip(bp, palette, c, r, rot, flip)
    const first = { partId: palette, c, r, rot, flip: f }
    if (!symmetry) return [first]
    const m = mirrorPlacement(palette, c, r, rot, f)
    if (m.c === c) return [first] // on the centre line: no twin
    return [first, { partId: palette, ...m }]
  }

  function placementValid(list: ReturnType<typeof placements>): boolean {
    if (list.length === 0 || !palette || available(palette) < list.length) return false
    let next = bp
    for (const p of list) {
      if (!canPlace(next, p.partId, p.c, p.r, p.rot)) return false
      next = placePart(next, p.partId, p.c, p.r, p.rot, p.flip)
    }
    return true
  }

  const canvasRef = useCanvasLoop((ctx, w, h, _dt, time) => {
    const l = layoutBlueprint(w, h)
    const hover = hoverRef.current
    const drag = dragRef.current
    const ghosts: Ghost[] = []
    if (drag?.moved && hover) {
      const p = bp.parts.find((q) => q.uid === drag.uid)
      if (p) {
        const c = hover.c - drag.dc
        const r = hover.r - drag.dr
        ghosts.push({ partId: p.partId, c, r, rot: p.rot, flip: !!p.flip, valid: canPlace(bp, p.partId, c, r, p.rot, p.uid) })
      }
    } else if (palette && hover) {
      const list = placements(hover.c, hover.r)
      const valid = placementValid(list)
      for (const g of list) ghosts.push({ ...g, valid })
    }
    drawBlueprint(ctx, l, bp, {
      mode: 'build',
      ghosts,
      selectedUid,
      missing,
      worn,
      stats,
      time,
      dimUid: drag?.moved ? drag.uid : null,
      symmetry,
      stageColors: stageTint ? stageColors : undefined,
    })
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
    const drag = dragRef.current
    if (drag && cell && (cell.c - drag.dc !== drag.startC || cell.r - drag.dr !== drag.startR)) drag.moved = true
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
      const list = placements(cell.c, cell.r)
      if (!placementValid(list)) {
        audio.playDenied()
        return
      }
      let next = bp
      for (const p of list) next = placePart(next, p.partId, p.c, p.r, p.rot, p.flip)
      onChange(next)
      audio.playPlace()
      if (available(palette) <= list.length) setPalette(null)
      return
    }
    if (existing) {
      // Pick it up: a drag moves it, a plain tap selects it.
      e.currentTarget.setPointerCapture?.(e.pointerId)
      dragRef.current = { uid: existing.uid, dc: cell.c - existing.c, dr: cell.r - existing.r, startC: existing.c, startR: existing.r, moved: false }
      setPalette(null)
      return
    }
    setSelectedUid(null)
  }

  function onPointerUp() {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    const hover = hoverRef.current
    if (!drag.moved || !hover) {
      setSelectedUid(drag.uid === selectedUid ? null : drag.uid)
      return
    }
    const next = movePart(bp, drag.uid, hover.c - drag.dc, hover.r - drag.dr)
    if (!next) return audio.playDenied()
    onChange(next)
    audio.playPlace()
    setSelectedUid(drag.uid)
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

  function mirror() {
    if (selected) {
      audio.playPlace()
      onChange(flipPart(bp, selected.uid))
    } else {
      setFlip((f) => !f)
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

  function saveDesign() {
    const name = designName.trim() || `Design ${save.designs.length + 1}`
    const others = save.designs.filter((d) => d.name !== name)
    if (others.length >= MAX_DESIGNS) return audio.playDenied()
    onSaveChange({ ...save, designs: [...others, { name, blueprint: bp }] })
    setDesignName('')
    audio.playPlace()
  }

  function loadDesign(design: Blueprint) {
    setSelectedUid(null)
    onChange(design)
    audio.playPlace()
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return
      const k = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && k === 'z') {
        e.preventDefault()
        if (e.shiftKey) onRedo()
        else onUndo()
      } else if ((e.ctrlKey || e.metaKey) && k === 'y') {
        e.preventDefault()
        onRedo()
      } else if (e.ctrlKey || e.metaKey) return
      else if (k === 'r') rotate()
      else if (k === 'f') mirror()
      else if (k === 'y') setSymmetry((s) => !s)
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
  const warnings = [...stats.warnings, ...staging.warnings]

  return (
    <div className="sb-screen sb-workshop">
      <header className="sb-bar">
        <button className="sb-btn" onClick={onBack}>
          ← Barn
        </button>
        <h2>Workshop</h2>
        <div className="sb-bar-right">
          <button className="sb-btn sb-btn-small sb-undo" disabled={!canUndo} onClick={onUndo} title="Undo (Ctrl+Z)">
            ↶
          </button>
          <button className="sb-btn sb-btn-small sb-undo" disabled={!canRedo} onClick={onRedo} title="Redo (Ctrl+Shift+Z)">
            ↷
          </button>
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
            onPointerUp={onPointerUp}
            onPointerCancel={() => (dragRef.current = null)}
            onPointerLeave={() => {
              if (!dragRef.current) hoverRef.current = null
            }}
          />
        </div>
        <aside className="sb-panel">
          {selected ? (
            <section className="sb-card sb-selected">
              <h3>
                {PART_DEFS[selected.partId].name}
                {worn.has(selected.uid) && <span className="sb-badge sb-badge-worn">WORN</span>}
              </h3>
              <p className="sb-muted">{PART_DEFS[selected.partId].blurb}</p>
              <p className="sb-specs">{partSpecs(PART_DEFS[selected.partId]).join(' · ')}</p>
              {worn.has(selected.uid) && (
                <p className="sb-muted">Worn from a hard landing: weaker welds{PART_DEFS[selected.partId].engine ? ', fails more often' : ''}. Repair it at the Black Market.</p>
              )}
              <div className="sb-row">
                <button className="sb-btn" onClick={rotate}>
                  ⟳ Rotate (R)
                </button>
                {isHanded(selected.partId) && (
                  <button className="sb-btn" onClick={mirror}>
                    ⇋ Flip (F)
                  </button>
                )}
                <button className="sb-btn sb-btn-danger" onClick={remove}>
                  Remove
                </button>
              </div>
              <p className="sb-muted">Drag a part to move it.</p>
            </section>
          ) : (
            <section className="sb-card sb-palette">
              <div className="sb-palette-head">
                <h3>Scrap pile</h3>
                <div className="sb-row">
                  <button className="sb-btn sb-btn-small" onClick={rotate} title="Rotate (R)">
                    ⟳ {rot * 90}°
                  </button>
                  <button
                    className={`sb-btn sb-btn-small${flip ? ' active' : ''}`}
                    onClick={mirror}
                    title="Mirror left/right (F). Fins also flip on their own to face the hull."
                  >
                    ⇋ {flip ? 'Mirrored' : 'Flip'}
                  </button>
                  <button
                    className={`sb-btn sb-btn-small${symmetry ? ' active' : ''}`}
                    onClick={() => setSymmetry((s) => !s)}
                    title="Symmetry (Y): place a mirrored twin on the other side of the centre line"
                  >
                    ⫼ Sym
                  </button>
                </div>
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
              {palette && (
                <p className="sb-muted">
                  Tap the grid to place{symmetry ? ' a mirrored pair' : ''}. {PART_DEFS[palette].blurb}
                </p>
              )}
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
              <dt>Δv (all stages)</dt>
              <dd>{formatSpeed(staging.stages.length > 0 ? staging.totalDeltaV : stats.deltaV)}</dd>
            </dl>
            {staging.stages.length > 0 && (
              <table className="sb-stage-table">
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th>TWR</th>
                    <th>Δv</th>
                  </tr>
                </thead>
                <tbody>
                  {staging.stages.map((st, i) => (
                    <tr key={i}>
                      <td>
                        <span className="sb-wire-dot" style={{ background: WIRE_COLORS[st.color] }} /> {i + 1}. {st.label}
                      </td>
                      <td className={st.twr < 1 ? 'warn' : ''}>{st.twr.toFixed(2)}</td>
                      <td>{formatSpeed(st.deltaV)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {staging.stages.length > 1 && (
              <label className="sb-check">
                <input type="checkbox" checked={stageTint} onChange={(e) => setStageTint(e.target.checked)} /> Colour parts by the stage they
                drop with
              </label>
            )}
            {warnings.length > 0 && (
              <ul className="sb-warnings">
                {warnings.map((w) => (
                  <li key={w}>⚠ {w}</li>
                ))}
              </ul>
            )}
            {worn.size > 0 && (
              <p className="sb-worn-note">🔧 {worn.size} worn part(s) on the board (orange corners): weaker welds, flakier engines.</p>
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

          <section className="sb-card sb-designs">
            <h3>Saved designs</h3>
            <ul>
              <li>
                <span>{STARTER_DESIGN_NAME}</span>
                <button className="sb-btn sb-btn-tiny" onClick={() => loadDesign(starterBlueprint())}>
                  Load
                </button>
              </li>
              {save.designs.map((d) => (
                <li key={d.name}>
                  <span>{d.name}</span>
                  <button className="sb-btn sb-btn-tiny" onClick={() => loadDesign(d.blueprint)}>
                    Load
                  </button>
                  <button
                    className="sb-x"
                    aria-label={`Delete ${d.name}`}
                    onClick={() => onSaveChange({ ...save, designs: save.designs.filter((q) => q.name !== d.name) })}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <div className="sb-row">
              <input
                className="sb-input"
                value={designName}
                maxLength={28}
                placeholder="Name this design"
                onChange={(e) => setDesignName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveDesign()}
              />
              <button
                className="sb-btn sb-btn-small"
                disabled={bp.parts.length === 0 || (save.designs.length >= MAX_DESIGNS && !save.designs.some((d) => d.name === designName.trim()))}
                onClick={saveDesign}
              >
                Save
              </button>
            </div>
            <p className="sb-muted">
              Up to {MAX_DESIGNS} designs. Saving under an existing name overwrites it. Loading is undoable (Ctrl+Z).
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}
