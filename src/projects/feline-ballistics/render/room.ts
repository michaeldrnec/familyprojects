// Room backdrops (SPEC.md section 7): a moonlit window and light cone,
// a wallpaper pattern per room, baseboard, wooden floor, and the cat tree
// at the perch. Drawn in world coordinates every frame (a few hundred
// canvas ops -- cheaper than managing an offscreen cache per zoom level).
import type { LevelDef, RoomId } from '../levels/types'
import { floorY } from '../levels/types'

export interface RoomTheme {
  wall: string
  wallDeep: string
  pattern: 'stripes' | 'dots' | 'diamonds' | 'flowers'
  patternColor: string
  floor: string
  floorLine: string
  accent: string
  name: string
}

export const ROOM_THEMES: Record<RoomId, RoomTheme> = {
  kitchen: { name: 'Kitchen', wall: '#24345a', wallDeep: '#16213d', pattern: 'diamonds', patternColor: 'rgba(160,190,255,0.07)', floor: '#3b3350', floorLine: '#2a2440', accent: '#ffd27a' },
  living: { name: 'Living Room', wall: '#2c2b55', wallDeep: '#1a1938', pattern: 'stripes', patternColor: 'rgba(190,170,255,0.06)', floor: '#4a3426', floorLine: '#35251b', accent: '#ffc27a' },
  office: { name: 'Home Office', wall: '#1f3a4a', wallDeep: '#12242f', pattern: 'dots', patternColor: 'rgba(150,230,255,0.07)', floor: '#3a3a44', floorLine: '#2a2a33', accent: '#8fe3ff' },
  bedroom: { name: 'Bedroom', wall: '#3a2a52', wallDeep: '#221833', pattern: 'flowers', patternColor: 'rgba(255,190,230,0.07)', floor: '#4b3a33', floorLine: '#352823', accent: '#ffb6d9' },
}

export function drawRoom(ctx: CanvasRenderingContext2D, level: LevelDef, time: number) {
  const theme = ROOM_THEMES[level.room]
  const W = level.width
  const fy = floorY(level)
  const top = -4000 // tall enough that portrait phones never see past the wall
  // Wall
  const g = ctx.createLinearGradient(0, top, 0, fy)
  g.addColorStop(0, theme.wallDeep)
  g.addColorStop(1, theme.wall)
  ctx.fillStyle = g
  ctx.fillRect(-400, top, W + 800, fy - top)
  drawPattern(ctx, theme, W, top, fy)

  // Window with moon + cone of moonlight falling to the floor.
  const wx = W * 0.62
  const wy = fy - 560
  const ww = 190
  const wh = 230
  ctx.fillStyle = '#0b1230'
  ctx.fillRect(wx - ww / 2, wy - wh / 2, ww, wh)
  ctx.fillStyle = '#f6f1d0'
  ctx.beginPath()
  ctx.arc(wx + 40, wy - 45, 26, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#0b1230'
  ctx.beginPath()
  ctx.arc(wx + 52, wy - 52, 22, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  for (let i = 0; i < 9; i++) {
    const sx = wx - ww / 2 + ((i * 53) % ww)
    const sy = wy - wh / 2 + ((i * 37) % wh)
    const tw = 0.5 + 0.5 * Math.sin(time * 2 + i)
    ctx.globalAlpha = 0.3 + 0.5 * tw
    ctx.fillRect(sx, sy, 2, 2)
  }
  ctx.globalAlpha = 1
  ctx.strokeStyle = '#6a5a8c'
  ctx.lineWidth = 8
  ctx.strokeRect(wx - ww / 2, wy - wh / 2, ww, wh)
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(wx, wy - wh / 2)
  ctx.lineTo(wx, wy + wh / 2)
  ctx.moveTo(wx - ww / 2, wy)
  ctx.lineTo(wx + ww / 2, wy)
  ctx.stroke()
  const cone = ctx.createLinearGradient(0, wy, 0, fy)
  cone.addColorStop(0, 'rgba(210,225,255,0.10)')
  cone.addColorStop(1, 'rgba(210,225,255,0.02)')
  ctx.fillStyle = cone
  ctx.beginPath()
  ctx.moveTo(wx - ww / 2, wy + wh / 2)
  ctx.lineTo(wx + ww / 2, wy + wh / 2)
  ctx.lineTo(wx + ww / 2 - 160, fy)
  ctx.lineTo(wx - ww / 2 - 260, fy)
  ctx.closePath()
  ctx.fill()

  // Floor + baseboard
  ctx.fillStyle = theme.floor
  ctx.fillRect(-400, fy, W + 800, 400)
  ctx.strokeStyle = theme.floorLine
  ctx.lineWidth = 2
  for (let x = -400; x < W + 400; x += 120) {
    ctx.beginPath()
    ctx.moveTo(x, fy)
    ctx.lineTo(x - 40, fy + 400)
    ctx.stroke()
  }
  ctx.fillStyle = '#e8e0f5'
  ctx.globalAlpha = 0.14
  ctx.fillRect(-400, fy - 16, W + 800, 16)
  ctx.globalAlpha = 1

  drawCatTree(ctx, level)
}

function drawPattern(ctx: CanvasRenderingContext2D, theme: RoomTheme, W: number, top: number, fy: number) {
  ctx.fillStyle = theme.patternColor
  ctx.strokeStyle = theme.patternColor
  ctx.lineWidth = 3
  if (theme.pattern === 'stripes') {
    for (let x = -400; x < W + 400; x += 70) ctx.fillRect(x, top, 24, fy - top)
  } else if (theme.pattern === 'dots') {
    for (let y = top; y < fy; y += 60) for (let x = -400 + ((y / 60) % 2) * 30; x < W + 400; x += 60) {
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (theme.pattern === 'diamonds') {
    for (let y = top; y < fy; y += 80) for (let x = -400; x < W + 400; x += 80) {
      ctx.beginPath()
      ctx.moveTo(x, y - 20)
      ctx.lineTo(x + 20, y)
      ctx.lineTo(x, y + 20)
      ctx.lineTo(x - 20, y)
      ctx.closePath()
      ctx.stroke()
    }
  } else {
    for (let y = top; y < fy; y += 110) for (let x = -400 + ((y / 110) % 2) * 55; x < W + 400; x += 110) {
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2
        ctx.beginPath()
        ctx.arc(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 6, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}

// The cat tree the lineup launches from.
function drawCatTree(ctx: CanvasRenderingContext2D, level: LevelDef) {
  const fy = floorY(level)
  const { x, y } = level.perch
  const base = y + 34
  ctx.fillStyle = '#b89a78'
  ctx.strokeStyle = '#6e5840'
  ctx.lineWidth = 3
  // sisal post
  ctx.fillRect(x - 14, base, 28, fy - base)
  ctx.strokeRect(x - 14, base, 28, fy - base)
  ctx.strokeStyle = 'rgba(110,88,64,0.6)'
  for (let yy = base + 8; yy < fy; yy += 9) {
    ctx.beginPath()
    ctx.moveTo(x - 14, yy)
    ctx.lineTo(x + 14, yy + 4)
    ctx.stroke()
  }
  // platform + base
  ctx.fillStyle = '#8c6fb3'
  ctx.strokeStyle = '#5a4580'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.roundRect(x - 56, base - 4, 112, 16, 6)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.roundRect(x - 70, fy - 18, 140, 18, 6)
  ctx.fill()
  ctx.stroke()
}
