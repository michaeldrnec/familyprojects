// The blueprint board shared by the Workshop and Wiring screens: a cyan
// drafting grid, part line-art, weld ticks, COM / center-of-thrust
// markers, and -- along the top -- the dashboard terminal strip that
// wires start from. Layout + hit-testing live here too so both screens
// agree on where everything is.
import { PART_DEFS, type PartId } from '../parts'
import {
  GRID_COLS,
  GRID_ROWS,
  footprint,
  partCenter,
  welds,
  type Blueprint,
  type BlueprintStats,
  type Rot,
} from '../workshop'
import { BUTTONS, BUTTON_LABEL, INPUT_LABEL, type ButtonId, type SourceRef } from '../wiring'
import { BLUEPRINT_STYLE, drawPartArt } from './partArt'

export interface BlueprintLayout {
  width: number
  height: number
  cell: number
  ox: number // grid top-left
  oy: number
  terminals: { id: ButtonId; x: number; y: number; w: number; h: number }[]
}

export function layoutBlueprint(width: number, height: number): BlueprintLayout {
  const pad = 12
  const cell = Math.max(12, Math.min((width - pad * 2) / GRID_COLS, (height - pad * 2) / (GRID_ROWS + 1.5)))
  const gridW = cell * GRID_COLS
  const gridH = cell * GRID_ROWS
  const stripH = cell * 1.1
  const totalH = stripH + cell * 0.4 + gridH
  const ox = (width - gridW) / 2
  const top = Math.max(pad, (height - totalH) / 2)
  const oy = top + stripH + cell * 0.4
  const tw = gridW / BUTTONS.length
  const terminals = BUTTONS.map((id, i) => ({ id, x: ox + i * tw + 3, y: top, w: tw - 6, h: stripH }))
  return { width, height, cell, ox, oy, terminals }
}

export type BlueprintHit = { kind: 'cell'; c: number; r: number } | { kind: 'terminal'; id: ButtonId } | null

export function hitTest(l: BlueprintLayout, x: number, y: number): BlueprintHit {
  for (const t of l.terminals) {
    if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) return { kind: 'terminal', id: t.id }
  }
  const c = Math.floor((x - l.ox) / l.cell)
  const r = Math.floor((y - l.oy) / l.cell)
  if (c < 0 || r < 0 || c >= GRID_COLS || r >= GRID_ROWS) return null
  return { kind: 'cell', c, r }
}

export const WIRE_COLORS: Record<ButtonId | 'part', string> = {
  IGNITE: '#ff5d5d',
  STAGE1: '#ffa94d',
  STAGE2: '#ffe066',
  STAGE3: '#8ce99a',
  STAGE4: '#74c0fc',
  part: '#e599f7',
}

export function wireColor(src: SourceRef): string {
  return src.kind === 'button' ? WIRE_COLORS[src.id] : WIRE_COLORS.part
}

export interface BlueprintDrawOptions {
  mode: 'build' | 'wire'
  ghost?: { partId: PartId; c: number; r: number; rot: Rot; valid: boolean }
  selectedUid?: number | null
  pending?: SourceRef | null
  missing?: Set<number> // uids beyond inventory
  stats?: BlueprintStats
  time: number
}

function cellToPx(l: BlueprintLayout, x: number, y: number) {
  return { x: l.ox + x * l.cell, y: l.oy + y * l.cell }
}

function terminalAnchor(l: BlueprintLayout, id: ButtonId) {
  const t = l.terminals.find((q) => q.id === id)!
  return { x: t.x + t.w / 2, y: t.y + t.h }
}

