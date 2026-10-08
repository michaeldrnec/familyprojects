// Flashlight lighting: rays fanned across the beam cone march through the
// grid in small steps. Walls (and closed doors/gates) catch a ray and are
// lit themselves; mirrors bounce it 90 degrees. Each tile ends up with a
// brightness from 0 to 1 that falls off with distance and toward the
// cone's edges. Critters add a small glow of their own.
import { blocksLight, tileAt, type Grid, type Point } from './tiles'

export const CONE_HALF_ANGLE = (35 * Math.PI) / 180
const RAY_COUNT = 120
const RAY_STEP = 0.08
const FOOT_GLOW = 0.45

export interface LightInput {
  grid: Grid
  x: number // player position in tiles (may be fractional mid-slide)
  y: number
  angle: number
  reach: number
  haveKey: boolean
  flipped: boolean
  critters: Point[] // fractional tile positions
}

function brighten(out: Float32Array, grid: Grid, x: number, y: number, v: number) {
  if (x < 0 || y < 0 || x >= grid.w || y >= grid.h) return
  const i = y * grid.w + x
  if (v > out[i]) out[i] = v
}

export function computeLight(input: LightInput, out: Float32Array): Float32Array {
  const { grid, reach, haveKey, flipped } = input
  out.fill(0)
  const px = Math.round(input.x)
  const py = Math.round(input.y)
  brighten(out, grid, px, py, FOOT_GLOW)

  if (reach > 0) {
    for (let r = 0; r < RAY_COUNT; r++) {
      const off = -CONE_HALF_ANGLE + (2 * CONE_HALF_ANGLE * r) / (RAY_COUNT - 1)
      const edge = 1 - 0.55 * (off / CONE_HALF_ANGLE) ** 2
      let dx = Math.cos(input.angle + off)
      let dy = Math.sin(input.angle + off)
      let fx = input.x + 0.5
      let fy = input.y + 0.5
      let lastMirror = -1
      for (let d = 0; d < reach; d += RAY_STEP) {
        fx += dx * RAY_STEP
        fy += dy * RAY_STEP
        const tx = Math.floor(fx)
        const ty = Math.floor(fy)
        const falloff = 1 - 0.75 * (d / reach) ** 1.5
        brighten(out, grid, tx, ty, edge * falloff)
        if (blocksLight(grid, tx, ty, haveKey, flipped)) break
        const t = tileAt(grid, tx, ty)
        const i = ty * grid.w + tx
        if ((t === 'mirrorF' || t === 'mirrorB') && i !== lastMirror) {
          // Reflect the direction and mirror the ray's position across the
          // tile's diagonal, so a cone stays a cone after bouncing.
          lastMirror = i
          const lx = fx - tx
          const ly = fy - ty
          if (t === 'mirrorF') {
            ;[dx, dy] = [-dy, -dx]
            fx = tx + (1 - ly)
            fy = ty + (1 - lx)
          } else {
            ;[dx, dy] = [dy, dx]
            fx = tx + ly
            fy = ty + lx
          }
        } else if (t !== 'mirrorF' && t !== 'mirrorB') {
          lastMirror = -1
        }
      }
    }
  }

  for (const c of input.critters) {
    const cx = Math.round(c.x)
    const cy = Math.round(c.y)
    brighten(out, grid, cx, cy, 0.75)
    brighten(out, grid, cx + 1, cy, 0.4)
    brighten(out, grid, cx - 1, cy, 0.4)
    brighten(out, grid, cx, cy + 1, 0.4)
    brighten(out, grid, cx, cy - 1, 0.4)
  }
  return out
}
