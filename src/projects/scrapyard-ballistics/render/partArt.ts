// Line-art for every part, shared by the blueprint (white on cyan grid)
// and the flight view (green phosphor wireframe). Each drawer works in the
// part's *unrotated* frame, centred, in metres scaled by `u` px/m; the
// caller rotates the context by the part's quarter turns first.
import type { PartDef, PartId } from '../parts'

export interface ArtStyle {
  stroke: string
  fill: string
  accent: string // warning stripes, flames of paint, rust
  lineWidth: number
}

type Drawer = (ctx: CanvasRenderingContext2D, w: number, h: number, s: ArtStyle) => void

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: ArtStyle, r = 0) {
  ctx.beginPath()
  if (r > 0) ctx.roundRect(x, y, w, h, r)
  else ctx.rect(x, y, w, h)
  ctx.fillStyle = s.fill
  ctx.fill()
  ctx.stroke()
}

function line(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
  ctx.stroke()
}

// Bell nozzle hanging off the bottom edge.
function nozzle(ctx: CanvasRenderingContext2D, cx: number, top: number, width: number, depth: number, s: ArtStyle) {
  ctx.beginPath()
  ctx.moveTo(cx - width * 0.35, top)
  ctx.lineTo(cx + width * 0.35, top)
  ctx.lineTo(cx + width * 0.5, top + depth)
  ctx.lineTo(cx - width * 0.5, top + depth)
  ctx.closePath()
  ctx.fillStyle = s.fill
  ctx.fill()
  ctx.stroke()
}

