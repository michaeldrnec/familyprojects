// Level-authoring helpers (SPEC.md section 6): keep each level file short
// by stacking things on top of each other and lining shelves with stuff.
import { PREFABS, type PrefabId } from '../game/objects'
import type { ObjectSpec } from './types'

export const FY = 960 // floor top for the standard 1000-tall room
export const PERCH = { x: 150, y: 790 }

type Item = PrefabId | { prefab: PrefabId; precious?: boolean; w?: number; h?: number; dx?: number }

function norm(i: Item) {
  return typeof i === 'string' ? { prefab: i } : i
}

export function heightOf(i: Item): number {
  const n = norm(i)
  return n.h ?? PREFABS[n.prefab].h
}

export function topOf(spec: ObjectSpec): number {
  return spec.y - (spec.h ?? PREFABS[spec.prefab].h)
}

export function obj(prefab: PrefabId, x: number, y: number, extra: Partial<ObjectSpec> = {}): ObjectSpec {
  return { prefab, x, y, ...extra }
}

// Items stacked bottom-up at x starting from surface y.
export function stack(x: number, y: number, items: Item[]): ObjectSpec[] {
  const out: ObjectSpec[] = []
  let cy = y
  for (const it of items) {
    const n = norm(it)
    out.push({ prefab: n.prefab, x: x + (n.dx ?? 0), y: cy, precious: n.precious, w: n.w, h: n.h })
    cy -= heightOf(it)
  }
  return out
}

// A static shelf whose top surface is at y, with items spread along it.
export function shelfWith(x: number, y: number, width: number, items: Item[], prefab: PrefabId = 'shelf'): ObjectSpec[] {
  const sh = PREFABS[prefab].h
  const out: ObjectSpec[] = [{ prefab, x, y: y + sh, w: width }]
  const n = items.length
  items.forEach((it, i) => {
    const m = norm(it)
    const px = n === 1 ? x : x - width / 2 + 20 + ((width - 40) * i) / (n - 1)
    out.push({ prefab: m.prefab, x: px + (m.dx ?? 0), y, precious: m.precious, w: m.w, h: m.h })
  })
  return out
}

export function precious(prefab: PrefabId): Item {
  return { prefab, precious: true }
}
