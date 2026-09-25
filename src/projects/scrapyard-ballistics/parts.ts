// The scrap catalog -- see SPEC.md sections 3, 6 and 8. Every figure is SI
// (kg, N, m², m/s) on a 1 m grid. `integrity` is the load (N) a weld to
// this part survives; a weld's rating is the weaker of its two parts.
// `attach` lists which unrotated faces can be welded: [top, right, bottom, left].

export type PartId =
  | 'lawnChair'
  | 'bathtub'
  | 'mower'
  | 'sodaKeg'
  | 'firework'
  | 'propaneTorch'
  | 'turbopump'
  | 'gasCan'
  | 'propaneTank'
  | 'rustyPlate'
  | 'steelScaffold'
  | 'aluminum'
  | 'bolt'
  | 'chute'
  | 'noseCone'
  | 'fin'
  | 'gyro'
  | 'guidance'
  | 'timer'
  | 'barometer'
  | 'radioSat'

export type PartCategory = 'command' | 'engine' | 'tank' | 'structure' | 'utility'

export type ContractId = 'fence' | 'sonic' | 'space' | 'home' | 'radio' | 'roundTrip'

export interface EngineStats {
  thrust: number // N at full throttle, before per-flight variance
  isp: number // s -- fuel flow = thrust / (isp * g0)
  throttleable: boolean
  canShutdown: boolean
  internalFuel?: number // kg of self-contained propellant (keg, firework); otherwise draws from tanks
  gimbal?: number // radians of steering deflection
  heatRate: number // heat units/s at full throttle; 1.0 heat = explode
  failureRate: number // failures per burning second at full throttle
  thrustVariance: number // ±fraction rolled once per flight
  sound: 'mower' | 'keg' | 'firework' | 'torch' | 'turbo'
}

export interface PartDef {
  id: PartId
  name: string
  blurb: string
  category: PartCategory
  w: number
  h: number
  mass: number // dry kg
  cd: number // drag coefficient on a 1 m² face
  integrity: number
  crashTolerance: number // impact m/s it survives
  heatTolerance: number // re-entry flux it shrugs off (see atmosphere.heatFlux)
  cost: number
  attach: [boolean, boolean, boolean, boolean]
  unlock?: ContractId // listed in the Black Market after this contract
  engine?: EngineStats
  tank?: { fuel: number }
  chute?: { area: number }
  bolt?: true
  fin?: { area: number }
  gyro?: { torque: number } // N·m
  guidance?: true
  timer?: true
  barometer?: true
  payload?: true
  command?: true
}

const ALL: [boolean, boolean, boolean, boolean] = [true, true, true, true]
const BASE_ONLY: [boolean, boolean, boolean, boolean] = [false, false, true, false]
const NO_NOZZLE: [boolean, boolean, boolean, boolean] = [true, true, false, true]

