// The hospital floor canvas: fills its parent, redraws every frame from the
// live shift, and turns taps and clicks into where the doctor should go.
import type { PointerEvent } from 'react'
import { pointerPos, useCanvasLoop } from '../../../shared/useCanvasLoop'
import { FLOOR_H, FLOOR_W, stationAt } from '../sim/floor'
import type { ShiftState, Target } from '../sim/types'
import { drawFloor, fitView } from './drawFloor'

export default function Floor({
  get,
  selected,
  reducedMotion,
  onTap,
}: {
  get: () => ShiftState | null
  selected: number | null
  reducedMotion: boolean
  onTap: (target: Target) => void
}) {
  const canvasRef = useCanvasLoop((ctx, w, h, _dt, time) => {
    const s = get()
    if (s) drawFloor(ctx, w, h, s, { selected, time, reducedMotion })
  })

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const { x, y } = pointerPos(e, canvas)
    const rect = canvas.getBoundingClientRect()
    const v = fitView(rect.width, rect.height)
    const lx = (x - v.ox) / v.scale
    const ly = (y - v.oy) / v.scale
    if (lx < 0 || ly < 0 || lx > FLOOR_W || ly > FLOOR_H) return
    const station = stationAt(lx, ly)
    if (!station) onTap({ kind: 'point', x: lx, y: ly })
    else if (station.startsWith('bay')) onTap({ kind: 'bay', bay: Number(station.slice(3)) })
    else onTap({ kind: station as 'supply' | 'sink' | 'or' })
  }

  return <canvas ref={canvasRef} className="tc-floor" onPointerDown={onPointerDown} aria-label="Hospital floor: tap a room to walk there" />
}
