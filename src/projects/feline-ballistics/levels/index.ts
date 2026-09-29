// The campaign: 4 rooms × 5 levels (SPEC.md section 6). A room unlocks
// once the previous one has earned ROOM_UNLOCK_STARS.
import type { LevelDef, RoomId } from './types'
import { KITCHEN } from './kitchen'
import { LIVING } from './livingRoom'
import { OFFICE } from './office'
import { BEDROOM } from './bedroom'
import type { BreedId } from '../game/breeds'

export const ROOMS: { id: RoomId; title: string; breed: BreedId; levels: LevelDef[]; blurb: string }[] = [
  { id: 'kitchen', title: 'Kitchen', breed: 'tabby', levels: KITCHEN, blurb: 'Mugs, jars and a very tall fridge.' },
  { id: 'living', title: 'Living Room', breed: 'coon', levels: LIVING, blurb: 'Laundry mountains and creaky floorboards.' },
  { id: 'office', title: 'Home Office', breed: 'siamese', levels: OFFICE, blurb: 'Glass, monitors, and the dog.' },
  { id: 'bedroom', title: 'Bedroom', breed: 'calico', levels: BEDROOM, blurb: 'Trinkets, perfume, and the snooze button.' },
]

export const ROOM_UNLOCK_STARS = 8

export const ALL_LEVELS: LevelDef[] = ROOMS.flatMap((r) => r.levels)

export function levelById(id: string): LevelDef | undefined {
  return ALL_LEVELS.find((l) => l.id === id)
}

export function nextLevel(id: string): LevelDef | undefined {
  const i = ALL_LEVELS.findIndex((l) => l.id === id)
  return i >= 0 ? ALL_LEVELS[i + 1] : undefined
}

export function roomStars(room: RoomId, stars: Record<string, number>): number {
  return ROOMS.find((r) => r.id === room)!.levels.reduce((s, l) => s + (stars[l.id] ?? 0), 0)
}

export function roomUnlocked(room: RoomId, stars: Record<string, number>): boolean {
  const i = ROOMS.findIndex((r) => r.id === room)
  return i <= 0 || roomStars(ROOMS[i - 1].id, stars) >= ROOM_UNLOCK_STARS
}
