// Repeatable side jobs: the hub always offers three, each checked against
// a finished flight like a contract but paid every time, and replaced when
// done (or passed on). Targets scale off your best altitude so there is
// always something reachable that pays a little better than altitude cash.
import type { FlightOutcome } from './flight'
import { makeRng, type Rng } from './rng'
import { formatAlt } from './format'
import type { Blueprint } from './workshop'

export type JobKind = 'altitude' | 'lowParts' | 'pinpoint' | 'soft' | 'salvage' | 'mach' | 'splash'

export interface Job {
  id: string
  kind: JobKind
  alt: number // m to reach first (0 = no altitude requirement)
  parts?: number // lowParts: max parts on the rig
  dist?: number // pinpoint: max landing distance from the pad, m
  speed?: number // soft: max touchdown speed, m/s
  mach?: number // mach: Mach to hit
  payout: number
}

export const JOB_SLOTS = 3

const MULT: Record<JobKind, number> = {
  altitude: 1.2,
  lowParts: 1.4,
  pinpoint: 1.6,
  soft: 1.3,
  salvage: 1.5,
  mach: 1.2,
  splash: 1.8,
}

function nice(m: number): number {
  const step = m < 2000 ? 100 : m < 20_000 ? 500 : 5000
  return Math.max(step, Math.round(m / step) * step)
}

function payout(kind: JobKind, alt: number, extra = 0): number {
  return Math.round(((80 + 3 * Math.sqrt(Math.max(alt, 300)) + extra) * MULT[kind]) / 25) * 25
}

function makeJob(kind: JobKind, best: number, partCount: number, rng: Rng): Job {
  const base = Math.max(500, best)
  const id = `${kind}-${Math.floor(rng.next() * 1e9).toString(36)}`
  switch (kind) {
    case 'altitude': {
      const alt = nice(base * rng.range(1.0, 1.35))
      return { id, kind, alt, payout: payout(kind, alt) }
    }
    case 'lowParts': {
      const alt = nice(base * rng.range(0.4, 0.7))
      const parts = Math.max(5, Math.round((partCount || 10) * rng.range(0.6, 0.8)))
      return { id, kind, alt, parts, payout: payout(kind, alt) }
    }
    case 'pinpoint': {
      const alt = nice(base * rng.range(0.3, 0.6))
      const dist = Math.round((400 + alt * 0.4) / 50) * 50 // the wind carries a chute a long way
      return { id, kind, alt, dist, payout: payout(kind, alt) }
    }
    case 'soft': {
      const alt = nice(base * rng.range(0.3, 0.6))
      return { id, kind, alt, speed: 5, payout: payout(kind, alt, 60) }
    }
    case 'salvage': {
      const alt = nice(base * rng.range(0.4, 0.7))
      return { id, kind, alt, payout: payout(kind, alt) }
    }
    case 'mach': {
      const mach = best < 2000 ? 0.6 : best < 10_000 ? 1.2 : best < 60_000 ? 2.5 : 4
      const target = Math.round(mach * rng.range(0.9, 1.2) * 10) / 10
      return { id, kind, alt: 0, mach: target, payout: payout(kind, 400 * target * target, 0) }
    }
    case 'splash':
      return { id, kind, alt: 0, payout: payout(kind, Math.max(3000, best * 0.5), 100) }
  }
}

export function jobTitle(j: Job): string {
  switch (j.kind) {
    case 'altitude':
      return `Altitude run: ${formatAlt(j.alt)}`
    case 'lowParts':
      return `Shoestring: ${formatAlt(j.alt)}, ${j.parts} parts`
    case 'pinpoint':
      return 'Land it in the yard'
    case 'soft':
      return 'Featherweight landing'
    case 'salvage':
      return 'Waste not'
    case 'mach':
      return `Speed trap: Mach ${j.mach!.toFixed(1)}`
    case 'splash':
      return 'Go fishing'
  }
}

export function jobBrief(j: Job): string {
  switch (j.kind) {
    case 'altitude':
      return `Get above ${formatAlt(j.alt)}. The bar crowd is taking bets.`
    case 'lowParts':
      return `Reach ${formatAlt(j.alt)} on a rig with ${j.parts} parts or fewer.`
    case 'pinpoint':
      return `Pass ${formatAlt(j.alt)}, then land the pilot alive within ${j.dist} m of the pad.`
    case 'soft':
      return `Pass ${formatAlt(j.alt)}, then touch down alive at ${j.speed} m/s or slower. Two chutes help.`
    case 'salvage':
      return `Pass ${formatAlt(j.alt)} and recover every single part. Chute your dropped stages.`
    case 'mach':
      return `Hit Mach ${j.mach!.toFixed(1)} at any altitude. The county’s new radar wants a reading.`
    case 'splash':
      return 'Splash the pilot down alive in the ocean, at least 3 km downrange. Steer sideways.'
  }
}

export function jobDone(j: Job, o: FlightOutcome, bp: Blueprint): boolean {
  if (o.kind === 'scrubbed') return false
  const s = o.stats
  const high = s.maxAltitude >= j.alt
  const landedAlive = (o.kind === 'landed' || o.kind === 'splashdown') && o.commandSurvived
  switch (j.kind) {
    case 'altitude':
      return high
    case 'lowParts':
      return high && bp.parts.length <= j.parts!
    case 'pinpoint':
      return high && landedAlive && Math.abs(o.downrange) <= j.dist!
    case 'soft':
      return high && landedAlive && o.impactSpeed <= j.speed!
    case 'salvage':
      return high && (o.kind === 'landed' || o.kind === 'splashdown') && o.lost.length === 0
    case 'mach':
      return s.maxMach >= j.mach!
    case 'splash':
      return o.kind === 'splashdown' && o.commandSurvived
  }
}

// Top the board back up to JOB_SLOTS, avoiding duplicate kinds.
// `avoid` keeps a passed-on job's kind from coming straight back.
export function refillJobs(jobs: Job[], best: number, bp: Blueprint, seed: number, avoid?: JobKind): Job[] {
  const rng = makeRng(seed)
  const out = [...jobs]
  const kinds: JobKind[] = ['altitude', 'lowParts', 'pinpoint', 'soft', 'salvage', 'mach']
  if (best >= 5000) kinds.push('splash')
  let guard = 0
  while (out.length < JOB_SLOTS && guard++ < 50) {
    const free = kinds.filter((k) => k !== avoid && !out.some((j) => j.kind === k))
    const pool = free.length > 0 ? free : kinds
    // Always keep a plain "beat your record" run on the board.
    const kind = pool.includes('altitude') ? 'altitude' : pool[rng.int(0, pool.length)]
    out.push(makeJob(kind, best, bp.parts.length, rng))
  }
  return out
}

export function isJob(x: unknown): x is Job {
  const j = x as Job
  return !!j && typeof j.id === 'string' && typeof j.kind === 'string' && j.kind in MULT && typeof j.payout === 'number' && typeof j.alt === 'number'
}
