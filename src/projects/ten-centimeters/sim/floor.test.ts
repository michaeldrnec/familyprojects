import { describe, expect, it } from 'vitest'
import { findPath, isWalkable, lineOfSight, nearStation, SPOTS, START, stationAt, type Point } from './floor'
import type { Station } from './types'

const stations = Object.keys(SPOTS) as Station[]

function walk(from: Point, path: Point[]) {
  let at = from
  for (const p of path) {
    expect(lineOfSight(at, p), `blocked between (${at.x},${at.y}) and (${p.x},${p.y})`).toBe(true)
    at = p
  }
  return at
}

describe('floor', () => {
  it('has every station spot on walkable floor, inside its own room', () => {
    expect(isWalkable(START.x, START.y)).toBe(true)
    for (const id of stations) {
      const p = SPOTS[id]
      expect(isWalkable(p.x, p.y), id).toBe(true)
      expect(nearStation(p.x, p.y), id).toBe(id)
      expect(stationAt(p.x, p.y), id).toBe(id)
    }
  })

  it('can walk from every station to every other along clear straight lines', () => {
    for (const a of [START, ...stations.map((id) => SPOTS[id])]) {
      for (const id of stations) {
        const b = SPOTS[id]
        const path = findPath(a, b)
        expect(path.length, `${a.x},${a.y} -> ${id}`).toBeGreaterThan(0)
        const end = walk(a, path)
        expect(end).toEqual(b)
      }
    }
  })

  it('goes through doors instead of walls', () => {
    // Bay 1 to Bay 4 can't be a straight line: there are walls in between.
    const path = findPath(SPOTS.bay0, SPOTS.bay3)
    expect(path.length).toBeGreaterThan(1)
  })

  it('snaps a tap on a wall to the nearest floor', () => {
    const path = findPath(START, { x: 5, y: 5 })
    expect(path.length).toBeGreaterThan(0)
    const end = path[path.length - 1]
    expect(isWalkable(end.x, end.y)).toBe(true)
  })
})
