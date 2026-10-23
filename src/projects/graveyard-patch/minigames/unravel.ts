// Spaghetti Unravel's puzzles: a tangle of wires to drag apart until none
// cross. Each puzzle is built from a crossing-free layout (nodes round a
// circle joined by non-crossing chords of a triangulation), so every one is
// solvable, then the nodes are scattered to tangle it.
import { shuffle, type Rng } from '../../../shared/rng'
import type { Severity } from '../sim/config'

export interface Point {
  x: number
  y: number
}

export interface Puzzle {
  nodes: Point[] // scattered start, in 0..1 board units
  edges: [number, number][]
  solution: Point[] // a layout with no crossings
  timeLimit: number
}

const SIZE: Record<Severity, { nodes: number; chords: number; time: number }> = {
  P3: { nodes: 5, chords: 2, time: 25 },
  P1: { nodes: 6, chords: 3, time: 30 },
  P0: { nodes: 7, chords: 4, time: 36 },
}

const MIN_GAP = 0.16

// The chords of a random triangulation of a convex polygon on vertices lo..hi.
function triangulate(rng: Rng, lo: number, hi: number, out: [number, number][]) {
  if (hi - lo < 2) return
  const k = rng.int(lo + 1, hi)
  if (k - lo > 1) out.push([lo, k])
  if (hi - k > 1) out.push([k, hi])
  triangulate(rng, lo, k, out)
  triangulate(rng, k, hi, out)
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

// Proper crossing of segments ab and cd (touching at a shared endpoint doesn't count).
function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const d1 = cross(c, d, a)
  const d2 = cross(c, d, b)
  const d3 = cross(a, b, c)
  const d4 = cross(a, b, d)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

// Which edges cross at least one other, and how many crossings there are.
export function crossings(nodes: Point[], edges: [number, number][]): { count: number; tangled: Set<number> } {
  let count = 0
  const tangled = new Set<number>()
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const [a, b] = edges[i]
      const [c, d] = edges[j]
      if (a === c || a === d || b === c || b === d) continue
      if (segmentsCross(nodes[a], nodes[b], nodes[c], nodes[d])) {
        count++
        tangled.add(i)
        tangled.add(j)
      }
    }
  }
  return { count, tangled }
}

function scatter(rng: Rng, n: number): Point[] {
  const pts: Point[] = []
  let tries = 0
  while (pts.length < n) {
    const p = { x: rng.range(0.1, 0.9), y: rng.range(0.1, 0.9) }
    if (tries++ > 500 || pts.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= MIN_GAP)) pts.push(p)
  }
  return pts
}

export function makePuzzle(rng: Rng, severity: Severity): Puzzle {
  const { nodes: n, chords, time } = SIZE[severity]
  const solution = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2
    return { x: 0.5 + Math.cos(a) * 0.38, y: 0.5 + Math.sin(a) * 0.38 }
  })
  const all: [number, number][] = []
  triangulate(rng, 0, n - 1, all)
  const edges: [number, number][] = Array.from({ length: n }, (_, i) => [i, (i + 1) % n] as [number, number])
  edges.push(...shuffle(rng, all).slice(0, chords))

  // Scatter until it's properly tangled.
  const want = Math.max(2, Math.floor(n / 2))
  let nodes = scatter(rng, n)
  for (let i = 0; i < 200 && crossings(nodes, edges).count < want; i++) nodes = scatter(rng, n)
  return { nodes, edges, solution, timeLimit: time }
}
