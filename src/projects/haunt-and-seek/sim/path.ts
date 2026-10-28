// Shortest paths on a manor grid. Manors are at most 27×25 tiles, so a plain
// Dijkstra over the whole grid (with a small binary heap) is cheap enough to
// run every time Snaxley reaches a tile.

// Cost of stepping onto a tile; Infinity means it can't be entered.
export type CostFn = (tile: number) => number

export interface Field {
  dist: Float32Array
  prev: Int32Array
}

export function dijkstra(w: number, h: number, start: number, cost: CostFn): Field {
  const n = w * h
  const dist = new Float32Array(n).fill(Infinity)
  const prev = new Int32Array(n).fill(-1)
  // A binary min-heap of (distance, tile) pairs, keyed by the distance at
  // push time; stale entries are skipped when popped.
  const keys: number[] = []
  const vals: number[] = []
  const swap = (a: number, b: number) => {
    ;[keys[a], keys[b]] = [keys[b], keys[a]]
    ;[vals[a], vals[b]] = [vals[b], vals[a]]
  }
  const push = (k: number, v: number) => {
    keys.push(k)
    vals.push(v)
    let c = keys.length - 1
    while (c > 0) {
      const p = (c - 1) >> 1
      if (keys[p] <= keys[c]) break
      swap(p, c)
      c = p
    }
  }
  const pop = () => {
    const top = vals[0]
    const lk = keys.pop()!
    const lv = vals.pop()!
    if (keys.length) {
      keys[0] = lk
      vals[0] = lv
      let p = 0
      for (;;) {
        const l = p * 2 + 1
        const r = l + 1
        let m = p
        if (l < keys.length && keys[l] < keys[m]) m = l
        if (r < keys.length && keys[r] < keys[m]) m = r
        if (m === p) break
        swap(p, m)
        p = m
      }
    }
    return top
  }
  const done = new Uint8Array(n)
  dist[start] = 0
  push(0, start)
  while (keys.length) {
    const i = pop()
    if (done[i]) continue
    done[i] = 1
    const x = i % w
    const y = (i - x) / w
    for (let d = 0; d < 4; d++) {
      const nx = d === 0 ? x + 1 : d === 1 ? x - 1 : x
      const ny = d === 2 ? y + 1 : d === 3 ? y - 1 : y
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const j = ny * w + nx
      if (done[j]) continue
      const c = cost(j)
      if (c === Infinity) continue
      const nd = dist[i] + c
      if (nd < dist[j]) {
        dist[j] = nd
        prev[j] = i
        push(nd, j)
      }
    }
  }
  return { dist, prev }
}

// The tiles from `start` (exclusive) to `goal` (inclusive), or [] if the
// goal wasn't reached.
export function pathTo(field: Field, start: number, goal: number): number[] {
  if (goal === start || field.prev[goal] < 0) return []
  const out: number[] = []
  for (let i = goal; i !== start && i >= 0; i = field.prev[i]) out.push(i)
  return out.reverse()
}

export function shortestPath(w: number, h: number, start: number, goal: number, cost: CostFn): number[] {
  return pathTo(dijkstra(w, h, start, cost), start, goal)
}
