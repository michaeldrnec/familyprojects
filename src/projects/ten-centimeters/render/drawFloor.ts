// Draws the hospital floor from the live shift state. Pure drawing: the
// canvas component (Floor.tsx) owns the loop and the input.
import { ITEM_LABELS } from '../content'
import { HIGH_STRESS, SCRUB_SECONDS } from '../sim/config'
import { BEDS, CHAIRS, DESK, DOORS, FLOOR_H, FLOOR_W, OR_TABLE, ROOMS, SHELVES, SINK, type Rect } from '../sim/floor'
import { orPatient, patientInBay, patientStatus, waitingPatients, type Status } from '../sim/shift'
import type { Patient, ShiftState } from '../sim/types'

export interface View {
  scale: number
  ox: number
  oy: number
}

// Fit the 1000×640 floor inside w×h, centred.
export function fitView(w: number, h: number): View {
  const scale = Math.min(w / FLOOR_W, h / FLOOR_H)
  return { scale, ox: (w - FLOOR_W * scale) / 2, oy: (h - FLOOR_H * scale) / 2 }
}

const FLOOR = {
  hall: '#dbe4ee',
  bay: '#f6e9f2',
  supply: '#fbf0d9',
  sink: '#e0eefa',
  or: '#dcf3ea',
  nurses: '#e8e2d8',
  triage: '#edf0dd',
  wall: '#36435a',
  text: '#36435a',
}

export const STATUS_COLORS: Record<Status, string> = {
  normal: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
  ready: '#14b8a6',
}

const SKIN = ['#f1c7a5', '#d9a07a', '#a86f4c', '#7b4a2e', '#e8b48f', '#c58c63']
const HAIR = ['#3b2414', '#1f1a17', '#8a4b22', '#d9a441', '#5a3a25', '#2b2b2b']

// A patient's skin and hair colors, the same everywhere she's drawn.
export function lookFor(name: string) {
  const h = hash(name)
  return { hair: HAIR[h % HAIR.length], skin: SKIN[(h >> 3) % SKIN.length] }
}

function hash(text: string) {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(h)
}

function roundRect(ctx: CanvasRenderingContext2D, r: Rect, radius: number) {
  ctx.beginPath()
  ctx.roundRect(r.x, r.y, r.w, r.h, radius)
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color = FLOOR.text, align: CanvasTextAlign = 'left') {
  ctx.fillStyle = color
  ctx.font = `700 ${size}px system-ui, sans-serif`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
}

// Glow pulse for alerts; steady when reduced motion is on.
function pulse(time: number, reducedMotion: boolean, speed = 4) {
  return reducedMotion ? 0.8 : 0.55 + 0.45 * Math.sin(time * speed)
}

