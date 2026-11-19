// Drawing helpers shared by the two mini-games: fitting the 600 × 420 board
// into the canvas, and the swaddled cartoon baby.
import { BOARD_H, BOARD_W, type Pt } from './stork'

export interface BoardView {
  scale: number
  ox: number
  oy: number
}

export function fitBoard(w: number, h: number): BoardView {
  const scale = Math.min(w / BOARD_W, h / BOARD_H)
  return { scale, ox: (w - BOARD_W * scale) / 2, oy: (h - BOARD_H * scale) / 2 }
}

export function toBoard(v: BoardView, x: number, y: number): Pt {
  return { x: (x - v.ox) / v.scale, y: (y - v.oy) / v.scale }
}

export function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, weight = 700) {
  ctx.fillStyle = color
  ctx.font = `${weight} ${size}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(s, x, y)
}

// A swaddled baby: a pastel blanket bundle with a round sleepy face.
export function drawBaby(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, skin: string, opts: { angle?: number; awake?: boolean; blanket?: string } = {}) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(opts.angle ?? 0)
  // Blanket
  ctx.fillStyle = opts.blanket ?? '#fde68a'
  ctx.strokeStyle = 'rgba(120, 80, 20, 0.35)'
  ctx.lineWidth = size * 0.05
  ctx.beginPath()
  ctx.ellipse(0, size * 0.25, size * 0.55, size * 0.75, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // The blanket's fold
  ctx.beginPath()
  ctx.moveTo(-size * 0.5, size * 0.05)
  ctx.quadraticCurveTo(0, size * 0.45, size * 0.5, size * 0.05)
  ctx.stroke()
  // Hood
  ctx.fillStyle = opts.blanket ?? '#fde68a'
  ctx.beginPath()
  ctx.arc(0, -size * 0.28, size * 0.48, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // Face
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.arc(0, -size * 0.25, size * 0.34, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#3b2414'
  ctx.lineCap = 'round'
  ctx.lineWidth = Math.max(1.2, size * 0.05)
  if (opts.awake) {
    // A happy, crying-out-loud open mouth.
    ctx.fillStyle = '#3b2414'
    ctx.beginPath()
    ctx.arc(-size * 0.12, -size * 0.3, size * 0.035, 0, Math.PI * 2)
    ctx.arc(size * 0.12, -size * 0.3, size * 0.035, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#be185d'
    ctx.beginPath()
    ctx.ellipse(0, -size * 0.14, size * 0.08, size * 0.06, 0, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // Sleepy eyes and a tiny smile.
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(side * size * 0.12, -size * 0.3, size * 0.06, 0.15 * Math.PI, 0.85 * Math.PI)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(0, -size * 0.18, size * 0.07, 0.2 * Math.PI, 0.8 * Math.PI)
    ctx.stroke()
  }
  // Rosy cheeks
  ctx.fillStyle = 'rgba(244, 114, 182, 0.35)'
  ctx.beginPath()
  ctx.arc(-size * 0.2, -size * 0.18, size * 0.06, 0, Math.PI * 2)
  ctx.arc(size * 0.2, -size * 0.18, size * 0.06, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
