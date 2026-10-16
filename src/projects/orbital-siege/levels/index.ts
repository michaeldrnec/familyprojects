import type { Level } from '../types'
import { SECTOR1 } from './sector1'
import { SECTOR2 } from './sector2'
import { SECTOR3 } from './sector3'
import { SECTOR4 } from './sector4'

export const SECTORS = [
  { n: 1, name: 'Kepler’s Rock', levels: SECTOR1 },
  { n: 2, name: 'Ferrous Belt', levels: SECTOR2 },
  { n: 3, name: 'Caldera Worlds', levels: SECTOR3 },
  { n: 4, name: 'Core Grid', levels: SECTOR4 },
]

export const LEVELS: Level[] = SECTORS.flatMap((s) => s.levels)

export function levelById(id: string): Level | undefined {
  return LEVELS.find((l) => l.id === id)
}
