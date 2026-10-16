// The side-on cross-section of a fortress world: the Warden Platform at the
// top, then the exosphere (fields), the orbital band (PDCs), the
// stratosphere (shield domes) and the surface. One function draws both the
// static planning view and tick-by-tick playback; during playback it takes a
// continuous time `tau` (tick T spans tau in [T-1, T]) and interpolates
// projectiles between the sim's phase timings.
import { fieldName, targetCol } from '../defenses'
import { PHASE_T, type Shot, type SimResult, type Snapshot } from '../sim'
import type { Level, Plan, StructureDef, Target } from '../types'
import { WEAPONS, isBeam, isEffect } from '../weapons'

export interface Layout {
  w: number
  h: number
  margin: number
  colW: number
  colX: (c: number) => number
  platformY: number
  exo: [number, number]
  orbit: [number, number]
  strat: [number, number]
  groundY: number
  size: number // structure size
}

export function layout(level: Level, w: number, h: number): Layout {
  const margin = Math.max(10, w * 0.03)
  const colW = (w - margin * 2) / level.width
  return {
    w,
    h,
    margin,
    colW,
    colX: (c) => margin + colW * (c + 0.5),
    platformY: h * 0.07,
    exo: [h * 0.14, h * 0.25],
    orbit: [h * 0.25, h * 0.4],
    strat: [h * 0.4, h * 0.6],
    groundY: h * 0.82,
    size: Math.max(14, Math.min(colW * 0.5, h * 0.13, 46)),
  }
}

// Status for the planning view: everything up and running.
export function initialSnapshot(level: Level): Snapshot {
  return {
    structs: level.structures.map((s) => ({ alive: true, hp: s.hp ?? 1, disabled: false, powered: true })),
    pdcs: level.pdcs.map(() => ({ alive: true, disabled: false, blind: false, powered: true })),
    shields: level.shields.map((s) => ({ strength: s.strength, up: true, collapsed: false })),
    fieldUp: !!level.field,
    heat: 0,
  }
}

export interface View {
  level: Level
  time: number // wall-clock seconds, for pulsing
  plan?: Plan // planning view: show what's aimed where
  valid?: Set<Target> // targets the selected weapon may aim at
  hover?: Target | null
  selected?: Target | null
  playback?: { result: SimResult; tau: number }
}

// ---------------------------------------------------------------- geometry

function pdcPos(L: Layout, level: Level, id: string) {
  const p = level.pdcs.find((d) => d.id === id)!
  return { x: L.colX(p.col), y: (L.orbit[0] + L.orbit[1]) / 2 }
}

function domeGeom(L: Layout, from: number, to: number) {
  const x0 = L.colX(from) - L.colW / 2 + 3
  const x1 = L.colX(to) + L.colW / 2 - 3
  return { cx: (x0 + x1) / 2, rx: (x1 - x0) / 2, ry: L.groundY - L.strat[0] }
}

// The dome surface height above column x (for shots that stop on it).
function domeY(L: Layout, level: Level, col: number) {
  const s = level.shields.find((d) => col >= d.from && col <= d.to)
  if (!s) return L.groundY
  const g = domeGeom(L, s.from, s.to)
  const dx = (L.colX(col) - g.cx) / g.rx
  return L.groundY - g.ry * Math.sqrt(Math.max(0, 1 - dx * dx))
}

function structTop(L: Layout) {
  return L.groundY - L.size * 1.05
}

function targetPoint(L: Layout, level: Level, t: Target) {
  const col = targetCol(t)
  if (col !== null) return { x: L.colX(col), y: L.groundY - L.size * 0.4 }
  if (t === 'field') return { x: L.w / 2, y: (L.exo[0] + L.exo[1]) / 2 }
  if (level.pdcs.some((p) => p.id === t)) return pdcPos(L, level, t)
  const s = level.shields.find((d) => d.id === t)!
  const g = domeGeom(L, s.from, s.to)
  return { x: g.cx, y: L.groundY - g.ry }
}

