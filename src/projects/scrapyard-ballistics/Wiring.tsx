import { useState } from 'react'
import { PART_DEFS } from './parts'
import { inventoryShortfall, partAt, type Blueprint } from './workshop'
import {
  BUTTON_LABEL,
  INPUT_LABEL,
  OUTPUT_LABEL,
  autoWire,
  inputsOf,
  outputsOf,
  sameWire,
  settingsFor,
  sourceKey,
  type InputPort,
  type SourceRef,
  type Wire,
} from './wiring'
import type { SaveData } from './progress'
import { drawBlueprint, hitTest, layoutBlueprint, wireColor } from './render/blueprint'
import { pointerPos, useCanvasLoop } from './useCanvas'
import { formatAlt } from './format'
import * as audio from './audio'

interface Props {
  save: SaveData
  onChange: (bp: Blueprint) => void
  onBack: () => void
  onLaunch: () => void
}

export default function Wiring({ save, onChange, onBack, onLaunch }: Props) {
  const bp = save.blueprint
  const [pending, setPending] = useState<SourceRef | null>(null)
  const [selectedUid, setSelectedUid] = useState<number | null>(null)
  const [choosingInput, setChoosingInput] = useState<number | null>(null)
  const canLaunch = bp.parts.length > 0 && Object.keys(inventoryShortfall(bp, save.inventory)).length === 0

  const canvasRef = useCanvasLoop((ctx, w, h, _dt, time) => {
    drawBlueprint(ctx, layoutBlueprint(w, h), bp, { mode: 'wire', selectedUid, pending, time })
  })

  function sourceName(src: SourceRef): string {
    if (src.kind === 'button') return BUTTON_LABEL[src.id]
    const p = bp.parts.find((q) => q.uid === src.uid)
    return p ? `${PART_DEFS[p.partId].name} ${OUTPUT_LABEL[src.port]}` : '?'
  }

  function partName(uid: number): string {
    const p = bp.parts.find((q) => q.uid === uid)
    return p ? PART_DEFS[p.partId].name : '?'
  }

  function addWire(src: SourceRef, uid: number, port: InputPort) {
    const wire: Wire = { from: src, to: { uid, port } }
    if (src.kind === 'part' && src.uid === uid) return audio.playDenied()
    if (bp.wires.some((w) => sameWire(w, wire))) return audio.playDenied()
    onChange({ ...bp, wires: [...bp.wires, wire] })
    audio.playWire()
    setChoosingInput(null)
  }

  function removeWire(w: Wire) {
    onChange({ ...bp, wires: bp.wires.filter((q) => !sameWire(q, w)) })
    audio.playRemove()
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    audio.init()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const pos = pointerPos(e, canvas)
    const hit = hitTest(layoutBlueprint(rect.width, rect.height), pos.x, pos.y)
    if (!hit) {
      setPending(null)
      setSelectedUid(null)
      setChoosingInput(null)
      return
    }
    if (hit.kind === 'terminal') {
      const src: SourceRef = { kind: 'button', id: hit.id }
      setPending(pending && sourceKey(pending) === sourceKey(src) ? null : src)
      setChoosingInput(null)
      audio.playPlace()
      return
    }
    const part = partAt(bp, hit.c, hit.r)
    if (!part) {
      setSelectedUid(null)
      setChoosingInput(null)
      return
    }
    setSelectedUid(part.uid)
    if (pending) {
      const inputs = inputsOf(part)
      if (inputs.length === 0) {
        audio.playDenied()
        setChoosingInput(null)
      } else if (inputs.length === 1) {
        addWire(pending, part.uid, inputs[0])
      } else {
        setChoosingInput(part.uid)
      }
    } else {
      setChoosingInput(null)
    }
  }

  function updateSetting(uid: number, patch: Partial<ReturnType<typeof settingsFor>>) {
    onChange({ ...bp, settings: { ...bp.settings, [uid]: { ...settingsFor(bp, uid), ...patch } } })
  }

  const selected = selectedUid !== null ? bp.parts.find((p) => p.uid === selectedUid) : undefined
  const selectedSettings = selected ? settingsFor(bp, selected.uid) : null

  return (
    <div className="sb-screen sb-wiring">
      <header className="sb-bar">
        <button className="sb-btn" onClick={onBack}>
          ← Workshop
        </button>
        <h2>Wiring</h2>
        <div className="sb-bar-right">
          <button className="sb-btn sb-btn-launch" disabled={!canLaunch} onClick={onLaunch}>
            🚀 Launch
          </button>
        </div>
      </header>
      <div className="sb-build-layout">
        <div className="sb-board">
          <canvas ref={canvasRef} className="sb-canvas" onPointerDown={onPointerDown} />
        </div>
        <aside className="sb-panel">
          <section className="sb-card">
            {pending ? (
              <p>
                Wiring from <b style={{ color: wireColor(pending) }}>{sourceName(pending)}</b> — tap a part to connect.{' '}
                <button className="sb-link" onClick={() => setPending(null)}>
                  cancel
                </button>
              </p>
            ) : (
              <p className="sb-muted">
                Tap a dashboard terminal (top strip) or a part’s output below, then tap the part it should trigger.
              </p>
            )}
            {choosingInput !== null && pending && (
              <div className="sb-row">
                {inputsOf(bp.parts.find((p) => p.uid === choosingInput)!).map((port) => (
                  <button key={port} className="sb-btn sb-btn-small" onClick={() => addWire(pending, choosingInput, port)}>
                    {INPUT_LABEL[port]}
                  </button>
                ))}
              </div>
            )}
            <div className="sb-row">
              <button
                className="sb-btn"
                onClick={() => {
                  onChange(autoWire(bp))
                  audio.playWire()
                }}
              >
                ⚡ Auto-wire
              </button>
              <button className="sb-btn sb-btn-danger sb-btn-small" onClick={() => onChange({ ...bp, wires: [] })}>
                Cut all wires
              </button>
            </div>
          </section>

          {selected && (
            <section className="sb-card">
              <h3>{PART_DEFS[selected.partId].name}</h3>
              {outputsOf(selected).length > 0 && (
                <div className="sb-row">
                  {outputsOf(selected).map((port) => (
                    <button
                      key={port}
                      className="sb-btn sb-btn-small"
                      onClick={() => {
                        setPending({ kind: 'part', uid: selected.uid, port })
                        setChoosingInput(null)
                      }}
                    >
                      Wire from “{OUTPUT_LABEL[port]}”
                    </button>
                  ))}
                </div>
              )}
              {inputsOf(selected).length === 0 && outputsOf(selected).length === 0 && (
                <p className="sb-muted">Nothing to wire on this one.</p>
              )}
              {selectedSettings?.delay !== undefined && (
                <div className="sb-setting">
                  Rings after
                  <button className="sb-btn sb-btn-small" onClick={() => updateSetting(selected.uid, { delay: Math.max(1, selectedSettings.delay! - 1) })}>
                    −
                  </button>
                  <b>{selectedSettings.delay}s</b>
                  <button className="sb-btn sb-btn-small" onClick={() => updateSetting(selected.uid, { delay: Math.min(60, selectedSettings.delay! + 1) })}>
                    +
                  </button>
                </div>
              )}
              {selectedSettings?.altitude !== undefined && (
                <div className="sb-setting">
                  Trips
                  <button
                    className="sb-btn sb-btn-small"
                    onClick={() => updateSetting(selected.uid, { direction: selectedSettings.direction === 'up' ? 'down' : 'up' })}
                  >
                    {selectedSettings.direction === 'up' ? '▲ climbing' : '▼ falling'}
                  </button>
                  through
                  <button
                    className="sb-btn sb-btn-small"
                    onClick={() => updateSetting(selected.uid, { altitude: Math.max(250, selectedSettings.altitude! - (selectedSettings.altitude! > 5000 ? 1000 : 250)) })}
                  >
                    −
                  </button>
                  <b>{formatAlt(selectedSettings.altitude)}</b>
                  <button
                    className="sb-btn sb-btn-small"
                    onClick={() => updateSetting(selected.uid, { altitude: Math.min(100_000, selectedSettings.altitude! + (selectedSettings.altitude! >= 5000 ? 1000 : 250)) })}
                  >
                    +
                  </button>
                </div>
              )}
            </section>
          )}

          <section className="sb-card sb-wire-list">
            <h3>Wires ({bp.wires.length})</h3>
            {bp.wires.length === 0 && <p className="sb-muted">No wires. Nothing will happen when you press anything.</p>}
            <ul>
              {bp.wires.map((w) => (
                <li key={`${sourceKey(w.from)}>${w.to.uid}:${w.to.port}`}>
                  <span className="sb-wire-dot" style={{ background: wireColor(w.from) }} />
                  <span>
                    {sourceName(w.from)} → {partName(w.to.uid)} <i>{INPUT_LABEL[w.to.port]}</i>
                  </span>
                  <button className="sb-x" onClick={() => removeWire(w)} aria-label="Cut wire">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
