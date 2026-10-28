// Textures drawn on canvases at load time (no image files): the manor's rug
// and flagstones, the wall bricks, and Blush's portrait for when she hides in
// a wall. Plus the per-tile light map that lanterns and Lantern Snuff write.
import { CanvasTexture, DataTexture, LinearFilter, RGBAFormat, RepeatWrapping, SRGBColorSpace } from 'three'
import { HOUSE, HOUSE_DOOR, WALL, neighbors, tileX, tileY, type Maze } from '../sim/maze'

const PX = 32 // texture pixels per tile

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

function finish(c: HTMLCanvasElement) {
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

// One texture for the whole floor: a worn checker rug down the halls,
// lighter boards in the Ghost House, dark stone under the walls.
export function floorTexture(m: Maze): CanvasTexture {
  const [c, g] = canvas(m.w * PX, m.h * PX)
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      const cell = m.cells[y * m.w + x]
      const px = x * PX
      const py = y * PX
      if (cell === WALL) {
        g.fillStyle = '#17121f'
        g.fillRect(px, py, PX, PX)
        continue
      }
      if (cell === HOUSE || cell === HOUSE_DOOR) {
        g.fillStyle = '#3b2f5c'
        g.fillRect(px, py, PX, PX)
        g.fillStyle = '#463870'
        for (let k = 0; k < 4; k++) g.fillRect(px, py + k * 8, PX, 6)
        continue
      }
      const dark = (x + y) % 2 === 0
      g.fillStyle = dark ? '#3a2449' : '#4a2f58'
      g.fillRect(px, py, PX, PX)
      // A little diamond in the middle of each square.
      g.fillStyle = dark ? '#4c3160' : '#5b3a6b'
      g.beginPath()
      g.moveTo(px + PX / 2, py + 9)
      g.lineTo(px + PX - 9, py + PX / 2)
      g.lineTo(px + PX / 2, py + PX - 9)
      g.lineTo(px + 9, py + PX / 2)
      g.fill()
    }
  }
  // Rug edging along every wall.
  g.strokeStyle = 'rgba(212, 175, 106, 0.35)'
  g.lineWidth = 2
  for (let i = 0; i < m.cells.length; i++) {
    if (m.cells[i] === WALL) continue
    const x = tileX(m, i) * PX
    const y = tileY(m, i) * PX
    for (const n of neighbors(m, i)) {
      if (m.cells[n] !== WALL) continue
      const dx = tileX(m, n) - tileX(m, i)
      const dy = tileY(m, n) - tileY(m, i)
      g.beginPath()
      if (dx) {
        const ex = x + (dx > 0 ? PX - 3 : 3)
        g.moveTo(ex, y)
        g.lineTo(ex, y + PX)
      } else {
        const ey = y + (dy > 0 ? PX - 3 : 3)
        g.moveTo(x, ey)
        g.lineTo(x + PX, ey)
      }
      g.stroke()
    }
  }
  const t = finish(c)
  t.minFilter = LinearFilter
  t.generateMipmaps = false
  return t
}

export function brickTexture(): CanvasTexture {
  const [c, g] = canvas(64, 64)
  g.fillStyle = '#4b4560'
  g.fillRect(0, 0, 64, 64)
  const rows = 4
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? 16 : 0
    for (let k = -1; k < 3; k++) {
      const shade = 70 + ((r * 7 + k * 13) % 5) * 6
      g.fillStyle = `rgb(${shade}, ${shade - 6}, ${shade + 22})`
      g.fillRect(k * 32 + off + 1, r * 16 + 1, 30, 14)
    }
  }
  const t = finish(c)
  t.wrapS = RepeatWrapping
  t.wrapT = RepeatWrapping
  return t
}

// Blush pretending to be a painting.
export function portraitTexture(color: string): CanvasTexture {
  const [c, g] = canvas(96, 128)
  g.fillStyle = '#7c5a2e'
  g.fillRect(0, 0, 96, 128)
  g.fillStyle = '#c9a25a'
  g.fillRect(6, 6, 84, 116)
  g.fillStyle = '#2b2140'
  g.fillRect(12, 12, 72, 104)
  g.fillStyle = color
  g.beginPath()
  g.ellipse(48, 62, 22, 30, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#fff'
  g.beginPath()
  g.arc(40, 56, 6, 0, Math.PI * 2)
  g.arc(56, 56, 6, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#1b1530'
  g.beginPath()
  g.arc(41, 57, 3, 0, Math.PI * 2)
  g.arc(57, 57, 3, 0, Math.PI * 2)
  g.fill()
  return finish(c)
}

// How brightly each tile is lit by its lanterns (0..1), before any snuffing.
export function baseLight(m: Maze, visionMul: number): Float32Array {
  const out = new Float32Array(m.w * m.h)
  const ambient = 0.32 * visionMul
  out.fill(ambient)
  for (const l of m.lanterns) {
    const lx = tileX(m, l)
    const ly = tileY(m, l)
    for (let y = ly - 4; y <= ly + 4; y++) {
      for (let x = lx - 4; x <= lx + 4; x++) {
        if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue
        const d = Math.hypot(x - lx, y - ly)
        if (d > 4) continue
        const i = y * m.w + x
        out[i] = Math.min(1, out[i] + 0.7 * (1 - d / 4) ** 1.4)
      }
    }
  }
  // Walls take the light of the floor beside them, so the faces read right.
  for (let i = 0; i < out.length; i++) {
    if (m.cells[i] !== WALL) continue
    let best = ambient
    for (const n of neighbors(m, i)) if (m.cells[n] !== WALL) best = Math.max(best, out[n])
    out[i] = best
  }
  return out
}

export function lightTexture(m: Maze): DataTexture {
  const data = new Uint8Array(m.w * m.h * 4).fill(255)
  const t = new DataTexture(data, m.w, m.h, RGBAFormat)
  t.magFilter = LinearFilter
  t.minFilter = LinearFilter
  t.needsUpdate = true
  return t
}