// What a click lands on: a PDC, a dome, the field band, or a column.
export function hitTest(level: Level, w: number, h: number, x: number, y: number): { specific: Target | null; col: Target | null } {
  const L = layout(level, w, h)
  const c = Math.floor((x - L.margin) / L.colW)
  const col = c >= 0 && c < level.width ? `c${c}` : null
  let specific: Target | null = null
  if (y >= L.orbit[0] - 6 && y <= L.orbit[1] + 6) {
    for (const p of level.pdcs) {
      if (Math.abs(x - L.colX(p.col)) < L.colW * 0.45) specific = p.id
    }
  } else if (y >= L.exo[0] - 6 && y < L.orbit[0] - 6 && level.field) {
    specific = 'field'
  } else if (y >= L.strat[0] && y < structTop(L) - 4) {
    for (const s of level.shields) {
      const g = domeGeom(L, s.from, s.to)
      const dx = (x - g.cx) / g.rx
      const top = L.groundY - g.ry * Math.sqrt(Math.max(0, 1 - dx * dx))
      if (Math.abs(dx) <= 1 && y >= top - 10) specific = s.id
    }
  }
  return { specific, col }
}

// ---------------------------------------------------------------- helpers

function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

const ARMOR_COLOR = { light: '#94a3b8', medium: '#7dd3fc', hardened: '#fbbf24' }
const KIND_FILL: Record<StructureDef['kind'], string> = {
  core: '#7f1d1d',
  hangar: '#44403c',
  relay: '#334155',
  generator: '#1e3a5f',
  battery: '#4c1d1d',
  site: '#14532d',
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, color: string, size: number) {
  ctx.font = `${size}px ui-monospace, Menlo, monospace`
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  let t = text
  while (t.length > 3 && ctx.measureText(t).width > maxW) t = t.slice(0, -2)
  if (t !== text) t = t.slice(0, -1) + '…'
  ctx.fillText(t, x, y)
}

// ---------------------------------------------------------------- scene

