// What every household object is made of (SPEC.md section 5). Impact
// numbers are "relative normal speed (units per 1/60 s) × effective mass
// (Matter mass units)"; see damage.ts. A cat counts as its whole-body
// mass, not the one ring particle that happened to touch.

export type MaterialId =
  | 'thinGlass'
  | 'glass'
  | 'ceramic'
  | 'wood'
  | 'floorboard'
  | 'cardboard'
  | 'fabric'
  | 'metal'
  | 'electronics'
  | 'paper'
  | 'static'

export type BreakStyle = 'shards' | 'chunks' | 'planks' | 'crumple' | 'husk' | 'hole' | 'none'
export type SoundKind = 'glass' | 'ceramic' | 'wood' | 'fabric' | 'metal' | 'electronics' | 'paper' | 'thud'

export interface Material {
  id: MaterialId
  density: number
  friction: number
  restitution: number
  toughness: number // impact below this does nothing
  hp: number // Infinity = unbreakable
  noise: number // chaos points on break (or per topple for unbreakables)
  breaks: BreakStyle
  fill: string
  stroke: string
  sound: SoundKind
  hard: boolean // the Orange Tabby ricochets off hard things
  sonicVulnerable?: boolean // shattered by the Siamese's scream
  coonOnly?: boolean // only a Chonk Slam gets through
}

export const MATERIALS: Record<MaterialId, Material> = {
  thinGlass: {
    id: 'thinGlass', density: 0.0012, friction: 0.3, restitution: 0.1,
    toughness: 3, hp: 3, noise: 900, breaks: 'shards',
    fill: 'rgba(170, 220, 255, 0.35)', stroke: '#d8f1ff', sound: 'glass', hard: true, sonicVulnerable: true,
  },
  glass: {
    id: 'glass', density: 0.0016, friction: 0.4, restitution: 0.1,
    toughness: 8, hp: 10, noise: 700, breaks: 'shards',
    fill: 'rgba(140, 205, 240, 0.5)', stroke: '#cdeeff', sound: 'glass', hard: true,
  },
  ceramic: {
    id: 'ceramic', density: 0.0018, friction: 0.6, restitution: 0.15,
    toughness: 10, hp: 14, noise: 500, breaks: 'chunks',
    fill: '#e9e2d0', stroke: '#fffaf0', sound: 'ceramic', hard: true,
  },
  wood: {
    id: 'wood', density: 0.0022, friction: 0.7, restitution: 0.2,
    toughness: 45, hp: 90, noise: 300, breaks: 'planks',
    fill: '#8a5a36', stroke: '#c48a5a', sound: 'wood', hard: true,
  },
  floorboard: {
    id: 'floorboard', density: 0.003, friction: 0.8, restitution: 0.1,
    toughness: 40, hp: 1, noise: 800, breaks: 'hole',
    fill: '#6b4a2f', stroke: '#a57649', sound: 'wood', hard: true, coonOnly: true,
  },
  cardboard: {
    id: 'cardboard', density: 0.0008, friction: 0.8, restitution: 0.1,
    toughness: 12, hp: 30, noise: 150, breaks: 'crumple',
    fill: '#b98c55', stroke: '#e0b67a', sound: 'paper', hard: false,
  },
  fabric: {
    id: 'fabric', density: 0.0007, friction: 0.9, restitution: 0.3,
    toughness: Infinity, hp: Infinity, noise: 60, breaks: 'none',
    fill: '#7d8fc9', stroke: '#b3c2f2', sound: 'fabric', hard: false,
  },
  metal: {
    id: 'metal', density: 0.004, friction: 0.5, restitution: 0.3,
    toughness: Infinity, hp: Infinity, noise: 400, breaks: 'none',
    fill: '#8f9aa6', stroke: '#d5dde6', sound: 'metal', hard: true,
  },
  electronics: {
    id: 'electronics', density: 0.002, friction: 0.5, restitution: 0.1,
    toughness: 12, hp: 24, noise: 1200, breaks: 'husk',
    fill: '#2b2f3a', stroke: '#8fa3c7', sound: 'electronics', hard: true,
  },
  paper: {
    id: 'paper', density: 0.0009, friction: 0.8, restitution: 0,
    toughness: Infinity, hp: Infinity, noise: 100, breaks: 'none',
    fill: '#f1ecdc', stroke: '#fffdf5', sound: 'paper', hard: false,
  },
  static: {
    id: 'static', density: 0.002, friction: 0.7, restitution: 0.1,
    toughness: Infinity, hp: Infinity, noise: 0, breaks: 'none',
    fill: '#3a3f5c', stroke: '#6c74a3', sound: 'thud', hard: true,
  },
}
