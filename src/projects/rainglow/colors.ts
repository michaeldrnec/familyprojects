// RYB ("paint mixing") color model: light passing through Red/Yellow/Blue
// lenses blends the way childhood paint-wheel intuition expects (Yellow +
// Blue = Green, Red + Yellow = Orange, Red + Blue = Purple), rather than
// physically-accurate subtractive optical filtering.
//
// Lens counts naturally give proportions (red, yellow, blue) that sum to 1
// — a point on the "RYB triangle" (barycentric coordinates). Mixed color is
// a quadratic triangular Bézier blend of 6 control points: the 3 pure
// primaries at the corners, and the 3 secondary colors at the edge
// midpoints (e.g. the Yellow-Blue edge's midpoint is Green). This is the
// standard technique for blending barycentric proportions smoothly without
// any "white" bleeding in — an earlier cube-interpolation attempt diluted
// every mix toward white because it treated the proportions as a lossy
// partition of a "white + primaries" cube rather than a pure RYB triangle.

export interface RGB {
  r: number
  g: number
  b: number
}

const WHITE: RGB = { r: 255, g: 255, b: 255 } // no lenses — light passes through unfiltered
const RED: RGB = { r: 237, g: 28, b: 36 }
const YELLOW: RGB = { r: 255, g: 222, b: 23 }
const BLUE: RGB = { r: 0, g: 119, b: 190 }
const ORANGE: RGB = { r: 255, g: 140, b: 0 } // red + yellow midpoint
const GREEN: RGB = { r: 45, g: 175, b: 75 } // yellow + blue midpoint
const PURPLE: RGB = { r: 102, g: 26, b: 128 } // red + blue midpoint

export interface LensCounts {
  red: number
  yellow: number
  blue: number
}

function mixChannel(channel: keyof RGB, r: number, y: number, b: number): number {
  // Quadratic triangular Bézier / barycentric blend. Coefficients sum to
  // (r + y + b)^2 = 1, so this is a true weighted average.
  return (
    r * r * RED[channel] +
    y * y * YELLOW[channel] +
    b * b * BLUE[channel] +
    2 * r * y * ORANGE[channel] +
    2 * y * b * GREEN[channel] +
    2 * r * b * PURPLE[channel]
  )
}

export function mixColor(counts: LensCounts): RGB {
  const total = counts.red + counts.yellow + counts.blue
  if (total === 0) return WHITE

  const r = counts.red / total
  const y = counts.yellow / total
  const b = counts.blue / total

  return {
    r: Math.round(mixChannel('r', r, y, b)),
    g: Math.round(mixChannel('g', r, y, b)),
    b: Math.round(mixChannel('b', r, y, b)),
  }
}

export function colorDistance(a: RGB, b: RGB): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2)
}

export function toCss(color: RGB): string {
  return `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`
}
