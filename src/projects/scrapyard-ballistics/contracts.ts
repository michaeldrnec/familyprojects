// Milestone contracts (SPEC.md section 8). Each pays once and opens up
// more of the Black Market. Checked against a finished flight's outcome.
import type { ContractId, PartId } from './parts'
import type { FlightOutcome } from './flight'

export interface ContractDef {
  id: ContractId
  title: string
  brief: string
  payout: number
  requires?: ContractId // hidden until this one is done
  grants?: PartId[] // free parts on completion
  check: (o: FlightOutcome) => boolean
}

export const CONTRACTS: ContractDef[] = [
  {
    id: 'fence',
    title: 'Clear the Fence',
    brief: 'Get anything with a pilot in it above 500 m. The neighbor bet you couldn’t.',
    payout: 400,
    check: (o) => o.stats.maxAltitude >= 500,
  },
  {
    id: 'sonic',
    title: 'Sonic Boom',
    brief: 'Break Mach 1 below 10 km. Rattle the county’s windows.',
    payout: 900,
    requires: 'fence',
    check: (o) => o.stats.sonicLow,
  },
  {
    id: 'home',
    title: 'Bring Her Home',
    brief: 'Climb past 5 km, then land the command seat in one piece.',
    payout: 1200,
    requires: 'fence',
    check: (o) => o.stats.maxAltitude >= 5000 && o.commandSurvived,
  },
  {
    id: 'space',
    title: 'Touch Space',
    brief: 'Cross the 80 km line. Comes with a mysterious crate from the Black Market.',
    payout: 3000,
    requires: 'sonic',
    grants: ['radioSat'],
    check: (o) => o.stats.reachedSpace,
  },
  {
    id: 'radio',
    title: 'Pirate Radio',
    brief: 'Bolt the Radio Satellite on and blow it free in a stable orbit (Pe > 80 km).',
    payout: 7000,
    requires: 'space',
    check: (o) => o.stats.satDelivered,
  },
  {
    id: 'roundTrip',
    title: 'Round Trip',
    brief: 'Make a stable orbit, then come back down and land the pilot alive.',
    payout: 12000,
    requires: 'space',
    check: (o) => o.stats.orbitAchieved && o.commandSurvived,
  },
]

export function contractVisible(c: ContractDef, done: ContractId[]): boolean {
  return !c.requires || done.includes(c.requires)
}
