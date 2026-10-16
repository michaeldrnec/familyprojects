// The arsenal (SPEC.md section 9).
// All timings are in ticks; arrival = fire + charge + transit (+ any heat
// stutter).
import type { Armor, WeaponId } from './types'

export interface WeaponDef {
  id: WeaponId
  name: string
  short: string // timeline card label
  icon: string
  sector: number // unlocked on reaching this sector
  charge: number
  transit: number
  energy: number
  heat: number
  physical: boolean // can be intercepted by PDCs and dust, blocked by shields
  guided: boolean // scrambled by ion fields
  mass: number // PDC "highest mass" priority
  kills: Armor[] // armor classes one hit damages
  color: string
  blurb: string
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  laser: {
    id: 'laser',
    name: 'UV Laser',
    short: 'Laser',
    icon: '⚡',
    sector: 1,
    charge: 0,
    transit: 0,
    energy: 20,
    heat: 4,
    physical: false,
    guided: false,
    mass: 0,
    kills: ['light'],
    color: '#a5b4fc',
    blurb: 'Instant beam. Kills light structures and unarmored PDCs. Drains a shield by 1. Glances off medium and hardened armor.',
  },
  lance: {
    id: 'lance',
    name: 'Kinetic Lance',
    short: 'Lance',
    icon: '🗡️',
    sector: 1,
    charge: 0,
    transit: 3,
    energy: 35,
    heat: 6,
    physical: true,
    guided: false,
    mass: 3,
    kills: ['light', 'medium', 'hardened'],
    color: '#fbbf24',
    blurb: 'Tungsten rod, 3 ticks to fall. Kills anything, ignores ion fields. Shatters a strength-1 shield (and is spent); stronger shields destroy it. PDCs can shoot it for 2 ticks.',
  },
  chaff: {
    id: 'chaff',
    name: 'Chaff Canister',
    short: 'Chaff',
    icon: '✨',
    sector: 1,
    charge: 0,
    transit: 1,
    energy: 10,
    heat: 1,
    physical: false,
    guided: false,
    mass: 0,
    kills: [],
    color: '#e5e7eb',
    blurb: 'Lands next tick. Blinds every PDC guarding that column on its arrival tick and the one after. Too fast to intercept.',
  },
  emp: {
    id: 'emp',
    name: 'EMP Burst',
    short: 'EMP',
    icon: '🌀',
    sector: 2,
    charge: 0,
    transit: 1,
    energy: 20,
    heat: 3,
    physical: false,
    guided: false,
    mass: 0,
    kills: [],
    color: '#67e8f9',
    blurb: 'Lands next tick. Knocks out a PDC, shield, battery, ion field or power source for 2 ticks (its arrival tick and the next). No damage.',
  },
  missile: {
    id: 'missile',
    name: 'Hypersonic Missile',
    short: 'Missile',
    icon: '🚀',
    sector: 2,
    charge: 0,
    transit: 2,
    energy: 20,
    heat: 3,
    physical: true,
    guided: true,
    mass: 1,
    kills: ['light', 'medium'],
    color: '#fb923c',
    blurb: 'Lands in 2 ticks. Kills light and medium structures. Exposed to PDCs for 1 tick. Ion fields push it one column along their drift.',
  },
  thermo: {
    id: 'thermo',
    name: 'Thermobaric Cluster',
    short: 'Thermo',
    icon: '💥',
    sector: 3,
    charge: 0,
    transit: 2,
    energy: 30,
    heat: 5,
    physical: true,
    guided: false,
    mass: 2,
    kills: ['light'],
    color: '#f87171',
    blurb: 'Lands in 2 ticks and splashes its column and both neighbours (the whole surface in volatile air), wrecking exposed light structures. Shielded columns are spared.',
  },
  resonance: {
    id: 'resonance',
    name: 'Resonance Beam',
    short: 'Resonance',
    icon: '〰️',
    sector: 4,
    charge: 2,
    transit: 0,
    energy: 40,
    heat: 7,
    physical: false,
    guided: false,
    mass: 0,
    kills: ['light'],
    color: '#c084fc',
    blurb: 'Charges for 2 ticks, then hits instantly. Passes straight through shields and fields. Kills light structures.',
  },
  drill: {
    id: 'drill',
    name: 'Drill Laser',
    short: 'Drill',
    icon: '🔩',
    sector: 4,
    charge: 1,
    transit: 0,
    energy: 35,
    heat: 6,
    physical: false,
    guided: false,
    mass: 0,
    kills: ['light', 'medium', 'hardened'],
    color: '#f0abfc',
    blurb: 'Charges for 1 tick, then hits instantly. Bores through any armor. Drains a shield by 1 like a laser. Refracted by a magnetosphere.',
  },
}

export const WEAPON_ORDER: WeaponId[] = ['laser', 'lance', 'chaff', 'emp', 'missile', 'thermo', 'resonance', 'drill']

export function isBeam(w: WeaponId) {
  return WEAPONS[w].transit === 0
}

export function isEffect(w: WeaponId) {
  return w === 'emp' || w === 'chaff'
}

// Laser-type beams are drained by shields and refracted by a magnetosphere.
export function isLaser(w: WeaponId) {
  return w === 'laser' || w === 'drill'
}