export const PART_DEFS: Record<PartId, PartDef> = {
  lawnChair: {
    id: 'lawnChair',
    name: 'Lawn Chair Cockpit',
    blurb: 'Folding aluminum throne, duct-taped harness. Pilot included.',
    category: 'command',
    w: 1, h: 1, mass: 95, cd: 1.1,
    integrity: 45000, crashTolerance: 14, heatTolerance: 0.6, cost: 150,
    attach: ALL, command: true, gyro: { torque: 450 }, // the pilot leans
  },
  bathtub: {
    id: 'bathtub',
    name: 'Bathtub Capsule',
    blurb: 'Cast iron clawfoot tub, upside down. Shrugs off re-entry and hard landings.',
    category: 'command',
    w: 1, h: 1, mass: 160, cd: 0.7,
    integrity: 90000, crashTolerance: 24, heatTolerance: 4, cost: 900,
    attach: ALL, command: true, unlock: 'space', gyro: { torque: 700 },
  },
  mower: {
    id: 'mower',
    name: 'Lawn Mower Engine',
    blurb: 'Two-stroke, pull-start, burns gas from connected cans. Throttleable-ish.',
    category: 'engine',
    w: 1, h: 1, mass: 28, cd: 0.9,
    integrity: 30000, crashTolerance: 10, heatTolerance: 0.5, cost: 150,
    attach: NO_NOZZLE,
    engine: {
      thrust: 2600, isp: 150, throttleable: true, canShutdown: true,
      heatRate: 0.012, failureRate: 0.006, thrustVariance: 0.04, sound: 'mower',
    },
  },
  sodaKeg: {
    id: 'sodaKeg',
    name: 'Pressurized Soda Keg',
    blurb: 'Over-carbonated and very angry. Short, violent, can’t be throttled.',
    category: 'engine',
    w: 1, h: 1, mass: 14, cd: 0.8,
    integrity: 28000, crashTolerance: 16, heatTolerance: 0.6, cost: 60,
    attach: NO_NOZZLE,
    engine: {
      thrust: 7500, isp: 75, throttleable: false, canShutdown: true, internalFuel: 60,
      heatRate: 0.01, failureRate: 0.012, thrustVariance: 0.12, sound: 'keg',
    },
  },
  firework: {
    id: 'firework',
    name: 'Surplus Firework SRB',
    blurb: 'Military-grade finale shell. Once lit, it will not stop.',
    category: 'engine',
    w: 1, h: 2, mass: 22, cd: 0.8,
    integrity: 40000, crashTolerance: 8, heatTolerance: 0.6, cost: 120,
    attach: NO_NOZZLE,
    engine: {
      thrust: 15000, isp: 175, throttleable: false, canShutdown: false, internalFuel: 110,
      heatRate: 0.02, failureRate: 0.004, thrustVariance: 0.1, sound: 'firework',
    },
  },
  propaneTorch: {
    id: 'propaneTorch',
    name: 'Propane Weed Torch',
    blurb: 'Six farm torches welded into a cluster. Throttles and gimbals a little.',
    category: 'engine',
    w: 1, h: 1, mass: 55, cd: 0.9,
    integrity: 60000, crashTolerance: 12, heatTolerance: 0.8, cost: 600,
    attach: NO_NOZZLE, unlock: 'sonic',
    engine: {
      thrust: 11000, isp: 250, throttleable: true, canShutdown: true, gimbal: 0.08,
      heatRate: 0.009, failureRate: 0.003, thrustVariance: 0.05, sound: 'torch',
    },
  },
  turbopump: {
    id: 'turbopump',
    name: 'Black-Market Turbopump',
    blurb: 'Nobody asks where it came from. Big thrust, real gimbal.',
    category: 'engine',
    w: 1, h: 1, mass: 120, cd: 0.9,
    integrity: 110000, crashTolerance: 12, heatTolerance: 1, cost: 2500,
    attach: NO_NOZZLE, unlock: 'space',
    engine: {
      thrust: 38000, isp: 320, throttleable: true, canShutdown: true, gimbal: 0.12,
      heatRate: 0.006, failureRate: 0.0015, thrustVariance: 0.03, sound: 'turbo',
    },
  },
  gasCan: {
    id: 'gasCan',
    name: 'Jerry Can',
    blurb: 'Five gallons of regular unleaded. Feeds any engine on its stage.',
    category: 'tank',
    w: 1, h: 1, mass: 6, cd: 1.0,
    integrity: 30000, crashTolerance: 14, heatTolerance: 0.5, cost: 40,
    attach: ALL, tank: { fuel: 55 },
  },
  propaneTank: {
    id: 'propaneTank',
    name: 'Propane Cylinder',
    blurb: 'Farm-size cylinder. Lots of fuel, heavy walls.',
    category: 'tank',
    w: 1, h: 2, mass: 30, cd: 0.9,
    integrity: 70000, crashTolerance: 16, heatTolerance: 0.6, cost: 250,
    attach: ALL, unlock: 'sonic', tank: { fuel: 320 },
  },
  rustyPlate: {
    id: 'rustyPlate',
    name: 'Rusty Iron Plate',
    blurb: 'Heavy, weak at the welds, free-ish.',
    category: 'structure',
    w: 1, h: 1, mass: 38, cd: 1.1,
    integrity: 26000, crashTolerance: 30, heatTolerance: 1.2, cost: 30,
    attach: ALL,
  },
  steelScaffold: {
    id: 'steelScaffold',
    name: 'Steel Scaffold',
    blurb: 'Construction-site surplus. Lighter and stiffer than the plates.',
    category: 'structure',
    w: 1, h: 1, mass: 22, cd: 0.9,
    integrity: 55000, crashTolerance: 30, heatTolerance: 1.2, cost: 80,
    attach: ALL, unlock: 'fence',
  },
  aluminum: {
    id: 'aluminum',
    name: 'Corrugated Aluminum',
    blurb: 'Barn roofing, riveted into a box. Light and surprisingly tough.',
    category: 'structure',
    w: 1, h: 1, mass: 9, cd: 0.9,
    integrity: 90000, crashTolerance: 20, heatTolerance: 0.8, cost: 150,
    attach: ALL, unlock: 'space',
  },
  bolt: {
    id: 'bolt',
    name: 'Explosive Bolt Ring',
    blurb: 'Blow it and every weld on it lets go. Wire it carefully.',
    category: 'utility',
    w: 1, h: 1, mass: 5, cd: 0.9,
    integrity: 80000, crashTolerance: 20, heatTolerance: 0.8, cost: 50,
    attach: ALL, bolt: true,
  },
  chute: {
    id: 'chute',
    name: 'Bedsheet Parachute',
    blurb: 'Queen-size, stitched to a laundry bag. Deploy it slow and low.',
    category: 'utility',
    w: 1, h: 1, mass: 9, cd: 0.9,
    integrity: 30000, crashTolerance: 20, heatTolerance: 0.5, cost: 100,
    attach: BASE_ONLY, chute: { area: 70 },
  },
  noseCone: {
    id: 'noseCone',
    name: 'Traffic Cone Nose',
    blurb: 'Pointy end first. Cuts drag and shrugs off re-entry.',
    category: 'utility',
    w: 1, h: 1, mass: 4, cd: 0.25,
    integrity: 30000, crashTolerance: 20, heatTolerance: 3, cost: 50,
    attach: BASE_ONLY,
  },
  fin: {
    id: 'fin',
    name: 'Barn Door Fin',
    blurb: 'Hinged barn door. Keeps the pointy end forward and steers in air.',
    category: 'utility',
    w: 1, h: 1, mass: 12, cd: 0.4,
    integrity: 26000, crashTolerance: 16, heatTolerance: 0.5, cost: 60,
    attach: [false, false, false, true], fin: { area: 1.2 },
  },
  gyro: {
    id: 'gyro',
    name: 'Washing Machine Gyro',
    blurb: 'Spin cycle on max. Turns the craft even in vacuum.',
    category: 'utility',
    w: 1, h: 1, mass: 30, cd: 1.0,
    integrity: 50000, crashTolerance: 18, heatTolerance: 0.8, cost: 800,
    attach: ALL, unlock: 'sonic', gyro: { torque: 4000 },
  },
  guidance: {
    id: 'guidance',
    name: 'Guidance Computer',
    blurb: 'A pawn-shop laptop running a pirated SAS. Hold-steady and hold-prograde.',
    category: 'utility',
    w: 1, h: 1, mass: 8, cd: 1.0,
    integrity: 40000, crashTolerance: 10, heatTolerance: 0.6, cost: 1500,
    attach: ALL, unlock: 'space', guidance: true,
  },
  timer: {
    id: 'timer',
    name: 'Kitchen Timer',
    blurb: 'Wire something to START; it dings N seconds later.',
    category: 'utility',
    w: 1, h: 1, mass: 1, cd: 1.0,
    integrity: 30000, crashTolerance: 12, heatTolerance: 0.5, cost: 40,
    attach: ALL, timer: true,
  },
  barometer: {
    id: 'barometer',
    name: 'Barometer Switch',
    blurb: 'Trips when passing its set altitude. Classic chute trigger.',
    category: 'utility',
    w: 1, h: 1, mass: 2, cd: 1.0,
    integrity: 30000, crashTolerance: 12, heatTolerance: 0.5, cost: 120,
    attach: ALL, unlock: 'fence', barometer: true,
  },
  radioSat: {
    id: 'radioSat',
    name: 'Pirate Radio Satellite',
    blurb: 'Illicit payload. Bolt it on, blow the bolt in a stable orbit.',
    category: 'utility',
    w: 1, h: 1, mass: 30, cd: 1.0,
    integrity: 40000, crashTolerance: 6, heatTolerance: 0.5, cost: 0,
    attach: ALL, payload: true,
  },
}

export const PART_ORDER: PartId[] = [
  'lawnChair', 'bathtub',
  'mower', 'sodaKeg', 'firework', 'propaneTorch', 'turbopump',
  'gasCan', 'propaneTank',
  'rustyPlate', 'steelScaffold', 'aluminum',
  'bolt', 'chute', 'noseCone', 'fin', 'timer', 'barometer', 'gyro', 'guidance', 'radioSat',
]

export const G0 = 9.81

export function fuelFlow(e: EngineStats): number {
  return e.thrust / (e.isp * G0)
}

export function wetMass(def: PartDef): number {
  return def.mass + (def.tank?.fuel ?? 0) + (def.engine?.internalFuel ?? 0)
}
