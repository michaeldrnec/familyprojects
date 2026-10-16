// Shared data shapes for Orbital Siege. Everything here is plain data so the
// sim, the level files, the daily generator and the share codes can all pass
// it around without React.

export type WeaponId = 'laser' | 'lance' | 'chaff' | 'emp' | 'missile' | 'thermo' | 'resonance' | 'drill'

export type Armor = 'light' | 'medium' | 'hardened'

// Surface structures. Cores and hangars are the usual objectives; relays and
// generators power other defenses; batteries shoot back; sites are the
// protected places the platform must not damage.
export type StructureKind = 'core' | 'hangar' | 'relay' | 'generator' | 'battery' | 'site'

export interface StructureDef {
  id: string
  kind: StructureKind
  name: string
  col: number
  armor: Armor
  hp?: number // default 1
  fireAt?: number // batteries: fires at the END of this tick
  power?: string // id of the relay/generator that powers it
  hard?: boolean // sites: damaging it fails the mission (otherwise it only costs Surgical)
}

export type PdcPriority = 'mass' | 'nearest' | 'first'

export interface PdcDef {
  id: string
  name: string
  col: number // where it hangs in the orbital band
  zone: [number, number] // inclusive range of surface columns it guards
  priority: PdcPriority
  barrels?: number // shots per tick, default 1
  armored?: boolean // armored PDCs shrug off lasers
  power?: string
}

export interface ShieldDef {
  id: string
  name: string
  from: number
  to: number // inclusive column range
  strength: number // 1-3
  power?: string
}

export interface FieldDef {
  // ion: only scrambles guided missiles. magneto: also refracts lasers and
  // swallows single EMPs (two in one tick overload it).
  kind: 'ion' | 'magneto'
  drift: -1 | 1
}

export interface Modifiers {
  solarStorm?: boolean // EMPs last 3 ticks
  dustTicks?: number[] // physical projectiles in transit on these ticks are destroyed
  volatile?: boolean // thermobaric splash covers the whole surface
}

// A target is a string key: `c<n>` for surface column n, or the id of a PDC
// or shield, or 'field'. Share codes store its index in targetsOf(level).
export type Target = string

export interface Action {
  w: WeaponId
  tick: number // the tick it is triggered (fire tick)
  target: Target
}

export type Plan = Action[]

export interface Level {
  id: string // '3-2', or 'D20261014' for a daily
  name: string
  brief: string
  sector: number // 1-4 (dailies use 3)
  width: number // surface columns
  ticks: number // N
  energy?: number // base energy cap override (default 100)
  heatCap?: number // default 10
  cool?: number // default 3
  parTick: number // Hyper-Velocity badge: win on or before this tick
  minimalist?: number // Minimalist badge: use at most this much energy (default 60% of base cap)
  banned?: WeaponId[] // weapons offline this mission
  structures: StructureDef[]
  pdcs: PdcDef[]
  shields: ShieldDef[]
  field?: FieldDef
  modifiers?: Modifiers
  objectives: string[] // structure ids
  solution: Plan // reference solution, validated in DEV
  tip?: string
}

export interface Platform {
  energy: number
  heatCap: number
  cool: number
  targeting: boolean // Targeting Computer upgrade
}
