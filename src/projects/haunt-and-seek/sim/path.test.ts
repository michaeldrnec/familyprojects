import { describe, expect, it } from 'vitest'
import { dijkstra, pathTo, shortestPath } from './path'

// 5×3 open grid; the middle row's center is a wall.
const W = 5
const H = 3
const at = (x: number, y: number) => y * W + x
const wall = at(2, 1)

describe('dijkstra', () => {
  it('finds the shortest way round a wall', () => {
    const path = shortestPath(W, H, at(0, 1), at(4, 1), (i) => (i === wall ? Infinity : 1))
    expect(path.length).toBe(6)
    expect(path).not.toContain(wall)
    expect(path[path.length - 1]).toBe(at(4, 1))
  })

  it('takes a longer route to avoid an expensive tile', () => {
    const hot = at(2, 0)
    const cost = (i: number) => (i === wall ? Infinity : i === hot ? 20 : 1)
    const path = shortestPath(W, H, at(0, 0), at(4, 0), cost)
    expect(path).not.toContain(hot)
  })

  it('returns no path to an unreachable tile', () => {
    const field = dijkstra(W, H, 0, (i) => (i % W === 2 ? Infinity : 1))
    expect(pathTo(field, 0, 4)).toEqual([])
    expect(field.dist[4]).toBe(Infinity)
  })
})