function drawBackdrop(ctx: CanvasRenderingContext2D, L: Layout, level: Level, time: number) {
  const g = ctx.createLinearGradient(0, 0, 0, L.h)
  g.addColorStop(0, '#05060f')
  g.addColorStop(0.3, '#0b1030')
  g.addColorStop(0.62, '#1b1442')
  g.addColorStop(0.82, '#3b1d2e')
  g.addColorStop(1, '#1a0f12')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, L.w, L.h)
  for (let i = 0; i < 70; i++) {
    const x = hash(i) * L.w
    const y = hash(i + 99) * L.h * 0.4
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(time * (0.5 + hash(i + 7)) + i))
    ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.35 * tw * hash(i + 3)})`
    ctx.fillRect(x, y, 1.4, 1.4)
  }
  // Band guides and labels.
  ctx.font = `${Math.max(8, L.h * 0.022)}px ui-monospace, Menlo, monospace`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const bands: [string, number][] = [
    ['EXOSPHERE', L.exo[0]],
    ['ORBIT', L.orbit[0]],
    ['STRATOSPHERE', L.strat[0]],
  ]
  for (const [name, y] of bands) {
    ctx.strokeStyle = 'rgba(165,180,252,0.08)'
    ctx.setLineDash([3, 6])
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(L.w, y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(165,180,252,0.28)'
    ctx.fillText(name, 4, y + 2)
  }
  // Ground.
  ctx.fillStyle = '#2a1414'
  ctx.beginPath()
  ctx.moveTo(0, L.groundY)
  for (let x = 0; x <= L.w; x += 12) ctx.lineTo(x, L.groundY + 3 * Math.sin(x * 0.05) + 2 * hash(x))
  ctx.lineTo(L.w, L.h)
  ctx.lineTo(0, L.h)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#7c2d12'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(0, L.groundY)
  ctx.lineTo(L.w, L.groundY)
  ctx.stroke()
  // Column numbers.
  for (let c = 0; c < level.width; c++) {
    label(ctx, String(c + 1), L.colX(c), L.h - Math.max(7, L.h * 0.03), L.colW, 'rgba(253,186,116,0.45)', Math.max(9, L.h * 0.026))
  }
}

function drawPlatform(ctx: CanvasRenderingContext2D, L: Layout, time: number, hit: number) {
  const x = L.w / 2
  const y = L.platformY
  const s = Math.max(10, L.h * 0.035)
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = '#1e293b'
  ctx.strokeStyle = '#818cf8'
  ctx.lineWidth = 1.5
  // solar wings
  ctx.fillStyle = '#312e81'
  ctx.fillRect(-s * 3.2, -s * 0.35, s * 2, s * 0.7)
  ctx.fillRect(s * 1.2, -s * 0.35, s * 2, s * 0.7)
  ctx.strokeRect(-s * 3.2, -s * 0.35, s * 2, s * 0.7)
  ctx.strokeRect(s * 1.2, -s * 0.35, s * 2, s * 0.7)
  ctx.fillStyle = '#1e293b'
  ctx.beginPath()
  ctx.arc(0, 0, s, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = `rgba(129,140,248,${0.6 + 0.4 * Math.sin(time * 3)})`
  ctx.beginPath()
  ctx.arc(0, s * 0.2, s * 0.35, 0, Math.PI * 2)
  ctx.fill()
  if (hit > 0) {
    ctx.fillStyle = `rgba(248,113,113,${hit})`
    ctx.beginPath()
    ctx.arc(0, 0, s * (2 + 3 * (1 - hit)), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawField(ctx: CanvasRenderingContext2D, L: Layout, level: Level, up: boolean, time: number, hl: number) {
  if (!level.field) return
  const color = level.field.kind === 'magneto' ? '#c084fc' : '#2dd4bf'
  const [y0, y1] = L.exo
  const lines = level.field.kind === 'magneto' ? 4 : 2
  ctx.lineWidth = 1.4
  for (let i = 0; i < lines; i++) {
    const yb = y0 + ((i + 1) / (lines + 1)) * (y1 - y0)
    ctx.strokeStyle = rgba(color, up ? 0.45 + hl * 0.4 : 0.12)
    ctx.setLineDash(up ? [] : [4, 6])
    ctx.beginPath()
    for (let x = 0; x <= L.w; x += 6) {
      const y = yb + 4 * Math.sin(x * 0.03 + time * 2 * level.field.drift + i)
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.setLineDash([])
  const arrow = level.field.drift > 0 ? '→' : '←'
  label(ctx, `${fieldName(level).toUpperCase()} ${up ? `drift ${arrow}` : '· DOWN'}`, L.w - Math.min(110, L.w * 0.22), y0 + 8, L.w * 0.4, rgba(color, up ? 0.9 : 0.4), Math.max(9, L.h * 0.024))
}

function drawShields(ctx: CanvasRenderingContext2D, L: Layout, level: Level, snap: Snapshot, time: number, hl: (t: Target) => number) {
  level.shields.forEach((s, i) => {
    const st = snap.shields[i]
    const g = domeGeom(L, s.from, s.to)
    ctx.beginPath()
    ctx.ellipse(g.cx, L.groundY, g.rx, g.ry, 0, Math.PI, Math.PI * 2)
    const h = hl(s.id)
    if (st.up) {
      const a = 0.18 + 0.12 * st.strength
      const grad = ctx.createLinearGradient(0, L.groundY - g.ry, 0, L.groundY)
      grad.addColorStop(0, `rgba(56,189,248,${0.06 + 0.04 * st.strength})`)
      grad.addColorStop(1, 'rgba(56,189,248,0.02)')
      ctx.fillStyle = grad
      ctx.fill()
      ctx.strokeStyle = `rgba(125,211,252,${Math.min(1, a + 0.15 * Math.sin(time * 2.5) + h * 0.5)})`
      ctx.lineWidth = 1.5 + st.strength * 0.8 + h
      ctx.stroke()
    } else {
      ctx.strokeStyle = st.collapsed && Math.sin(time * 20) > 0 ? 'rgba(103,232,249,0.5)' : `rgba(148,163,184,${0.25 + h * 0.4})`
      ctx.setLineDash([4, 6])
      ctx.lineWidth = 1 + h
      ctx.stroke()
      ctx.setLineDash([])
    }
    const pips = st.strength > 0 ? '▮'.repeat(st.strength) : '✕'
    label(ctx, `${pips}${st.up ? '' : st.collapsed ? ' EMP' : st.strength > 0 ? ' NO PWR' : ''}`, g.cx, L.groundY - g.ry - 8, g.rx * 2, st.up ? '#7dd3fc' : '#94a3b8', Math.max(9, L.h * 0.026))
  })
}

function drawPdcs(ctx: CanvasRenderingContext2D, L: Layout, level: Level, snap: Snapshot, time: number, hl: (t: Target) => number) {
  level.pdcs.forEach((p, i) => {
    const st = snap.pdcs[i]
    const { x, y } = pdcPos(L, level, p.id)
    const r = Math.max(7, Math.min(L.colW * 0.2, 13))
    const live = st.alive && st.powered && !st.disabled
    // Zone bracket.
    const zx0 = L.colX(p.zone[0]) - L.colW / 2 + 4
    const zx1 = L.colX(p.zone[1]) + L.colW / 2 - 4
    const zy = L.orbit[1] - 4
    ctx.strokeStyle = `rgba(248,113,113,${st.alive ? 0.35 + hl(p.id) * 0.4 : 0.1})`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(zx0, zy - 4)
    ctx.lineTo(zx0, zy)
    ctx.lineTo(zx1, zy)
    ctx.lineTo(zx1, zy - 4)
    ctx.stroke()
    if (!st.alive) {
      ctx.strokeStyle = '#64748b'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x - r, y - r)
      ctx.lineTo(x + r, y + r)
      ctx.moveTo(x + r, y - r)
      ctx.lineTo(x - r, y + r)
      ctx.stroke()
      return
    }
    ctx.fillStyle = live ? '#3f1d1d' : '#1f2937'
    ctx.strokeStyle = live ? '#f87171' : '#64748b'
    ctx.lineWidth = (p.armored ? 3 : 1.5) + hl(p.id) * 1.5
    ctx.beginPath()
    if (p.armored) {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + Math.PI / 6
        ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a))
      }
      ctx.closePath()
    } else {
      ctx.arc(x, y, r, 0, Math.PI * 2)
    }
    ctx.fill()
    ctx.stroke()
    // Barrels.
    const barrels = p.barrels ?? 1
    for (let b = 0; b < barrels; b++) {
      const off = (b - (barrels - 1) / 2) * 4
      ctx.beginPath()
      ctx.moveTo(x + off, y + r * 0.6)
      ctx.lineTo(x + off, y + r * 1.6)
      ctx.stroke()
    }
    if (st.blind) {
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = `rgba(226,232,240,${0.25 + 0.1 * Math.sin(time * 3 + k)})`
        ctx.beginPath()
        ctx.arc(x + (hash(k + i * 9) - 0.5) * r * 3, y + (hash(k + 5) - 0.5) * r * 2, r * 0.7, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    if (st.disabled) zap(ctx, x, y, r * 1.4, time)
    label(ctx, p.name, x, L.orbit[0] + 6, L.colW * 2, live ? '#fca5a5' : '#94a3b8', Math.max(8, L.h * 0.022))
  })
}

function zap(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number) {
  ctx.strokeStyle = 'rgba(103,232,249,0.85)'
  ctx.lineWidth = 1.2
  for (let k = 0; k < 3; k++) {
    const a = time * 6 + k * 2.1
    ctx.beginPath()
    ctx.moveTo(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3)
    ctx.lineTo(x + Math.cos(a + 0.5) * r * 0.8, y + Math.sin(a + 0.3) * r * 0.6)
    ctx.lineTo(x + Math.cos(a + 0.2) * r * 1.1, y + Math.sin(a + 0.8) * r * 1.0)
    ctx.stroke()
  }
}

function drawConduits(ctx: CanvasRenderingContext2D, L: Layout, level: Level, snap: Snapshot) {
  const links: { from: number; toX: number; toY: number; on: boolean }[] = []
  const srcIdx = (id: string) => level.structures.findIndex((s) => s.id === id)
  const on = (id: string) => {
    const i = srcIdx(id)
    return i >= 0 && snap.structs[i].alive && !snap.structs[i].disabled
  }
  for (const s of level.structures) if (s.power) links.push({ from: srcIdx(s.power), toX: L.colX(s.col), toY: L.groundY, on: on(s.power) })
  for (const p of level.pdcs) if (p.power) links.push({ from: srcIdx(p.power), toX: L.colX(p.col), toY: (L.orbit[0] + L.orbit[1]) / 2, on: on(p.power) })
  for (const d of level.shields) {
    if (!d.power) continue
    const g = domeGeom(L, d.from, d.to)
    const src = level.structures[srcIdx(d.power)]
    const toX = src && src.col < d.from ? g.cx - g.rx : g.cx + g.rx
    links.push({ from: srcIdx(d.power), toX, toY: L.groundY, on: on(d.power) })
  }
  links.forEach((k, i) => {
    if (k.from < 0) return
    const sx = L.colX(level.structures[k.from].col)
    const depth = L.groundY + 8 + (i % 4) * 5
    ctx.strokeStyle = k.on ? 'rgba(251,191,36,0.55)' : 'rgba(100,116,139,0.35)'
    ctx.lineWidth = 1.5
    ctx.setLineDash(k.on ? [] : [3, 4])
    ctx.beginPath()
    ctx.moveTo(sx, L.groundY)
    ctx.lineTo(sx, depth)
    ctx.lineTo(k.toX, depth)
    ctx.lineTo(k.toX, L.groundY)
    ctx.stroke()
    if (k.toY < L.groundY) {
      ctx.setLineDash([2, 5])
      ctx.beginPath()
      ctx.moveTo(k.toX, L.groundY)
      ctx.lineTo(k.toX, k.toY + 14)
      ctx.stroke()
    }
    ctx.setLineDash([])
  })
}

function drawStructure(ctx: CanvasRenderingContext2D, L: Layout, level: Level, s: StructureDef, i: number, snap: Snapshot, time: number, hl: number, tick: number | null) {
  const st = snap.structs[i]
  const x = L.colX(s.col)
  const gy = L.groundY
  const z = L.size
  if (!st.alive) {
    ctx.fillStyle = '#3f3f46'
    ctx.beginPath()
    ctx.moveTo(x - z * 0.5, gy)
    for (let k = 0; k <= 6; k++) ctx.lineTo(x - z * 0.5 + (k / 6) * z, gy - z * (0.1 + 0.18 * hash(k + i * 7)))
    ctx.lineTo(x + z * 0.5, gy)
    ctx.fill()
    for (let k = 0; k < 3; k++) {
      const p = (time * 0.4 + k / 3) % 1
      ctx.fillStyle = `rgba(120,113,108,${0.3 * (1 - p)})`
      ctx.beginPath()
      ctx.arc(x + Math.sin(k * 3 + time) * 4, gy - z * 0.2 - p * z * 0.9, z * 0.12 + p * z * 0.15, 0, Math.PI * 2)
      ctx.fill()
    }
    label(ctx, s.name, x, gy + z * 0.32, L.colW - 4, '#71717a', Math.max(8, L.h * 0.022))
    return
  }
  const dim = (s.kind === 'battery' && (!st.powered || st.disabled)) ? 0.5 : 1
  ctx.globalAlpha = dim
  ctx.fillStyle = KIND_FILL[s.kind]
  ctx.strokeStyle = s.kind === 'site' ? '#4ade80' : ARMOR_COLOR[s.armor]
  ctx.lineWidth = (s.armor === 'hardened' ? 3 : s.armor === 'medium' ? 2 : 1.2) + hl
  ctx.beginPath()
  switch (s.kind) {
    case 'core': {
      const cy = gy - z * 0.5
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 - Math.PI / 2
        ctx.lineTo(x + z * 0.48 * Math.cos(a), cy + z * 0.48 * Math.sin(a))
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = `rgba(248,113,113,${0.6 + 0.4 * Math.sin(time * 2.5 + i)})`
      ctx.beginPath()
      ctx.arc(x, cy, z * 0.14, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'hangar':
      ctx.rect(x - z * 0.5, gy - z * 0.6, z, z * 0.6)
      ctx.fill()
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x, gy, z * 0.24, Math.PI, Math.PI * 2)
      ctx.fillStyle = '#0c0a09'
      ctx.fill()
      break
    case 'relay':
      ctx.moveTo(x - z * 0.25, gy)
      ctx.lineTo(x, gy - z * 0.95)
      ctx.lineTo(x + z * 0.25, gy)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x, gy - z * 0.95, z * 0.1, 0, Math.PI * 2)
      ctx.fillStyle = '#fbbf24'
      ctx.fill()
      ctx.strokeStyle = 'rgba(251,191,36,0.5)'
      ctx.lineWidth = 1
      for (let k = 1; k <= 2; k++) {
        ctx.beginPath()
        ctx.arc(x, gy - z * 0.95, z * 0.18 * k, -Math.PI * 0.8, -Math.PI * 0.2)
        ctx.stroke()
      }
      break
    case 'generator':
      ctx.rect(x - z * 0.38, gy - z * 0.75, z * 0.76, z * 0.75)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#facc15'
      ctx.beginPath()
      ctx.moveTo(x + z * 0.05, gy - z * 0.68)
      ctx.lineTo(x - z * 0.15, gy - z * 0.35)
      ctx.lineTo(x + z * 0.02, gy - z * 0.35)
      ctx.lineTo(x - z * 0.06, gy - z * 0.08)
      ctx.lineTo(x + z * 0.16, gy - z * 0.45)
      ctx.lineTo(x - z * 0.01, gy - z * 0.45)
      ctx.closePath()
      ctx.fill()
      break
    case 'battery': {
      ctx.moveTo(x - z * 0.45, gy)
      ctx.lineTo(x - z * 0.3, gy - z * 0.35)
      ctx.lineTo(x + z * 0.3, gy - z * 0.35)
      ctx.lineTo(x + z * 0.45, gy)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.lineWidth = Math.max(3, z * 0.14)
      ctx.beginPath()
      ctx.moveTo(x, gy - z * 0.35)
      ctx.lineTo(x + z * 0.12, gy - z * 1.0)
      ctx.stroke()
      const left = tick === null ? s.fireAt! : s.fireAt! - tick
      const msg = left > 0 ? `fires end T${s.fireAt}` : 'FIRING'
      label(ctx, msg, x, gy - z * 1.18, L.colW * 1.1, left <= 1 ? '#f87171' : '#fdba74', Math.max(8, L.h * 0.024))
      break
    }
    case 'site':
      ctx.arc(x, gy, z * 0.42, Math.PI, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#86efac'
      ctx.beginPath()
      ctx.ellipse(x, gy - z * 0.22, z * 0.08, z * 0.16, 0.5, 0, Math.PI * 2)
      ctx.fill()
      if (s.hard) label(ctx, '!', x + z * 0.3, gy - z * 0.45, 20, '#fde047', Math.max(10, z * 0.3))
      break
  }
  ctx.globalAlpha = 1
  if (st.disabled) zap(ctx, x, gy - z * 0.45, z * 0.6, time)
  const hpMax = s.hp ?? 1
  if (hpMax > 1) {
    for (let k = 0; k < hpMax; k++) {
      ctx.fillStyle = k < st.hp ? '#f87171' : '#3f3f46'
      ctx.fillRect(x - hpMax * 4 + k * 8, gy - z * 1.12, 6, 4)
    }
  }
  if (level.objectives.includes(s.id)) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 3)
    ctx.strokeStyle = `rgba(248,113,113,${0.35 + pulse * 0.4})`
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.arc(x, gy - z * 0.5, z * (0.62 + pulse * 0.05), 0, Math.PI * 2)
    ctx.stroke()
  }
  label(ctx, s.name, x, gy + z * 0.32, L.colW - 4, s.kind === 'site' ? '#86efac' : '#fed7aa', Math.max(8, L.h * 0.022))
}

// Planning view: a little icon stack over each planned target.
function drawPlanMarkers(ctx: CanvasRenderingContext2D, L: Layout, level: Level, plan: Plan) {
  const stacks = new Map<Target, number>()
  plan.forEach((a) => {
    const n = stacks.get(a.target) ?? 0
    stacks.set(a.target, n + 1)
    const p = targetPoint(L, level, a.target)
    const col = targetCol(a.target)
    const baseY = col !== null ? L.groundY - L.size * 1.45 - 6 : p.y - 14
    const y = baseY - n * 15
    ctx.strokeStyle = rgba(WEAPONS[a.w].color, 0.18)
    ctx.setLineDash([2, 6])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(L.w / 2, L.platformY)
    ctx.lineTo(p.x, y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.font = '12px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(WEAPONS[a.w].icon, p.x - 6, y)
    label(ctx, `T${a.tick}`, p.x + 11, y, 30, WEAPONS[a.w].color, 9)
  })
}

// ---------------------------------------------------------------- playback

function tauOf(tick: number, phase: keyof typeof PHASE_T) {
  return tick - 1 + PHASE_T[phase]
}

function shotPath(L: Layout, level: Level, s: Shot) {
  const from = { x: L.w / 2, y: L.platformY }
  const aim = targetPoint(L, level, s.target)
  let end = aim
  if (s.fate === 'absorbed' || s.fate === 'blocked') end = { x: aim.x, y: domeY(L, level, s.landCol ?? targetCol(s.target) ?? 0) }
  else if (s.fate === 'refracted') end = { x: aim.x, y: (L.exo[0] + L.exo[1]) / 2 }
  else if (s.fate === 'hit' && s.landCol !== null) end = { x: L.colX(s.landCol), y: aim.y }
  else if (s.fate === 'lost') end = { x: aim.x + (level.field?.drift ?? 1) * L.colW, y: aim.y }
  return { from, aim, end }
}

function pointOn(L: Layout, level: Level, s: Shot, p: number) {
  const { from, aim, end } = shotPath(L, level, s)
  const y = from.y + (end.y - from.y) * p
  // A scrambled missile flies true, then slides sideways near the bottom.
  const slide = Math.max(0, (p - 0.6) / 0.4)
  const x = from.x + (aim.x - from.x) * p + (end.x - aim.x) * slide * slide
  return { x, y }
}

function drawPlayback(ctx: CanvasRenderingContext2D, L: Layout, level: Level, r: SimResult, tau: number, time: number) {
  for (const s of r.shots) {
    if (s.launch === null || s.arrive === null) continue
    const d = WEAPONS[s.w]
    const t0 = tauOf(s.launch, 'launch')
    const tArr = tauOf(s.arrive, isEffect(s.w) ? 'effects' : 'strike')
    const tEnd = s.endTick !== null && s.endPhase ? tauOf(s.endTick, s.endPhase) : tArr
    if (tau < t0) continue
    if (isBeam(s.w)) {
      // Charge glow at the platform, then the beam itself.
      if (tau < tArr) {
        const k = (tau - t0) / Math.max(0.01, tArr - t0)
        ctx.fillStyle = rgba(d.color, 0.3 + 0.5 * k)
        ctx.beginPath()
        ctx.arc(L.w / 2, L.platformY, 4 + 8 * k, 0, Math.PI * 2)
        ctx.fill()
      } else if (tau < tArr + 0.18) {
        const { from, end } = shotPath(L, level, s)
        const a = 1 - (tau - tArr) / 0.18
        ctx.strokeStyle = rgba(d.color, a)
        ctx.lineWidth = s.w === 'resonance' ? 5 : 3
        ctx.beginPath()
        ctx.moveTo(from.x, from.y)
        if (s.w === 'resonance') {
          for (let k = 0; k <= 20; k++) {
            const p = k / 20
            ctx.lineTo(from.x + (end.x - from.x) * p + Math.sin(p * 30 + time * 20) * 4, from.y + (end.y - from.y) * p)
          }
        } else ctx.lineTo(end.x, end.y)
        ctx.stroke()
        burst(ctx, end.x, end.y, (tau - tArr) / 0.18, d.color, 14)
        if (s.fate === 'refracted') {
          ctx.strokeStyle = rgba(d.color, a * 0.6)
          for (let k = -2; k <= 2; k++) {
            ctx.beginPath()
            ctx.moveTo(end.x, end.y)
            ctx.lineTo(end.x + k * 30, end.y - 20 - Math.abs(k) * 6)
            ctx.stroke()
          }
        }
      }
      continue
    }
    if (tau < tEnd) {
      const p = Math.min(1, (tau - t0) / Math.max(0.01, tArr - t0))
      const pos = pointOn(L, level, s, p)
      const prev = pointOn(L, level, s, Math.max(0, p - 0.06))
      ctx.strokeStyle = rgba(d.color, 0.5)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(prev.x, prev.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      ctx.fillStyle = d.color
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, s.w === 'lance' ? 4 : 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.font = '13px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(d.icon, pos.x + 12, pos.y - 2)
    } else if (tau < tEnd + 0.3) {
      const k = (tau - tEnd) / 0.3
      const pEnd = Math.min(1, (tEnd - t0) / Math.max(0.01, tArr - t0))
      const pos = pointOn(L, level, s, pEnd)
      if (s.fate === 'intercepted') {
        const pdc = r.events.find((e) => e.kind === 'intercept' && e.shot === s.i)?.entity
        if (pdc && k < 0.5) {
          const pp = pdcPos(L, level, pdc)
          ctx.strokeStyle = `rgba(254,240,138,${1 - k * 2})`
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(pp.x, pp.y)
          ctx.lineTo(pos.x, pos.y)
          ctx.stroke()
        }
        burst(ctx, pos.x, pos.y, k, '#fde68a', 16)
      } else if (s.w === 'emp' && s.fate !== 'absorbed') {
        ctx.strokeStyle = `rgba(103,232,249,${1 - k})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, 6 + k * L.colW * 0.9, 0, Math.PI * 2)
        ctx.stroke()
      } else if (s.w === 'thermo' && s.fate === 'hit') {
        const cols = level.modifiers?.volatile ? level.width : 3
        burst(ctx, pos.x, pos.y, k, '#fb923c', L.colW * (cols / 2 + 0.2))
      } else {
        burst(ctx, pos.x, pos.y, k, s.fate === 'hit' ? '#fdba74' : '#7dd3fc', s.w === 'lance' ? 26 : 16)
      }
    }
    // Chaff hangs in the orbital band while it blinds.
    if (s.w === 'chaff' && s.fate === 'effect' && tau >= tArr && tau < tArr + 2) {
      const col = s.landCol ?? 0
      const fade = 1 - (tau - tArr) / 2
      for (let k = 0; k < 14; k++) {
        const x = L.colX(col) + (hash(k + s.i * 31) - 0.5) * L.colW * 1.4
        const y = L.orbit[0] + hash(k + 50) * (L.orbit[1] - L.orbit[0])
        ctx.fillStyle = `rgba(241,245,249,${0.55 * fade * (0.5 + 0.5 * Math.sin(time * 9 + k))})`
        ctx.fillRect(x, y, 2, 2)
      }
    }
  }
  // Structures going down, and the battery shot.
  for (const e of r.events) {
    const te = tauOf(e.tick, e.phase)
    if (tau < te || tau > te + 0.45) continue
    const k = (tau - te) / 0.45
    if ((e.kind === 'destroy' || e.kind === 'collateral') && e.entity) {
      const st = level.structures.find((s) => s.id === e.entity)
      const pd = level.pdcs.find((p) => p.id === e.entity)
      const pos = st ? { x: L.colX(st.col), y: L.groundY - L.size * 0.5 } : pd ? pdcPos(L, level, pd.id) : null
      if (pos) burst(ctx, pos.x, pos.y, k, e.kind === 'collateral' ? '#4ade80' : '#f97316', L.size * 1.1)
    }
    if (e.kind === 'battery-fire' && e.entity) {
      const st = level.structures.find((s) => s.id === e.entity)!
      ctx.strokeStyle = `rgba(248,113,113,${1 - k})`
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.moveTo(L.colX(st.col), L.groundY - L.size)
      ctx.lineTo(L.w / 2, L.platformY)
      ctx.stroke()
    }
  }
}