function drawRooms(ctx: CanvasRenderingContext2D) {
  const fills: [Rect, string][] = [
    [ROOMS.hall, FLOOR.hall],
    [ROOMS.bay0, FLOOR.bay],
    [ROOMS.bay1, FLOOR.bay],
    [ROOMS.bay2, FLOOR.bay],
    [ROOMS.bay3, FLOOR.bay],
    [ROOMS.supply, FLOOR.supply],
    [ROOMS.sink, FLOOR.sink],
    [ROOMS.or, FLOOR.or],
    [ROOMS.nurses, FLOOR.nurses],
    [ROOMS.triage, FLOOR.triage],
  ]
  for (const [r, color] of fills) {
    ctx.fillStyle = color
    ctx.fillRect(r.x, r.y, r.w, r.h)
  }
  // Solid wall above the scrub alcove.
  ctx.fillStyle = FLOOR.wall
  ctx.fillRect(ROOMS.sink.x, 0, ROOMS.sink.w, ROOMS.sink.y)
  // Floor tiles in the hall.
  ctx.strokeStyle = 'rgba(54, 67, 90, 0.07)'
  ctx.lineWidth = 1
  for (let x = 40; x < FLOOR_W; x += 40) {
    ctx.beginPath()
    ctx.moveTo(x, ROOMS.hall.y)
    ctx.lineTo(x, ROOMS.hall.y + ROOMS.hall.h)
    ctx.stroke()
  }

  // Walls: room outlines (triage and the sink alcove are open to the hall),
  // then the doorways cut back out.
  ctx.strokeStyle = FLOOR.wall
  ctx.lineWidth = 8
  ctx.lineJoin = 'round'
  for (const r of [ROOMS.bay0, ROOMS.bay1, ROOMS.supply, ROOMS.or, ROOMS.bay2, ROOMS.bay3, ROOMS.nurses]) ctx.strokeRect(r.x, r.y, r.w, r.h)
  ctx.beginPath()
  ctx.moveTo(ROOMS.sink.x, ROOMS.sink.y)
  ctx.lineTo(ROOMS.sink.x + ROOMS.sink.w, ROOMS.sink.y)
  ctx.moveTo(ROOMS.triage.x + ROOMS.triage.w, ROOMS.triage.y)
  ctx.lineTo(ROOMS.triage.x + ROOMS.triage.w, FLOOR_H)
  ctx.lineTo(ROOMS.triage.x, FLOOR_H)
  ctx.stroke()
  ctx.strokeRect(4, 4, FLOOR_W - 8, FLOOR_H - 8)
  for (const d of DOORS) {
    ctx.fillStyle = FLOOR.hall
    ctx.fillRect(d.x, d.y - 2, d.w, d.h + 4)
  }
  // Triage entrance doors on the right wall.
  ctx.fillStyle = '#93c5fd'
  ctx.fillRect(FLOOR_W - 8, 440, 8, 90)

  label(ctx, 'BAY 1', 14, 18, 15)
  label(ctx, 'BAY 2', 234, 18, 15)
  label(ctx, 'BAY 3', 14, FLOOR_H - 16, 15)
  label(ctx, 'BAY 4', 234, FLOOR_H - 16, 15)
  label(ctx, 'SUPPLY', 520, 108, 15, FLOOR.text, 'center')
  label(ctx, 'OR', 716, 18, 15)
  label(ctx, 'SCRUB', 650, 230, 12, FLOOR.text, 'center')
  label(ctx, 'NURSES', 570, 600, 15, FLOOR.text, 'center')
  label(ctx, 'TRIAGE', 850, 610, 15, FLOOR.text, 'center')
}

function drawFurniture(ctx: CanvasRenderingContext2D) {
  // Supply shelves with colour-coded boxes.
  ctx.fillStyle = '#c8a96a'
  roundRect(ctx, SHELVES, 6)
  ctx.fill()
  const boxes = ['#60a5fa', '#a78bfa', '#f472b6', '#34d399']
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = boxes[i]
    roundRect(ctx, { x: SHELVES.x + 8 + i * 30, y: SHELVES.y + 10, w: 24, h: 22 }, 4)
    ctx.fill()
    roundRect(ctx, { x: SHELVES.x + 8 + i * 30, y: SHELVES.y + 38, w: 24, h: 22 }, 4)
    ctx.fill()
  }
  // Scrub sink.
  ctx.fillStyle = '#f8fafc'
  roundRect(ctx, SINK, 8)
  ctx.fill()
  ctx.strokeStyle = '#94a3b8'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = '#7dd3fc'
  roundRect(ctx, { x: SINK.x + 10, y: SINK.y + 6, w: SINK.w - 20, h: SINK.h - 12 }, 6)
  ctx.fill()
  // OR lamp and table.
  ctx.fillStyle = 'rgba(253, 224, 71, 0.25)'
  ctx.beginPath()
  ctx.arc(OR_TABLE.x + OR_TABLE.w / 2, OR_TABLE.y + OR_TABLE.h / 2, 70, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#94a3b8'
  roundRect(ctx, OR_TABLE, 10)
  ctx.fill()
  ctx.fillStyle = '#5eead4'
  roundRect(ctx, { x: OR_TABLE.x + 6, y: OR_TABLE.y + 6, w: OR_TABLE.w - 12, h: OR_TABLE.h - 12 }, 8)
  ctx.fill()
  // Nurses' desk.
  ctx.fillStyle = '#b7a58a'
  roundRect(ctx, DESK, 10)
  ctx.fill()
  ctx.fillStyle = '#64748b'
  roundRect(ctx, { x: DESK.x + 30, y: DESK.y + 12, w: 40, h: 26 }, 4)
  ctx.fill()
  roundRect(ctx, { x: DESK.x + 130, y: DESK.y + 12, w: 40, h: 26 }, 4)
  ctx.fill()
  // Triage chairs.
  for (const c of CHAIRS) {
    ctx.fillStyle = '#94a3b8'
    roundRect(ctx, { x: c.x - 22, y: c.y - 20, w: 44, h: 40 }, 8)
    ctx.fill()
  }
}