export function drawBlueprint(ctx: CanvasRenderingContext2D, l: BlueprintLayout, bp: Blueprint, o: BlueprintDrawOptions) {
  const { cell } = l
  // Paper
  ctx.fillStyle = '#0d3a66'
  ctx.fillRect(0, 0, l.width, l.height)
  const vignette = ctx.createRadialGradient(l.width / 2, l.height / 2, 0, l.width / 2, l.height / 2, Math.max(l.width, l.height) * 0.7)
  vignette.addColorStop(0, 'rgba(40,110,170,0.35)')
  vignette.addColorStop(1, 'rgba(0,10,30,0.4)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, l.width, l.height)

  // Grid: fine lines every cell, heavier every 3.
  for (let c = 0; c <= GRID_COLS; c++) {
    ctx.strokeStyle = c % 3 === 0 ? 'rgba(160,215,255,0.35)' : 'rgba(160,215,255,0.14)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(l.ox + c * cell, l.oy)
    ctx.lineTo(l.ox + c * cell, l.oy + GRID_ROWS * cell)
    ctx.stroke()
  }
  for (let r = 0; r <= GRID_ROWS; r++) {
    ctx.strokeStyle = r % 3 === 0 ? 'rgba(160,215,255,0.35)' : 'rgba(160,215,255,0.14)'
    ctx.beginPath()
    ctx.moveTo(l.ox, l.oy + r * cell)
    ctx.lineTo(l.ox + GRID_COLS * cell, l.oy + r * cell)
    ctx.stroke()
  }
  // Launch pad line under the grid.
  ctx.strokeStyle = 'rgba(255,209,102,0.5)'
  ctx.setLineDash([6, 4])
  ctx.beginPath()
  ctx.moveTo(l.ox - cell * 0.3, l.oy + GRID_ROWS * cell + 3)
  ctx.lineTo(l.ox + GRID_COLS * cell + cell * 0.3, l.oy + GRID_ROWS * cell + 3)
  ctx.stroke()
  ctx.setLineDash([])

  // Dashboard terminal strip.
  ctx.font = `600 ${Math.max(9, cell * 0.3)}px ui-monospace, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const t of l.terminals) {
    const active = o.pending?.kind === 'button' && o.pending.id === t.id
    const color = WIRE_COLORS[t.id]
    ctx.fillStyle = active ? color : 'rgba(5,25,50,0.85)'
    ctx.strokeStyle = color
    ctx.lineWidth = active ? 2.5 : 1.5
    ctx.globalAlpha = o.mode === 'wire' ? 1 : 0.55
    ctx.beginPath()
    ctx.roundRect(t.x, t.y, t.w, t.h, 6)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = active ? '#07182c' : color
    ctx.fillText(BUTTON_LABEL[t.id], t.x + t.w / 2, t.y + t.h / 2)
    ctx.globalAlpha = 1
  }

  // Welds (build mode): short yellow ticks on each welded edge.
  if (o.mode === 'build') {
    ctx.strokeStyle = 'rgba(255,209,102,0.85)'
    ctx.lineWidth = 2.5
    for (const w of welds(bp)) {
      const a = cellToPx(l, w.x1, w.y1)
      const b = cellToPx(l, w.x2, w.y2)
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      const dx = (b.x - a.x) * 0.25
      const dy = (b.y - a.y) * 0.25
      ctx.beginPath()
      ctx.moveTo(mx - dx, my - dy)
      ctx.lineTo(mx + dx, my + dy)
      ctx.stroke()
    }
  }

  // Parts
  for (const p of bp.parts) {
    const def = PART_DEFS[p.partId]
    const { w, h } = footprint(p.partId, p.rot)
    const c = partCenter(p)
    const px = cellToPx(l, c.x, c.y)
    const missing = o.missing?.has(p.uid)
    const selected = o.selectedUid === p.uid
    ctx.save()
    ctx.translate(px.x, px.y)
    ctx.globalAlpha = missing ? 0.35 : 1
    drawPartArt(ctx, def, p.rot, cell, BLUEPRINT_STYLE)
    ctx.restore()
    if (selected) {
      const tl = cellToPx(l, p.c, p.r)
      ctx.strokeStyle = '#ffd166'
      ctx.lineWidth = 2
      ctx.setLineDash([4, 3])
      ctx.strokeRect(tl.x + 2, tl.y + 2, w * cell - 4, h * cell - 4)
      ctx.setLineDash([])
    }
    if (missing) {
      const tl = cellToPx(l, p.c, p.r)
      ctx.strokeStyle = '#ff6b6b'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(tl.x + 4, tl.y + 4)
      ctx.lineTo(tl.x + w * cell - 4, tl.y + h * cell - 4)
      ctx.stroke()
    }
  }

  // Ghost placement
  if (o.ghost) {
    const def = PART_DEFS[o.ghost.partId]
    const { w, h } = footprint(o.ghost.partId, o.ghost.rot)
    const tl = cellToPx(l, o.ghost.c, o.ghost.r)
    ctx.fillStyle = o.ghost.valid ? 'rgba(140,233,154,0.18)' : 'rgba(255,107,107,0.22)'
    ctx.fillRect(tl.x, tl.y, w * cell, h * cell)
    ctx.save()
    ctx.translate(tl.x + (w * cell) / 2, tl.y + (h * cell) / 2)
    ctx.globalAlpha = 0.6
    drawPartArt(ctx, def, o.ghost.rot, cell, BLUEPRINT_STYLE)
    ctx.restore()
  }

  if (o.mode === 'build' && o.stats) drawMassOverlays(ctx, l, o.stats, o.time)
  drawWires(ctx, l, bp, o)
}

function drawMassOverlays(ctx: CanvasRenderingContext2D, l: BlueprintLayout, s: BlueprintStats, time: number) {
  const r = l.cell * 0.28
  if (s.com) {
    const p = cellToPx(l, s.com.x, s.com.y)
    // Classic checkered COM roundel.
    ctx.lineWidth = 1.5
    ctx.strokeStyle = '#ffffff'
    for (let q = 0; q < 4; q++) {
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.arc(p.x, p.y, r, (q * Math.PI) / 2, ((q + 1) * Math.PI) / 2)
      ctx.closePath()
      ctx.fillStyle = q % 2 === 0 ? '#ffd166' : '#0d3a66'
      ctx.fill()
      ctx.stroke()
    }
  }
  if (s.cot) {
    const p = cellToPx(l, s.cot.x, s.cot.y)
    ctx.strokeStyle = '#ff8787'
    ctx.lineWidth = 2
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(p.x, p.y + r)
    ctx.lineTo(p.x, p.y - r * 2.4)
    ctx.moveTo(p.x - r * 0.5, p.y - r * 1.8)
    ctx.lineTo(p.x, p.y - r * 2.4)
    ctx.lineTo(p.x + r * 0.5, p.y - r * 1.8)
    ctx.stroke()
  }
  // Torque arc around the COM when thrust is off-center.
  if (s.com && Math.abs(s.torque) > 150) {
    const p = cellToPx(l, s.com.x, s.com.y)
    const cw = s.torque > 0
    const strength = Math.min(1, Math.abs(s.torque) / 4000)
    const rr = r * 2.2
    const pulse = 0.6 + 0.4 * Math.sin(time * 6)
    ctx.strokeStyle = `rgba(255,107,107,${0.5 + 0.5 * strength * pulse})`
    ctx.lineWidth = 2 + strength * 3
    const a0 = -Math.PI / 2
    const sweep = (0.6 + strength * 1.2) * (cw ? 1 : -1)
    ctx.beginPath()
    ctx.arc(p.x, p.y, rr, a0, a0 + sweep, !cw)
    ctx.stroke()
    const end = a0 + sweep
    const ex = p.x + Math.cos(end) * rr
    const ey = p.y + Math.sin(end) * rr
    const tangent = end + (cw ? Math.PI / 2 : -Math.PI / 2)
    ctx.beginPath()
    ctx.moveTo(ex + Math.cos(tangent) * 8, ey + Math.sin(tangent) * 8)
    ctx.lineTo(ex + Math.cos(tangent + 2.5) * 8, ey + Math.sin(tangent + 2.5) * 8)
    ctx.lineTo(ex + Math.cos(tangent - 2.5) * 8, ey + Math.sin(tangent - 2.5) * 8)
    ctx.closePath()
    ctx.fillStyle = ctx.strokeStyle
    ctx.fill()
  }
}

function drawWires(ctx: CanvasRenderingContext2D, l: BlueprintLayout, bp: Blueprint, o: BlueprintDrawOptions) {
  const wireMode = o.mode === 'wire'
  const byUid = new Map(bp.parts.map((p) => [p.uid, p]))
  // Spread multiple wires landing on the same part so they stay legible.
  const landing = new Map<number, number>()
  for (const w of bp.wires) {
    const target = byUid.get(w.to.uid)
    if (!target) continue
    let from: { x: number; y: number }
    if (w.from.kind === 'button') from = terminalAnchor(l, w.from.id)
    else {
      const src = byUid.get(w.from.uid)
      if (!src) continue
      const c = partCenter(src)
      from = cellToPx(l, c.x + 0.3, c.y - 0.3)
    }
    const tc = partCenter(target)
    const n = landing.get(w.to.uid) ?? 0
    landing.set(w.to.uid, n + 1)
    const to = cellToPx(l, tc.x - 0.25 + n * 0.16, tc.y + 0.25)
    const color = wireColor(w.from)
    ctx.strokeStyle = color
    ctx.globalAlpha = wireMode ? 0.95 : 0.3
    ctx.lineWidth = wireMode ? 2.2 : 1.4
    const sag = Math.min(80, Math.hypot(to.x - from.x, to.y - from.y) * 0.25)
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.bezierCurveTo(from.x, from.y + sag, to.x + sag * 0.4, to.y - sag, to.x, to.y)
    ctx.stroke()
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(to.x, to.y, wireMode ? 4 : 2.5, 0, Math.PI * 2)
    ctx.fill()
    if (wireMode) {
      ctx.font = `600 ${Math.max(8, l.cell * 0.2)}px ui-monospace, monospace`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillStyle = color
      ctx.fillText(INPUT_LABEL[w.to.port], to.x + 5, to.y + 2)
    }
    ctx.globalAlpha = 1
  }
  // Highlight the pending source's parts so it's clear where a wire starts.
  if (wireMode && o.pending?.kind === 'part') {
    const src = byUid.get(o.pending.uid)
    if (src) {
      const c = partCenter(src)
      const p = cellToPx(l, c.x, c.y)
      ctx.strokeStyle = WIRE_COLORS.part
      ctx.lineWidth = 2
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.arc(p.x, p.y, l.cell * 0.55, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }
}
