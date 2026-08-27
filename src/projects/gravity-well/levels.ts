import type { Body } from './physics'

export interface Level {
  name: string
  bounds: { width: number; height: number }
  rocketStart: { x: number; y: number }
  earth: { x: number; y: number; radius: number }
  bodies: Body[]
}

const BOUNDS = { width: 800, height: 600 }

export const LEVELS: Level[] = [
  {
    name: 'First Flight',
    bounds: BOUNDS,
    rocketStart: { x: 60, y: 540 },
    earth: { x: 740, y: 60, radius: 26 },
    bodies: [{ x: 500, y: 200, radius: 16, mass: 400, kind: 'asteroid' }],
  },
  {
    name: 'Around the Planet',
    bounds: BOUNDS,
    rocketStart: { x: 60, y: 300 },
    earth: { x: 740, y: 300, radius: 26 },
    bodies: [{ x: 400, y: 300, radius: 35, mass: 4500, kind: 'planet' }],
  },
  {
    name: 'Threading the Needle',
    bounds: BOUNDS,
    rocketStart: { x: 60, y: 60 },
    earth: { x: 740, y: 540, radius: 26 },
    bodies: [
      { x: 300, y: 200, radius: 18, mass: 600, kind: 'asteroid' },
      { x: 520, y: 420, radius: 30, mass: 3200, kind: 'planet' },
    ],
  },
  {
    name: 'Stellar Slingshot',
    bounds: BOUNDS,
    rocketStart: { x: 400, y: 560 },
    earth: { x: 400, y: 50, radius: 26 },
    bodies: [{ x: 600, y: 300, radius: 45, mass: 20000, kind: 'star' }],
  },
  {
    name: 'The Gauntlet',
    bounds: BOUNDS,
    rocketStart: { x: 60, y: 540 },
    earth: { x: 740, y: 60, radius: 26 },
    bodies: [
      { x: 250, y: 450, radius: 16, mass: 500, kind: 'asteroid' },
      { x: 450, y: 350, radius: 32, mass: 3500, kind: 'planet' },
      { x: 620, y: 180, radius: 42, mass: 18000, kind: 'star' },
    ],
  },
  {
    name: 'The Gap',
    bounds: BOUNDS,
    rocketStart: { x: 60, y: 300 },
    earth: { x: 740, y: 300, radius: 26 },
    bodies: [
      { x: 400, y: 170, radius: 30, mass: 3000, kind: 'planet' },
      { x: 400, y: 430, radius: 30, mass: 3000, kind: 'planet' },
    ],
  },
]