function drawPerson(ctx: CanvasRenderingContext2D, p: Patient, x: number, y: number, r: number) {
  const look = lookFor(p.name)
  ctx.fillStyle = look.hair
  ctx.beginPath()
  ctx.arc(x, y - r * 0.15, r * 1.12, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = look.skin
  ctx.beginPath()
  ctx.arc(x, y + r * 0.1, r * 0.9, 0, Math.PI * 2)
  ctx.fill()
  // A face that reads the mood: a calm smile, or a worried wiggle.
  ctx.strokeStyle = '#3b2414'
  ctx.lineWidth = Math.max(1.5, r * 0.12)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(x - r * 0.32, y, r * 0.08, 0, Math.PI * 2)
  ctx.arc(x + r * 0.32, y, r * 0.08, 0, Math.PI * 2)
  ctx.fillStyle = '#3b2414'
  ctx.fill()
  ctx.beginPath()
  if (p.maternalStress >= HIGH_STRESS) {
    ctx.moveTo(x - r * 0.3, y + r * 0.45)
    ctx.quadraticCurveTo(x, y + r * 0.25, x + r * 0.3, y + r * 0.45)
  } else {
    ctx.arc(x, y + r * 0.25, r * 0.28, 0.15 * Math.PI, 0.85 * Math.PI)
  }
  ctx.stroke()
}

function drawBed(ctx: CanvasRenderingContext2D, bed: Rect, top: boolean, p: Patient | undefined) {
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, bed, 12)
  ctx.fill()
  ctx.strokeStyle = '#94a3b8'
  ctx.lineWidth = 3
  ctx.stroke()
  const pillowY = top ? bed.y + 8 : bed.y + bed.h - 34
  ctx.fillStyle = '#e2e8f0'
  roundRect(ctx, { x: bed.x + 12, y: pillowY, w: bed.w - 24, h: 26 }, 8)
  ctx.fill()
  if (!p) {
    ctx.fillStyle = '#c7d2fe'
    roundRect(ctx, { x: bed.x + 8, y: top ? bed.y + bed.h - 34 : bed.y + 8, w: bed.w - 16, h: 26 }, 6)
    ctx.fill()
    return
  }
  // Blanket with a round bump.
  ctx.fillStyle = '#93c5fd'
  roundRect(ctx, { x: bed.x + 6, y: top ? bed.y + 40 : bed.y + 8, w: bed.w - 12, h: bed.h - 48 }, 10)
  ctx.fill()
  ctx.fillStyle = '#7fb4f5'
  ctx.beginPath()
  ctx.ellipse(bed.x + bed.w / 2, top ? bed.y + 72 : bed.y + bed.h - 72, 24, 20, 0, 0, Math.PI * 2)
  ctx.fill()
  drawPerson(ctx, p, bed.x + bed.w / 2, top ? bed.y + 22 : bed.y + bed.h - 22, 15)
}

