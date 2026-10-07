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
// monotonic within a row, so it never crosses itself. Rows are spaced 170px
// apart so a pad can sit on the midline between two rows (85px from each,
// well clear of the lane's glow) and cover both passes.
export const WAYPOINTS: Point[] = [
  { x: -40, y: 130 },
  { x: 780, y: 130 },
  { x: 780, y: 300 },
  { x: 260, y: 300 },
  { x: 260, y: 470 },
  { x: 920, y: 470 },
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

// Hand-placed pads. Every pad keeps >= 50px from the lane centerline (the
// lane's glow is 24px either side, a max-tier tower ~22px), >= 56px from
// every other pad, and stays clear of the HUD (top) and shop bar, which
// covers roughly y > 525 -- so nothing sits below the last lane pass. The
// midline rows between lane passes are the contested "double coverage"
// spots; the outer pads only see one pass.
function row(y: number, xs: number[], idPrefix: string): Pad[] {
  return xs.map((x, i) => ({ id: `${idPrefix}-${i}`, x, y }))
}

export const PADS: Pad[] = [
  ...row(72, [140, 280, 420, 560, 700], 'top'),
  ...row(215, [80, 200, 320, 440, 560, 680], 'mid1'),
  { id: 'east-0', x: 845, y: 175 },
  { id: 'east-1', x: 845, y: 255 },
  { id: 'west-0', x: 190, y: 385 },
  { id: 'west-1', x: 190, y: 470 },
  ...row(385, [380, 500, 620, 740, 860, 960], 'mid2'),
]
