// Canvas drawing for the cave. The scene is drawn in three layers:
//   1. tile art, only for tiles with any light at all (the rest stay #000)
//   2. a darkness mask: one pixel per tile holding (1 - brightness), drawn
//      scaled up with smoothing on, so light falls off softly across tiles
//   3. things that glow on their own (exit, spare cells, moss, glow-worms),
//      echo outlines and the player, drawn on top of the darkness
import { isToggledOn, tileAt, type Grid, type Point } from './tiles'

export const VIEW_W = 640
export const VIEW_H = 480

export interface Layout {
  size: number // tile size in px
  ox: number // offset of tile (0,0) in px
  oy: number
}

export function layoutFor(grid: Grid): Layout {
  const size = Math.floor(Math.min(VIEW_W / grid.w, VIEW_H / grid.h, 56))
  return { size, ox: Math.floor((VIEW_W - grid.w * size) / 2), oy: Math.floor((VIEW_H - grid.h * size) / 2) }
}

export interface SceneState {
  haveKey: boolean
  flipped: boolean
  cellsTaken: number[]
  keysTaken: number[]
}

function hash(x: number, y: number, n = 0): number {
  let h = (x * 73856093) ^ (y * 19349663) ^ (n * 83492791)
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function drawFloor(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, gx: number, gy: number) {
  ctx.fillStyle = '#5b4f44'
  ctx.fillRect(x, y, s, s)
  ctx.fillStyle = '#4c4239'
  for (let k = 0; k < 4; k++) {
    const px = hash(gx, gy, k) * s
    const py = hash(gx, gy, k + 9) * s
    ctx.fillRect(x + px, y + py, s * 0.12, s * 0.06)
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1)
}

function drawWall(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, gx: number, gy: number) {
  ctx.fillStyle = '#2b2520'
  ctx.fillRect(x, y, s, s)
  ctx.fillStyle = '#3a322b'
  for (let k = 0; k < 3; k++) {
    const r = s * (0.12 + hash(gx, gy, k + 3) * 0.12)
    ctx.beginPath()
    ctx.arc(x + hash(gx, gy, k) * s, y + hash(gx, gy, k + 5) * s, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawChasm(ctx: CanvasRenderingContext2D, grid: Grid, x: number, y: number, s: number, gx: number, gy: number) {
  const g = ctx.createRadialGradient(x + s / 2, y + s / 2, 1, x + s / 2, y + s / 2, s * 0.75)
  g.addColorStop(0, '#020103')
  g.addColorStop(1, '#1a1426')
  ctx.fillStyle = g
  ctx.fillRect(x, y, s, s)
  // a crumbling rim wherever the chasm meets solid ground
  ctx.strokeStyle = '#8a7a6a'
  ctx.lineWidth = Math.max(2, s * 0.07)
  const edge = (nx: number, ny: number) => {
    const t = tileAt(grid, nx, ny)
    return t !== 'chasm' && t !== 'bridge' && t !== 'wall'
  }
  ctx.beginPath()
  if (edge(gx, gy - 1)) {
    ctx.moveTo(x, y + 1)
    ctx.lineTo(x + s, y + 1)
  }
  if (edge(gx, gy + 1)) {
    ctx.moveTo(x, y + s - 1)
    ctx.lineTo(x + s, y + s - 1)
  }
  if (edge(gx - 1, gy)) {
    ctx.moveTo(x + 1, y)
    ctx.lineTo(x + 1, y + s)
  }
  if (edge(gx + 1, gy)) {
    ctx.moveTo(x + s - 1, y)
    ctx.lineTo(x + s - 1, y + s)
  }
  ctx.stroke()
}

function drawPlanks(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = '#05040a'
  ctx.fillRect(x, y, s, s)
  ctx.fillStyle = '#8b6440'
  ctx.fillRect(x + s * 0.1, y, s * 0.8, s)
  ctx.strokeStyle = '#5c3f24'
  ctx.lineWidth = 1.5
  for (let k = 1; k < 4; k++) {
    ctx.beginPath()
    ctx.moveTo(x + s * 0.1, y + (k * s) / 4)
    ctx.lineTo(x + s * 0.9, y + (k * s) / 4)
    ctx.stroke()
  }
}

function drawWater(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, gx: number, t: number) {
  ctx.fillStyle = '#1d3a52'
  ctx.fillRect(x, y, s, s)
  ctx.strokeStyle = 'rgba(147,197,253,0.45)'
  ctx.lineWidth = 1.2
  for (let k = 0; k < 2; k++) {
    const yy = y + s * (0.35 + k * 0.35)
    ctx.beginPath()
    for (let i = 0; i <= 8; i++) {
      const xx = x + (i / 8) * s
      const w = Math.sin(t * 2 + gx + i * 0.9 + k) * s * 0.04
      if (i === 0) ctx.moveTo(xx, yy + w)
      else ctx.lineTo(xx, yy + w)
    }
    ctx.stroke()
  }
}

function drawMirror(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, forward: boolean) {
  ctx.fillStyle = '#2b2520'
  ctx.fillRect(x, y, s, s)
  ctx.save()
  ctx.strokeStyle = '#d6f0ff'
  ctx.shadowColor = '#7dd3fc'
  ctx.shadowBlur = 10
  ctx.lineWidth = s * 0.16
  ctx.lineCap = 'round'
  ctx.beginPath()
  if (forward) {
    ctx.moveTo(x + s * 0.15, y + s * 0.85)
    ctx.lineTo(x + s * 0.85, y + s * 0.15)
  } else {
    ctx.moveTo(x + s * 0.15, y + s * 0.15)
    ctx.lineTo(x + s * 0.85, y + s * 0.85)
  }
  ctx.stroke()
  ctx.restore()
}

function drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, open: boolean, gx: number, gy: number) {
  drawFloor(ctx, x, y, s, gx, gy)
  ctx.fillStyle = '#3d2716'
  if (open) {
    ctx.fillRect(x, y, s * 0.14, s)
    ctx.fillRect(x + s * 0.86, y, s * 0.14, s)
    return
  }
  ctx.fillStyle = '#6b4423'
  ctx.fillRect(x + 2, y + 2, s - 4, s - 4)
  ctx.fillStyle = '#3f3f46'
  ctx.fillRect(x + 2, y + s * 0.22, s - 4, s * 0.08)
  ctx.fillRect(x + 2, y + s * 0.7, s - 4, s * 0.08)
  ctx.fillStyle = '#fbbf24'
  ctx.beginPath()
  ctx.arc(x + s / 2, y + s * 0.47, s * 0.08, 0, Math.PI * 2)
  ctx.fill()
}

function drawGate(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, open: boolean, gx: number, gy: number) {
  drawFloor(ctx, x, y, s, gx, gy)
  ctx.fillStyle = '#9ca3af'
  if (open) {
    ctx.fillRect(x, y + s * 0.1, s * 0.1, s * 0.8)
    ctx.fillRect(x + s * 0.9, y + s * 0.1, s * 0.1, s * 0.8)
    return
  }
  for (let k = 0; k < 5; k++) ctx.fillRect(x + s * (0.08 + k * 0.2), y, s * 0.07, s)
  ctx.fillRect(x, y + s * 0.15, s, s * 0.07)
  ctx.fillRect(x, y + s * 0.78, s, s * 0.07)
}

function drawPlate(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, gx: number, gy: number, flipped: boolean) {
  drawFloor(ctx, x, y, s, gx, gy)
  ctx.fillStyle = '#6b6258'
  ctx.strokeStyle = flipped ? '#fcd34d' : '#a8a29e'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(x + s * 0.18, y + s * 0.18, s * 0.64, s * 0.64, s * 0.08)
  ctx.fill()
  ctx.stroke()
}

function drawKey(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.strokeStyle = '#fbbf24'
  ctx.fillStyle = '#fbbf24'
  ctx.lineWidth = s * 0.08
  ctx.beginPath()
  ctx.arc(x + s * 0.35, y + s * 0.5, s * 0.13, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillRect(x + s * 0.46, y + s * 0.47, s * 0.34, s * 0.07)
  ctx.fillRect(x + s * 0.7, y + s * 0.5, s * 0.06, s * 0.13)
}

// Layer 1: tile art for every tile with any brightness.
export function drawTiles(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  layout: Layout,
  bright: Float32Array,
  scene: SceneState,
  t: number,
) {
  const { size: s, ox, oy } = layout
  for (let gy = 0; gy < grid.h; gy++) {
    for (let gx = 0; gx < grid.w; gx++) {
      const i = gy * grid.w + gx
      if (bright[i] <= 0.01) continue
      const x = ox + gx * s
      const y = oy + gy * s
      switch (grid.tiles[i]) {
        case 'wall':
          drawWall(ctx, x, y, s, gx, gy)
          break
        case 'chasm':
          drawChasm(ctx, grid, x, y, s, gx, gy)
          break
        case 'plank':
          drawPlanks(ctx, x, y, s)
          break
        case 'bridge':
          if (isToggledOn(grid, i, scene.flipped)) drawPlanks(ctx, x, y, s)
          else drawChasm(ctx, grid, x, y, s, gx, gy)
          break
        case 'water':
          drawWater(ctx, x, y, s, gx, t)
          break
        case 'mirrorF':
        case 'mirrorB':
          drawMirror(ctx, x, y, s, grid.tiles[i] === 'mirrorF')
          break
        case 'door':
          drawDoor(ctx, x, y, s, scene.haveKey, gx, gy)
          break
        case 'gate':
          drawGate(ctx, x, y, s, isToggledOn(grid, i, scene.flipped), gx, gy)
          break
        case 'plate':
          drawPlate(ctx, x, y, s, gx, gy, scene.flipped)
          break
        default:
          drawFloor(ctx, x, y, s, gx, gy)
      }
      if (grid.keys.includes(i) && !scene.keysTaken.includes(i)) drawKey(ctx, x, y, s)
    }
  }
}

// Layer 2: the darkness mask.
export function drawDarkness(ctx: CanvasRenderingContext2D, grid: Grid, layout: Layout, bright: Float32Array, mask: HTMLCanvasElement) {
  if (mask.width !== grid.w || mask.height !== grid.h) {
    mask.width = grid.w
    mask.height = grid.h
  }
  const mctx = mask.getContext('2d')!
  const img = mctx.createImageData(grid.w, grid.h)
  for (let i = 0; i < bright.length; i++) img.data[i * 4 + 3] = Math.round(255 * (1 - Math.min(1, bright[i])))
  mctx.putImageData(img, 0, 0)
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(mask, layout.ox, layout.oy, grid.w * layout.size, grid.h * layout.size)
  ctx.restore()
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, color.replace('ALPHA', String(alpha)))
  g.addColorStop(1, color.replace('ALPHA', '0'))
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

// Layer 3: things that glow on their own, visible even in the dark.
export function drawEmissives(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  layout: Layout,
  scene: SceneState,
  mossSeen: Set<number>,
  critters: Point[],
  t: number,
) {
  const { size: s, ox, oy } = layout
  const center = (i: number) => ({ x: ox + ((i % grid.w) + 0.5) * s, y: oy + (Math.floor(i / grid.w) + 0.5) * s })

  // exit: a slowly pulsing amber ring
  const ex = ox + (grid.exit.x + 0.5) * s
  const ey = oy + (grid.exit.y + 0.5) * s
  const pulse = 0.5 + 0.5 * Math.sin(t * 2)
  glow(ctx, ex, ey, s * 0.9, 'rgba(252,211,77,ALPHA)', 0.25 + 0.15 * pulse)
  ctx.strokeStyle = `rgba(252,211,77,${0.55 + 0.3 * pulse})`
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(ex, ey, s * 0.3, 0, Math.PI * 2)
  ctx.stroke()

  // spare cells: a faint lure
  for (const i of grid.cells) {
    if (scene.cellsTaken.includes(i)) continue
    const c = center(i)
    glow(ctx, c.x, c.y, s * 0.7, 'rgba(250,204,21,ALPHA)', 0.3)
    ctx.fillStyle = '#facc15'
    ctx.fillRect(c.x - s * 0.12, c.y - s * 0.2, s * 0.24, s * 0.4)
    ctx.fillRect(c.x - s * 0.05, c.y - s * 0.26, s * 0.1, s * 0.07)
    ctx.fillStyle = '#422006'
    ctx.fillRect(c.x - s * 0.07, c.y - s * 0.02, s * 0.14, s * 0.05)
  }

  // moss you've lit keeps glowing
  for (const i of mossSeen) {
    const c = center(i)
    glow(ctx, c.x, c.y, s * 0.75, 'rgba(74,222,128,ALPHA)', 0.35)
    ctx.fillStyle = '#86efac'
    for (let k = 0; k < 6; k++) {
      const gx = i % grid.w
      const gy = Math.floor(i / grid.w)
      ctx.fillRect(c.x + (hash(gx, gy, k) - 0.5) * s * 0.7, c.y + (hash(gx, gy, k + 7) - 0.5) * s * 0.7, 2.5, 2.5)
    }
  }

  // glow-worms
  for (const c of critters) {
    const cx = ox + (c.x + 0.5) * s
    const cy = oy + (c.y + 0.5) * s
    glow(ctx, cx, cy, s * 1.2, 'rgba(125,211,252,ALPHA)', 0.35)
    ctx.fillStyle = '#bae6fd'
    for (let k = 0; k < 4; k++) {
      ctx.beginPath()
      ctx.arc(cx + Math.sin(t * 6 + k) * s * 0.06 - k * s * 0.08 + s * 0.12, cy + Math.cos(t * 5 + k) * s * 0.05, s * (0.09 - k * 0.012), 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

// Echo: cyan outlines along every wall face within the pulse's radius.
export function drawEcho(ctx: CanvasRenderingContext2D, grid: Grid, layout: Layout, from: Point, age: number, duration: number) {
  const { size: s, ox, oy } = layout
  const radius = 2 + age * 18
  const alpha = Math.max(0, 1 - age / duration)
  ctx.save()
  ctx.strokeStyle = `rgba(103,232,249,${alpha})`
  ctx.shadowColor = '#22d3ee'
  ctx.shadowBlur = 8
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let gy = 0; gy < grid.h; gy++) {
    for (let gx = 0; gx < grid.w; gx++) {
      if (tileAt(grid, gx, gy) !== 'wall') continue
      if (Math.hypot(gx - from.x, gy - from.y) > radius) continue
      const x = ox + gx * s
      const y = oy + gy * s
      const open = (nx: number, ny: number) => nx >= 0 && ny >= 0 && nx < grid.w && ny < grid.h && tileAt(grid, nx, ny) !== 'wall'
      if (open(gx, gy - 1)) {
        ctx.moveTo(x, y)
        ctx.lineTo(x + s, y)
      }
      if (open(gx, gy + 1)) {
        ctx.moveTo(x, y + s)
        ctx.lineTo(x + s, y + s)
      }
      if (open(gx - 1, gy)) {
        ctx.moveTo(x, y)
        ctx.lineTo(x, y + s)
      }
      if (open(gx + 1, gy)) {
        ctx.moveTo(x + s, y)
        ctx.lineTo(x + s, y + s)
      }
    }
  }
  ctx.stroke()
  // the expanding ring itself
  ctx.strokeStyle = `rgba(103,232,249,${alpha * 0.4})`
  ctx.beginPath()
  ctx.arc(ox + (from.x + 0.5) * s, oy + (from.y + 0.5) * s, radius * s, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

// The explorer: a round helmet with a headlamp pointing along the beam.
export function drawPlayer(ctx: CanvasRenderingContext2D, layout: Layout, x: number, y: number, angle: number, lit: boolean) {
  const { size: s, ox, oy } = layout
  const cx = ox + (x + 0.5) * s
  const cy = oy + (y + 0.5) * s
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(angle)
  ctx.fillStyle = '#d6d3d1'
  ctx.beginPath()
  ctx.arc(0, 0, s * 0.28, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#57534e'
  ctx.beginPath()
  ctx.arc(-s * 0.04, 0, s * 0.18, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = lit ? '#fef3c7' : '#57534e'
  if (lit) {
    ctx.shadowColor = '#fde68a'
    ctx.shadowBlur = 12
  }
  ctx.fillRect(s * 0.2, -s * 0.08, s * 0.12, s * 0.16)
  ctx.restore()
}