// Dilation ring: an arc that fills toward 10 cm.
function drawDilation(ctx: CanvasRenderingContext2D, p: Patient, x: number, y: number, status: Status) {
  ctx.lineWidth = 7
  ctx.strokeStyle = 'rgba(54, 67, 90, 0.15)'
  ctx.beginPath()
  ctx.arc(x, y, 26, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = status === 'ready' ? STATUS_COLORS.ready : '#ec4899'
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(x, y, 26, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * p.dilation) / 10)
  ctx.stroke()
  label(ctx, p.dilation >= 10 ? '10' : p.dilation.toFixed(1), x, y - 2, 18, FLOOR.text, 'center')
  label(ctx, 'cm', x, y + 14, 10, FLOOR.text, 'center')
}

// Mother's stress as a small bar.
function drawStress(ctx: CanvasRenderingContext2D, p: Patient, x: number, y: number) {
  const w = 54
  ctx.fillStyle = 'rgba(54, 67, 90, 0.15)'
  roundRect(ctx, { x: x - w / 2, y, w, h: 8 }, 4)
  ctx.fill()
  ctx.fillStyle = p.maternalStress >= HIGH_STRESS ? '#ef4444' : p.maternalStress >= 50 ? '#f59e0b' : '#22c55e'
  roundRect(ctx, { x: x - w / 2, y, w: Math.max(6, (w * p.maternalStress) / 100), h: 8 }, 4)
  ctx.fill()
}

function badges(p: Patient): string {
  let b = ''
  if (p.distress) b += '💓'
  if (p.preeclampsia) b += '🩺'
  if (p.stalled) b += '⏸️'
  if (p.hasEpidural) b += '💉'
  if (p.hasPitocin) b += '💧'
  if (p.magnesiumTime > 0) b += '🧪'
  if (p.stabilizeTime > 0) b += '😷'
  return b
}

function drawGlow(ctx: CanvasRenderingContext2D, r: Rect, color: string, alpha: number) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.lineWidth = 8
  ctx.strokeRect(r.x + 8, r.y + 8, r.w - 16, r.h - 16)
  ctx.restore()
}

function drawBays(ctx: CanvasRenderingContext2D, s: ShiftState, selected: number | null, time: number, reducedMotion: boolean) {
  for (let i = 0; i < 4; i++) {
    const room = ROOMS[`bay${i}` as 'bay0']
    const top = i < 2
    const p = patientInBay(s, i)
    const bed = BEDS[i]
    if (p) {
      const status = patientStatus(p)
      if (status !== 'normal') drawGlow(ctx, room, STATUS_COLORS[status], status === 'warning' ? 0.6 : pulse(time, reducedMotion))
    }
    if (selected === i) {
      ctx.save()
      ctx.setLineDash([10, 8])
      ctx.strokeStyle = '#6366f1'
      ctx.lineWidth = 3
      ctx.strokeRect(room.x + 18, room.y + 18, room.w - 36, room.h - 36)
      ctx.restore()
    }
    drawBed(ctx, bed, top, p)
    if (!p) {
      label(ctx, 'Empty', bed.x + bed.w + 34, bed.y + bed.h / 2, 13, '#94a3b8', 'center')
      continue
    }
    const cx = bed.x + bed.w + 36
    const cy = top ? bed.y + 30 : bed.y + bed.h - 44
    drawDilation(ctx, p, cx, cy, patientStatus(p))
    drawStress(ctx, p, cx, top ? cy + 36 : cy - 50)
    label(ctx, p.name, bed.x + bed.w / 2, top ? bed.y + bed.h + 8 : bed.y - 10, 14, FLOOR.text, 'center')
    ctx.font = '16px system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(badges(p), room.x + 14, top ? 44 : room.y + 30)
  }
}