const DRAW: Record<PartId, Drawer> = {
  lawnChair(ctx, w, h, s) {
    const x0 = -w / 2
    const y0 = -h / 2
    box(ctx, x0 + w * 0.05, y0 + h * 0.05, w * 0.9, h * 0.9, { ...s, fill: 'transparent' }, w * 0.08)
    // chair: back, seat, legs
    line(ctx, [[x0 + w * 0.25, y0 + h * 0.18], [x0 + w * 0.3, y0 + h * 0.6], [x0 + w * 0.78, y0 + h * 0.6]])
    line(ctx, [[x0 + w * 0.3, y0 + h * 0.6], [x0 + w * 0.22, y0 + h * 0.9]])
    line(ctx, [[x0 + w * 0.72, y0 + h * 0.6], [x0 + w * 0.8, y0 + h * 0.9]])
    // pilot
    ctx.beginPath()
    ctx.arc(x0 + w * 0.48, y0 + h * 0.28, w * 0.1, 0, Math.PI * 2)
    ctx.stroke()
    line(ctx, [[x0 + w * 0.46, y0 + h * 0.38], [x0 + w * 0.44, y0 + h * 0.56], [x0 + w * 0.7, y0 + h * 0.56], [x0 + w * 0.74, y0 + h * 0.78]])
    ctx.strokeStyle = s.accent
    line(ctx, [[x0 + w * 0.36, y0 + h * 0.2], [x0 + w * 0.6, y0 + h * 0.2]]) // goggles strap
    ctx.strokeStyle = s.stroke
  },
  bathtub(ctx, w, h, s) {
    ctx.beginPath()
    ctx.moveTo(-w * 0.45, h * 0.35)
    ctx.lineTo(-w * 0.45, -h * 0.05)
    ctx.quadraticCurveTo(-w * 0.45, -h * 0.4, 0, -h * 0.4)
    ctx.quadraticCurveTo(w * 0.45, -h * 0.4, w * 0.45, -h * 0.05)
    ctx.lineTo(w * 0.45, h * 0.35)
    ctx.closePath()
    ctx.fillStyle = s.fill
    ctx.fill()
    ctx.stroke()
    // claw feet on top (it's upside down)
    for (const fx of [-0.28, 0.28]) {
      ctx.beginPath()
      ctx.arc(w * fx, -h * 0.42, w * 0.06, Math.PI, 0)
      ctx.stroke()
    }
    ctx.strokeStyle = s.accent
    line(ctx, [[-w * 0.45, h * 0.35], [w * 0.45, h * 0.35]]) // heat-scarred rim
    ctx.strokeStyle = s.stroke
    ctx.beginPath()
    ctx.arc(0, h * 0.05, w * 0.12, 0, Math.PI * 2) // porthole (drain)
    ctx.stroke()
  },
  mower(ctx, w, h, s) {
    box(ctx, -w * 0.38, -h * 0.45, w * 0.76, h * 0.55, s, w * 0.06)
    line(ctx, [[-w * 0.2, -h * 0.3], [w * 0.2, -h * 0.3]])
    line(ctx, [[-w * 0.2, -h * 0.15], [w * 0.2, -h * 0.15]])
    // pull cord
    ctx.strokeStyle = s.accent
    line(ctx, [[w * 0.38, -h * 0.2], [w * 0.48, -h * 0.28]])
    ctx.strokeStyle = s.stroke
    nozzle(ctx, 0, h * 0.1, w * 0.5, h * 0.38, s)
  },
  sodaKeg(ctx, w, h, s) {
    box(ctx, -w * 0.32, -h * 0.45, w * 0.64, h * 0.7, s, w * 0.14)
    line(ctx, [[-w * 0.32, -h * 0.25], [w * 0.32, -h * 0.25]])
    line(ctx, [[-w * 0.32, h * 0.05], [w * 0.32, h * 0.05]])
    ctx.strokeStyle = s.accent
    ctx.beginPath()
    ctx.arc(0, -h * 0.1, w * 0.08, 0, Math.PI * 2) // bottle-cap logo
    ctx.stroke()
    ctx.strokeStyle = s.stroke
    nozzle(ctx, 0, h * 0.25, w * 0.3, h * 0.22, s)
  },
  firework(ctx, w, h, s) {
    // h is 2 m
    ctx.beginPath()
    ctx.moveTo(0, -h * 0.5)
    ctx.lineTo(w * 0.3, -h * 0.36)
    ctx.lineTo(-w * 0.3, -h * 0.36)
    ctx.closePath()
    ctx.fillStyle = s.fill
    ctx.fill()
    ctx.stroke()
    box(ctx, -w * 0.3, -h * 0.36, w * 0.6, h * 0.74, s)
    ctx.strokeStyle = s.accent
    for (let i = 0; i < 5; i++) {
      const y = -h * 0.3 + i * h * 0.14
      line(ctx, [[-w * 0.3, y], [w * 0.3, y + h * 0.05]])
    }
    ctx.strokeStyle = s.stroke
    nozzle(ctx, 0, h * 0.38, w * 0.44, h * 0.11, s)
  },
  propaneTorch(ctx, w, h, s) {
    box(ctx, -w * 0.4, -h * 0.45, w * 0.8, h * 0.3, s)
    for (const cx of [-0.26, 0, 0.26]) {
      line(ctx, [[w * cx, -h * 0.15], [w * cx, h * 0.05]])
      nozzle(ctx, w * cx, h * 0.05, w * 0.2, h * 0.36, s)
    }
  },
  turbopump(ctx, w, h, s) {
    box(ctx, -w * 0.35, -h * 0.47, w * 0.7, h * 0.28, s, w * 0.05)
    ctx.beginPath()
    ctx.arc(-w * 0.18, -h * 0.1, w * 0.12, 0, Math.PI * 2)
    ctx.fillStyle = s.fill
    ctx.fill()
    ctx.stroke()
    line(ctx, [[-w * 0.06, -h * 0.1], [w * 0.2, -h * 0.1], [w * 0.2, -h * 0.19]])
    nozzle(ctx, 0, -h * 0.05, w * 0.75, h * 0.52, s)
    ctx.strokeStyle = s.accent
    line(ctx, [[-w * 0.3, h * 0.25], [w * 0.3, h * 0.25]])
    ctx.strokeStyle = s.stroke
  },
  gasCan(ctx, w, h, s) {
    ctx.beginPath()
    ctx.moveTo(-w * 0.36, -h * 0.28)
    ctx.lineTo(-w * 0.2, -h * 0.44)
    ctx.lineTo(w * 0.36, -h * 0.44)
    ctx.lineTo(w * 0.36, h * 0.44)
    ctx.lineTo(-w * 0.36, h * 0.44)
    ctx.closePath()
    ctx.fillStyle = s.fill
    ctx.fill()
    ctx.stroke()
    line(ctx, [[-w * 0.2, -h * 0.2], [w * 0.24, h * 0.3]])
    line(ctx, [[w * 0.24, -h * 0.2], [-w * 0.2, h * 0.3]])
    ctx.strokeStyle = s.accent
    line(ctx, [[-w * 0.3, -h * 0.36], [-w * 0.44, -h * 0.46]]) // spout
    ctx.strokeStyle = s.stroke
  },
  propaneTank(ctx, w, h, s) {
    box(ctx, -w * 0.4, -h * 0.44, w * 0.8, h * 0.9, s, w * 0.36)
    line(ctx, [[-w * 0.1, -h * 0.44], [-w * 0.1, -h * 0.5], [w * 0.1, -h * 0.5], [w * 0.1, -h * 0.44]])
    ctx.strokeStyle = s.accent
    line(ctx, [[-w * 0.4, 0], [w * 0.4, 0]])
    ctx.strokeStyle = s.stroke
  },
  rustyPlate(ctx, w, h, s) {
    box(ctx, -w * 0.48, -h * 0.48, w * 0.96, h * 0.96, s)
    for (const [x, y] of [[-0.36, -0.36], [0.36, -0.36], [-0.36, 0.36], [0.36, 0.36]]) {
      ctx.beginPath()
      ctx.arc(w * x, h * y, w * 0.04, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.fillStyle = s.accent
    for (const [x, y, r] of [[-0.1, 0.05, 0.07], [0.18, -0.15, 0.05], [0.05, 0.25, 0.04]]) {
      ctx.beginPath()
      ctx.arc(w * x, h * y, w * r, 0, Math.PI * 2)
      ctx.fill()
    }
  },
  steelScaffold(ctx, w, h, s) {
    box(ctx, -w * 0.48, -h * 0.48, w * 0.96, h * 0.96, { ...s, fill: 'transparent' })
    line(ctx, [[-w * 0.48, -h * 0.48], [w * 0.48, h * 0.48]])
    line(ctx, [[w * 0.48, -h * 0.48], [-w * 0.48, h * 0.48]])
    line(ctx, [[-w * 0.48, 0], [w * 0.48, 0]])
  },
  aluminum(ctx, w, h, s) {
    box(ctx, -w * 0.48, -h * 0.48, w * 0.96, h * 0.96, s)
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const x = -w * 0.36 + i * w * 0.18
      ctx.moveTo(x, -h * 0.48)
      ctx.bezierCurveTo(x + w * 0.06, -h * 0.2, x - w * 0.06, h * 0.2, x, h * 0.48)
    }
    ctx.stroke()
  },
  bolt(ctx, w, h, s) {
    box(ctx, -w * 0.48, -h * 0.3, w * 0.96, h * 0.6, s)
    ctx.save()
    ctx.beginPath()
    ctx.rect(-w * 0.48, -h * 0.3, w * 0.96, h * 0.6)
    ctx.clip()
    ctx.strokeStyle = s.accent
    ctx.lineWidth = s.lineWidth * 2
    for (let i = -3; i <= 3; i++) line(ctx, [[w * (i * 0.2 - 0.2), h * 0.3], [w * (i * 0.2 + 0.2), -h * 0.3]])
    ctx.restore()
    for (const x of [-0.3, 0, 0.3]) {
      ctx.beginPath()
      ctx.arc(w * x, 0, w * 0.06, 0, Math.PI * 2)
      ctx.fillStyle = s.fill
      ctx.fill()
      ctx.stroke()
    }
  },
  chute(ctx, w, h, s) {
    ctx.beginPath()
    ctx.moveTo(-w * 0.3, h * 0.45)
    ctx.lineTo(-w * 0.36, -h * 0.1)
    ctx.quadraticCurveTo(0, -h * 0.55, w * 0.36, -h * 0.1)
    ctx.lineTo(w * 0.3, h * 0.45)
    ctx.closePath()
    ctx.fillStyle = s.fill
    ctx.fill()
    ctx.stroke()
    ctx.strokeStyle = s.accent
    line(ctx, [[-w * 0.2, -h * 0.02], [w * 0.2, -h * 0.02]]) // drawstring
    ctx.strokeStyle = s.stroke
  },
  noseCone(ctx, w, h, s) {
    ctx.beginPath()
    ctx.moveTo(0, -h * 0.48)
    ctx.lineTo(w * 0.4, h * 0.4)
    ctx.lineTo(-w * 0.4, h * 0.4)
    ctx.closePath()
    ctx.fillStyle = s.fill
    ctx.fill()
    ctx.stroke()
    ctx.strokeStyle = s.accent
    ctx.lineWidth = s.lineWidth * 2
    line(ctx, [[-w * 0.16, -h * 0.04], [w * 0.16, -h * 0.04]])
    line(ctx, [[-w * 0.26, h * 0.18], [w * 0.26, h * 0.18]])
    ctx.lineWidth = s.lineWidth
    ctx.strokeStyle = s.stroke
    line(ctx, [[-w * 0.48, h * 0.48], [w * 0.48, h * 0.48]])
  },
  fin(ctx, w, h, s) {
    // hinged on the left face, sweeping right and back
    ctx.beginPath()
    ctx.moveTo(-w * 0.5, -h * 0.4)
    ctx.lineTo(w * 0.1, h * 0.05)
    ctx.lineTo(w * 0.45, h * 0.48)
    ctx.lineTo(-w * 0.5, h * 0.48)
    ctx.closePath()
    ctx.fillStyle = s.fill
    ctx.fill()
    ctx.stroke()
    line(ctx, [[-w * 0.2, -h * 0.15], [-w * 0.2, h * 0.48]])
    line(ctx, [[w * 0.1, h * 0.05], [w * 0.1, h * 0.48]])
    ctx.strokeStyle = s.accent
    line(ctx, [[-w * 0.45, -h * 0.25], [-w * 0.45, h * 0.4]]) // hinge
    ctx.strokeStyle = s.stroke
  },
  gyro(ctx, w, h, s) {
    box(ctx, -w * 0.44, -h * 0.44, w * 0.88, h * 0.88, s, w * 0.06)
    ctx.beginPath()
    ctx.arc(0, h * 0.06, w * 0.28, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = s.accent
    ctx.beginPath()
    ctx.arc(0, h * 0.06, w * 0.16, 0.3, Math.PI * 1.6)
    ctx.stroke()
    ctx.strokeStyle = s.stroke
    line(ctx, [[-w * 0.3, -h * 0.32], [-w * 0.1, -h * 0.32]])
  },
  guidance(ctx, w, h, s) {
    box(ctx, -w * 0.4, -h * 0.35, w * 0.8, h * 0.45, s, w * 0.03)
    line(ctx, [[-w * 0.46, h * 0.18], [w * 0.46, h * 0.18], [w * 0.4, h * 0.3], [-w * 0.4, h * 0.3], [-w * 0.46, h * 0.18]])
    ctx.strokeStyle = s.accent
    line(ctx, [[-w * 0.28, -h * 0.1], [-w * 0.1, -h * 0.2], [w * 0.05, -h * 0.05], [w * 0.28, -h * 0.22]])
    ctx.strokeStyle = s.stroke
  },
  timer(ctx, w, h, s) {
    ctx.beginPath()
    ctx.arc(0, h * 0.05, w * 0.36, 0, Math.PI * 2)
    ctx.fillStyle = s.fill
    ctx.fill()
    ctx.stroke()
    box(ctx, -w * 0.08, -h * 0.44, w * 0.16, h * 0.1, s)
    ctx.strokeStyle = s.accent
    line(ctx, [[0, h * 0.05], [w * 0.18, -h * 0.12]])
    ctx.strokeStyle = s.stroke
  },
  barometer(ctx, w, h, s) {
    ctx.beginPath()
    ctx.arc(0, 0, w * 0.4, 0, Math.PI * 2)
    ctx.fillStyle = s.fill
    ctx.fill()
    ctx.stroke()
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * 0.8 + (i / 6) * Math.PI * 1.4
      line(ctx, [[Math.cos(a) * w * 0.3, Math.sin(a) * w * 0.3], [Math.cos(a) * w * 0.36, Math.sin(a) * w * 0.36]])
    }
    ctx.strokeStyle = s.accent
    line(ctx, [[0, 0], [w * 0.22, -h * 0.14]])
    ctx.strokeStyle = s.stroke
  },
  radioSat(ctx, w, h, s) {
    box(ctx, -w * 0.25, -h * 0.1, w * 0.5, h * 0.5, s)
    ctx.beginPath()
    ctx.arc(0, -h * 0.1, w * 0.3, Math.PI * 1.1, Math.PI * 1.9)
    ctx.stroke()
    line(ctx, [[0, -h * 0.1], [0, -h * 0.46]])
    ctx.strokeStyle = s.accent
    for (const r of [0.08, 0.14]) {
      ctx.beginPath()
      ctx.arc(0, -h * 0.46, w * r, Math.PI * 1.2, Math.PI * 1.8)
      ctx.stroke()
    }
    ctx.strokeStyle = s.stroke
    line(ctx, [[-w * 0.25, h * 0.15], [-w * 0.46, h * 0.15]])
    line(ctx, [[w * 0.25, h * 0.15], [w * 0.46, h * 0.15]])
  },
}

// Draw a part centred at the current origin. `rot` quarter turns clockwise.
export function drawPartArt(ctx: CanvasRenderingContext2D, def: PartDef, rot: number, u: number, style: ArtStyle) {
  ctx.save()
  ctx.rotate((rot * Math.PI) / 2)
  ctx.lineWidth = style.lineWidth
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = style.stroke
  DRAW[def.id](ctx, def.w * u, def.h * u, style)
  ctx.restore()
}

export const BLUEPRINT_STYLE: ArtStyle = {
  stroke: '#e8f6ff',
  fill: 'rgba(20, 60, 110, 0.85)',
  accent: '#ffd166',
  lineWidth: 1.6,
}

export const WIREFRAME_STYLE: ArtStyle = {
  stroke: '#7dffb0',
  fill: 'rgba(6, 26, 16, 0.85)',
  accent: '#ffb347',
  lineWidth: 1.5,
}
