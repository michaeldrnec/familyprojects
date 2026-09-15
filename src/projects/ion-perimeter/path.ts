// The lane enemies fly and the buildable pads flanking it. Both are a fixed,
// hand-placed layout rather than a free grid/maze -- see SPEC.md section 3:
// the challenge is choosing *what* to build where, not whether a maze can be
// built at all, so one curated map is enough for a focused v1.

// Fixed logical canvas resolution -- CSS-scaled to fit the viewport rather
// than resized/DPR-adjusted, matching gravity-well and starwarden's
// convention of a constant "world size" scaled by the browser.
export const VIEW_WIDTH = 1000
export const VIEW_HEIGHT = 640

export interface Point {
  x: number
  y: number
}

export interface PathPoint extends Point {
  angle: number // radians, direction of travel at this point
}

export interface Pad {
  id: string
  x: number
  y: number
}

// A 3-row boustrophedon (zigzag) lane: enters off-screen left, sweeps right,
// drops a row, sweeps left, drops a row, sweeps right into the core. Always
// monotonic within a row, so it never crosses itself and pads can be offset
// a fixed perpendicular distance from each segment without colliding with
// an unrelated part of the lane.
export const WAYPOINTS: Point[] = [
  { x: -40, y: 140 },
  { x: 760, y: 140 },
  { x: 760, y: 320 },
  { x: 280, y: 320 },
  { x: 280, y: 460 },
  { x: 940, y: 460 },
]

// The final waypoint doubles as the outpost core's position -- an enemy
// "leaking" (reaching the end of the path) and an enemy "reaching the core"
// are the same event, which is the point.
export const CORE: Point = WAYPOINTS[WAYPOINTS.length - 1]
export const CORE_RADIUS = 34

export interface PathSampler {
  totalLength: number
  at(distance: number): PathPoint
}

export function buildPathSampler(waypoints: Point[]): PathSampler {
  const segments = waypoints.slice(1).map((to, i) => {
    const from = waypoints[i]
    const dx = to.x - from.x
    const dy = to.y - from.y
    const length = Math.hypot(dx, dy)
    const angle = Math.atan2(dy, dx)
    return { from, to, length, angle, ux: length ? dx / length : 0, uy: length ? dy / length : 0 }
  })
  const totalLength = segments.reduce((sum, s) => sum + s.length, 0)

  function at(distance: number): PathPoint {
    let remaining = Math.max(0, Math.min(distance, totalLength))
    for (const seg of segments) {
      if (remaining <= seg.length || seg === segments[segments.length - 1]) {
        const d = Math.min(remaining, seg.length)
        return { x: seg.from.x + seg.ux * d, y: seg.from.y + seg.uy * d, angle: seg.angle }
      }
      remaining -= seg.length
    }
    const last = segments[segments.length - 1]
    return { x: last.to.x, y: last.to.y, angle: last.angle }
  }

  return { totalLength, at }
}

export const PATH = buildPathSampler(WAYPOINTS)

// Generates a mirrored pair of pads at fixed distances along one straight
// segment, offset a fixed perpendicular distance to either side -- see the
// header comment for why a hand-placed layout beats a generic grid here.
function segmentPads(from: Point, to: Point, distances: number[], offset: number, idPrefix: string): Pad[] {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy)
  const ux = len ? dx / len : 0
  const uy = len ? dy / len : 0
  const px = -uy
  const py = ux
  const pads: Pad[] = []
  distances.forEach((d, i) => {
    const bx = from.x + ux * d
    const by = from.y + uy * d
    pads.push({ id: `${idPrefix}-${i}a`, x: bx + px * offset, y: by + py * offset })
    pads.push({ id: `${idPrefix}-${i}b`, x: bx - px * offset, y: by - py * offset })
  })
  return pads
}

export const PADS: Pad[] = [
  ...segmentPads(WAYPOINTS[0], WAYPOINTS[1], [160, 340, 520, 700], 55, 'row1'),
  ...segmentPads(WAYPOINTS[1], WAYPOINTS[2], [60, 130], 55, 'col1'),
  ...segmentPads(WAYPOINTS[2], WAYPOINTS[3], [80, 220, 360], 55, 'row2'),
  ...segmentPads(WAYPOINTS[3], WAYPOINTS[4], [50, 110], 55, 'col2'),
  ...segmentPads(WAYPOINTS[4], WAYPOINTS[5], [90, 230, 370, 510], 55, 'row3'),
]