function drawOr(ctx: CanvasRenderingContext2D, s: ShiftState, time: number, reducedMotion: boolean) {
  const p = orPatient(s)
  if (!p) return
  drawGlow(ctx, ROOMS.or, STATUS_COLORS.critical, pulse(time, reducedMotion, 6))
  ctx.fillStyle = '#93c5fd'
  roundRect(ctx, { x: OR_TABLE.x + 12, y: OR_TABLE.y + 30, w: OR_TABLE.w - 24, h: OR_TABLE.h - 36 }, 8)
  ctx.fill()
  drawPerson(ctx, p, OR_TABLE.x + OR_TABLE.w / 2, OR_TABLE.y + 22, 13)
  label(ctx, `CODE STORK · ${p.name}`, ROOMS.or.x + ROOMS.or.w / 2, 136, 14, '#b91c1c', 'center')
}

function drawTriage(ctx: CanvasRenderingContext2D, s: ShiftState) {
  const waiting = waitingPatients(s)
  waiting.slice(0, CHAIRS.length).forEach((p, i) => {
    const c = CHAIRS[i]
    drawPerson(ctx, p, c.x, c.y - 4, 13)
    label(ctx, p.name, c.x, c.y + 32, 12, FLOOR.text, 'center')
  })
}

function drawDoctor(ctx: CanvasRenderingContext2D, s: ShiftState, time: number) {
  const d = s.doctor
  // Where the doctor is heading.
  if (d.path.length) {
    ctx.save()
    ctx.setLineDash([6, 8])
    ctx.strokeStyle = 'rgba(13, 148, 136, 0.55)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(d.x, d.y)
    for (const p of d.path) ctx.lineTo(p.x, p.y)
    ctx.stroke()
    ctx.restore()
    const end = d.path[d.path.length - 1]
    ctx.fillStyle = 'rgba(13, 148, 136, 0.4)'
    ctx.beginPath()
    ctx.arc(end.x, end.y, 8, 0, Math.PI * 2)
    ctx.fill()
  }
  // Scrub progress ring.
  if (d.scrubProgress > 0) {
    ctx.strokeStyle = '#0ea5e9'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(d.x, d.y, 24, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * d.scrubProgress) / SCRUB_SECONDS)
    ctx.stroke()
  }
  if (d.isScrubbedIn) {
    ctx.fillStyle = 'rgba(14, 165, 233, 0.25)'
    ctx.beginPath()
    ctx.arc(d.x, d.y, 22 + Math.sin(time * 5) * 2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'
  ctx.beginPath()
  ctx.ellipse(d.x, d.y + 14, 14, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#0d9488'
  ctx.beginPath()
  ctx.arc(d.x, d.y, 15, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.fillStyle = '#5eead4'
  ctx.beginPath()
  ctx.arc(d.x, d.y - 4, 9, Math.PI, 0)
  ctx.fill()
  label(ctx, 'Dr', d.x, d.y + 5, 10, '#ffffff', 'center')
  // What the doctor is carrying.
  d.hands.forEach((item, i) => {
    const x = d.x - 13 + i * 26
    const y = d.y - 30
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(x, y, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = '14px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(ITEM_LABELS[item].icon, x, y + 1)
  })
}

export function drawFloor(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: ShiftState,
  opts: { selected: number | null; time: number; reducedMotion: boolean },
) {
  ctx.fillStyle = '#0b1220'
  ctx.fillRect(0, 0, w, h)
  const v = fitView(w, h)
  ctx.save()
  ctx.translate(v.ox, v.oy)
  ctx.scale(v.scale, v.scale)
  drawRooms(ctx)
  drawFurniture(ctx)
  drawBays(ctx, s, opts.selected, opts.time, opts.reducedMotion)
  drawOr(ctx, s, opts.time, opts.reducedMotion)
  drawTriage(ctx, s)
  drawDoctor(ctx, s, opts.time)
  ctx.restore()
}