function burst(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, color: string, size: number) {
  if (k < 0 || k > 1) return
  ctx.fillStyle = rgba(color, 0.55 * (1 - k))
  ctx.beginPath()
  ctx.arc(x, y, size * (0.3 + 0.7 * k), 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = rgba('#ffffff', 0.8 * (1 - k))
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + hash(i + x) * 0.5
    ctx.fillRect(x + Math.cos(a) * size * k * 1.1, y + Math.sin(a) * size * k * 1.1, 2, 2)
  }
}

// ---------------------------------------------------------------- entry

export function drawBattlefield(ctx: CanvasRenderingContext2D, w: number, h: number, view: View) {
  const { level, time } = view
  const L = layout(level, w, h)
  let status = initialSnapshot(level)
  let alive = status
  let tick: number | null = null
  let platformHit = 0
  const pb = view.playback
  if (pb) {
    const snaps = pb.result.snapshots
    const end = pb.result.endTick
    const tau = Math.min(pb.tau, end)
    const T = Math.min(end, Math.floor(tau) + 1)
    const t = tau - (T - 1)
    status = t >= PHASE_T.effects ? snaps[T] : snaps[T - 1]
    alive = t >= PHASE_T.strike ? snaps[T] : snaps[T - 1]
    tick = T
    const fire = pb.result.events.find((e) => e.kind === 'battery-fire')
    if (fire) {
      const te = tauOf(fire.tick, 'defense')
      if (pb.tau >= te) platformHit = Math.max(0, 1 - (pb.tau - te) / 0.8)
    }
  }
  // Statuses come from `status`, existence/hp/strength from `alive`.
  const snap: Snapshot = {
    structs: alive.structs.map((s, i) => ({ ...s, disabled: status.structs[i].disabled, powered: status.structs[i].powered })),
    pdcs: alive.pdcs.map((p, i) => ({ ...p, disabled: status.pdcs[i].disabled, blind: status.pdcs[i].blind, powered: status.pdcs[i].powered })),
    shields: alive.shields.map((s, i) => ({ ...s, up: s.strength > 0 && status.shields[i].up, collapsed: status.shields[i].collapsed })),
    fieldUp: status.fieldUp,
    heat: status.heat,
  }
  const hl = (t: Target) => (view.hover === t ? 1 : view.selected === t ? 0.8 : view.valid?.has(t) ? 0.35 : 0)

  drawBackdrop(ctx, L, level, time)
  // Valid column targets get a soft strip.
  for (let c = 0; c < level.width; c++) {
    const k = hl(`c${c}`)
    if (!k) continue
    ctx.fillStyle = `rgba(129,140,248,${0.05 + k * 0.1})`
    ctx.fillRect(L.colX(c) - L.colW / 2 + 1, L.strat[0], L.colW - 2, L.groundY - L.strat[0])
  }
  drawConduits(ctx, L, level, snap)
  drawField(ctx, L, level, snap.fieldUp, time, hl('field'))
  drawShields(ctx, L, level, snap, time, hl)
  drawPdcs(ctx, L, level, snap, time, hl)
  level.structures.forEach((s, i) => drawStructure(ctx, L, level, s, i, snap, time, hl(`c${s.col}`), tick))
  drawPlatform(ctx, L, time, platformHit)
  if (view.plan) drawPlanMarkers(ctx, L, level, view.plan)
  if (pb) drawPlayback(ctx, L, level, pb.result, pb.tau, time)
}
