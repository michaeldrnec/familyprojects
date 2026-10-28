import { describe, expect, it } from 'vitest'
import { MANORS } from './config'
import { DOOR, FLOOR, HOUSE, HOUSE_DOOR, WALL, corridorRun, isFloor, lineOfSight, neighbors, parseManor, tileX, tileY } from './maze'
import { dijkstra } from './path'

describe('manor maps', () => {
  MANORS.forEach((manor, k) => {
    describe(manor.name, () => {
      const m = parseManor(manor.map)

      it('is closed in by walls apart from the front door', () => {
        for (let x = 0; x < m.w; x++) {
          for (const y of [0, m.h - 1]) expect([WALL, DOOR]).toContain(m.cells[y * m.w + x])
        }
        for (let y = 0; y < m.h; y++) for (const x of [0, m.w - 1]) expect(m.cells[y * m.w + x]).toBe(WALL)
        expect(tileY(m, m.door)).toBe(m.h - 1)
        expect(neighbors(m, m.door)).toContain(m.start)
      })

      it('lets Snaxley reach every sweet, every gumball and the door', () => {
        const walk = dijkstra(m.w, m.h, m.start, (i) => (isFloor(m, i) || m.cells[i] === DOOR ? 1 : Infinity))
        for (const i of [...m.sweets, ...m.gumballs, m.door]) expect(walk.dist[i], `tile ${tileX(m, i)},${tileY(m, i)}`).toBeLessThan(Infinity)
        // ...and every bit of floor is joined up.
        for (let i = 0; i < m.cells.length; i++) if (m.cells[i] === FLOOR) expect(walk.dist[i]).toBeLessThan(Infinity)
      })

      it('has a Ghost House closed off except for its ghost door', () => {
        for (const i of m.house) for (const n of neighbors(m, i)) expect([HOUSE, HOUSE_DOOR, WALL]).toContain(m.cells[n])
        const out = neighbors(m, m.houseDoor).filter((n) => m.cells[n] === FLOOR)
        expect(out.length).toBe(1)
        const fly = dijkstra(m.w, m.h, m.house[0], (i) => (m.cells[i] === WALL ? Infinity : 1))
        expect(fly.dist[m.start]).toBeLessThan(Infinity)
      })

      it('has no dead ends to corner Snaxley in', () => {
        for (let i = 0; i < m.cells.length; i++) {
          if (m.cells[i] !== FLOOR || i === m.start) continue
          expect(neighbors(m, i).filter((n) => isFloor(m, n)).length, `tile ${tileX(m, i)},${tileY(m, i)}`).toBeGreaterThanOrEqual(2)
        }
      })

      it('has the gumballs its briefing promises', () => {
        expect(m.gumballs.length).toBe([0, 2, 2, 3, 3, 4][k])
        expect(m.sweets.length).toBeGreaterThan(60)
      })
    })
  })

  it('rejects ragged or unknown maps', () => {
    expect(() => parseManor(['###', '##'])).toThrow()
    expect(() => parseManor(['#?#'])).toThrow()
  })
})

describe('grid helpers', () => {
  const m = parseManor(['#######', '#.....#', '#.#.#.#', '#..S..#', '#GG=###', '###D###'])

  it('finds the straight corridor through a tile', () => {
    const run = corridorRun(m, 1 * m.w + 3)
    expect(run.map((i) => tileX(m, i)).sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('stops line of sight at walls but not across open floor', () => {
    expect(lineOfSight(m, 1, 1, 5, 1)).toBe(true)
    expect(lineOfSight(m, 2, 1, 2, 3)).toBe(false)
  })
})
