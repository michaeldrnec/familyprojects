// Level data shapes (SPEC.md section 6). Objects are placed by their
// *bottom centre*, which makes stacking read naturally in level files.
import type { BreedId } from '../game/breeds'
import type { MaterialId } from '../game/materials'
import type { PrefabId } from '../game/objects'

export type RoomId = 'kitchen' | 'living' | 'office' | 'bedroom'

export interface ObjectSpec {
  prefab: PrefabId
  x: number
  y: number // bottom
  angle?: number
  w?: number
  h?: number
  precious?: boolean
  material?: MaterialId
}

export interface LevelDef {
  id: string
  room: RoomId
  index: number // 1-based within the room
  title: string
  width: number
  height: number
  perch: { x: number; y: number } // where the cat sits (its centre)
  lineup: BreedId[]
  stars: [number, number, number] // score thresholds; 1★ is always given on a win
  objects: ObjectSpec[]
  dog?: { x: number } // sleeping dog on the floor at this x
  coach?: string[] // one-line tutorial bubbles shown in order
}

export type ShotAction =
  | { at: number; kind: 'tap' }
  | { at: number; kind: 'hold' }
  | { at: number; kind: 'release' }
  | { at: number; kind: 'swipe'; dx: number; dy: number }

export interface Shot {
  angle: number // radians, screen coords (y down): -π/4 is up-right
  power: number // 0..1
  actions?: ShotAction[]
}

export const FLOOR_H = 40
export function floorY(level: { height: number }) {
  return level.height - FLOOR_H
}
