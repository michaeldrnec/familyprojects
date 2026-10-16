// The daily puzzle (SPEC.md section 11). Built constructively so it is
// always solvable: pick a killer weapon and an impact tick, then add defense
// layers one at a time, each paired with the counter that beats it. The
// resulting plan is simulated (it must win, cleanly, on the planned tick) and
// then brute-forced: if any plan of two or fewer actions also wins, the
// puzzle is too easy and the next sub-seed is tried.
import { colTarget } from './defenses'
import { LEVELS } from './levels'
import { makeRng, type Rng } from './rng'
import { planEnergy, simulate } from './sim'
import { findWin } from './solver'
import type { Action, Level, PdcPriority, StructureDef } from './types'
import { basePlatform } from './upgrades'

const WIDTH = 7
const MAX_ATTEMPTS = 50

// YYYYMMDD in local time.
export function dateKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

export function isDateKey(s: string) {
  return /^\d{8}$/.test(s)
}

export function prettyDate(key: string) {
  return `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6)}`
}

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[rng.int(0, items.length)]
}

const PLACES = ['Vesta', 'Ceres', 'Hygiea', 'Pallas', 'Juno', 'Iris', 'Flora', 'Metis', 'Hebe', 'Astraea', 'Eunomia', 'Psyche']
const SUFFIXES = ['Outpost', 'Bastion', 'Redoubt', 'Spire', 'Hold', 'Citadel', 'Array', 'Foundry']

interface Draft {
  level: Level
  cost: number
}

function build(key: string, rng: Rng): Draft | null {
  const structures: StructureDef[] = []
  const used = new Set<number>()
  const solution: Action[] = []
  const level: Level = {
    id: `D${key}`,
    name: `${pick(rng, PLACES)} ${pick(rng, SUFFIXES)}`,
    brief: 'Today’s fortress, generated for everyone at once. Guaranteed solvable, and never in two moves.',
    sector: 3,
    width: WIDTH,
    ticks: 6,
    parTick: 4,
    structures,
    pdcs: [],
    shields: [],
    objectives: [],
    solution,
  }
  const freeCol = (avoid: (c: number) => boolean = () => false) => {
    const cols = Array.from({ length: WIDTH }, (_, c) => c).filter((c) => !used.has(c) && !avoid(c))
    if (!cols.length) return null
    const c = pick(rng, cols)
    used.add(c)
    return c
  }

  // 1. The kill.
  const killer = pick(rng, ['lance', 'lance', 'missile', 'missile', 'thermo'] as const)
  const cc = rng.int(1, WIDTH - 1)
  if (killer === 'thermo') {
    for (const [i, c] of [cc - 1, cc, cc + 1].entries()) {
      structures.push({ id: `h${i}`, kind: 'hangar', name: `Drone Hangar ${'ABC'[i]}`, col: c, armor: 'light' })
      level.objectives.push(`h${i}`)
      used.add(c)
    }
  } else {
    structures.push({ id: 'core', kind: 'core', name: 'Sentinel Core', col: cc, armor: killer === 'lance' ? 'hardened' : 'medium' })
    level.objectives.push('core')
    used.add(cc)
  }
  const transit = killer === 'lance' ? 3 : 2
  const arrive = killer === 'lance' ? rng.int(4, 6) : rng.int(3, 5)
  const fire = arrive - transit

  // Ion field first: it decides where a missile has to be aimed.
  let aim = cc
  const wantField = rng.next() < (killer === 'missile' ? 0.6 : 0.25)
  if (wantField) {
    const drift = rng.next() < 0.5 ? -1 : 1
    level.field = { kind: 'ion', drift }
    if (killer === 'missile') {
      aim = cc - drift
      if (aim < 0 || aim >= WIDTH) return null
      // A protected site right where an un-corrected missile would land.
      const trap = cc + drift
      if (trap >= 0 && trap < WIDTH && !used.has(trap) && rng.next() < 0.7) {
        used.add(trap)
        structures.push({ id: 'site', kind: 'site', name: pick(rng, ['Old Ruins', 'Seed Vault', 'Crater Preserve']), col: trap, armor: 'light', hard: rng.next() < 0.3 })
      }
    }
  }
  solution.push({ w: killer, tick: fire, target: colTarget(aim) })

  // 2. Defense layers, each with its counter. At least two of them.
  const layers = (['shield', 'pdc', 'battery'] as const).filter(() => rng.next() < 0.75)
  if (layers.length < 2) return null

  if (layers.includes('shield')) {
    const from = Math.max(0, Math.min(cc, aim) - (killer === 'thermo' ? 1 : rng.int(0, 2)))
    const to = Math.min(WIDTH - 1, Math.max(cc, aim) + (killer === 'thermo' ? 1 : rng.int(0, 2)))
    const genCol = freeCol((c) => c >= from && c <= to)
    if (genCol === null) return null
    structures.push({ id: 'gen', kind: 'generator', name: 'Shield Generator', col: genCol, armor: rng.next() < 0.6 ? 'hardened' : 'medium' })
    level.shields.push({ id: 'dome', name: 'Kinetic Dome', from, to, strength: killer === 'lance' ? rng.int(2, 4) : rng.int(1, 4), power: 'gen' })
    // EMP the generator so its 2-tick window covers the impact.
    const empArrive = arrive - rng.int(0, 2)
    if (empArrive - 1 < 1) return null
    solution.push({ w: 'emp', tick: empArrive - 1, target: colTarget(genCol) })
  }

  if (layers.includes('pdc')) {
    const armored = rng.next() < 0.65
    const lo = Math.max(0, aim - rng.int(1, 4))
    const hi = Math.min(WIDTH - 1, aim + rng.int(1, 4))
    const priority = pick(rng, ['mass', 'nearest', 'first'] as PdcPriority[])
    level.pdcs.push({ id: 'pdcA', name: armored ? 'Armored PDC' : 'PDC Alpha', col: aim, zone: [lo, hi], priority, armored })
    if (armored) {
      // Chaff blinds its landing tick and the next: cover the whole flight.
      const chaffFire = killer === 'lance' ? fire : fire - rng.int(0, 2)
      if (chaffFire < 1) return null
      solution.push({ w: 'chaff', tick: chaffFire, target: colTarget(aim) })
    } else {
      solution.push({ w: 'laser', tick: rng.int(1, fire + 1), target: 'pdcA' })
    }
  }

  if (layers.includes('battery')) {
    const dome = level.shields[0]
    const col = freeCol((c) => !!dome && c >= dome.from && c <= dome.to)
    if (col === null) return null
    const fireAt = rng.int(2, arrive)
    structures.push({ id: 'bat', kind: 'battery', name: pick(rng, ['Spike Battery', 'Rail Battery', 'Mass Driver']), col, armor: 'light', fireAt })
    solution.push({ w: 'laser', tick: rng.int(1, fireAt + 1), target: colTarget(col) })
  }

  // 3. Some scenery: a mast that powers nothing, maybe a protected site.
  if (rng.next() < 0.5) {
    const col = freeCol()
    if (col !== null) structures.push({ id: 'mast', kind: 'relay', name: 'Comms Mast', col, armor: 'light' })
  }
  if (!structures.some((s) => s.kind === 'site') && rng.next() < 0.5) {
    const col = freeCol()
    if (col !== null) structures.push({ id: 'site', kind: 'site', name: pick(rng, ['Old Ruins', 'Seed Vault', 'Crater Preserve']), col, armor: 'light', hard: rng.next() < 0.3 })
  }

  // 4. Budgets with a little slack.
  const cost = planEnergy(solution)
  level.energy = Math.ceil((cost * (1.1 + rng.next() * 0.1)) / 5) * 5
  level.ticks = Math.min(8, arrive + rng.int(1, 3))
  level.parTick = arrive
  level.minimalist = cost
  solution.sort((a, b) => a.tick - b.tick)
  return { level, cost }
}

function verify(draft: Draft): boolean {
  const { level } = draft
  const platform = basePlatform(level)
  const r = simulate(level, level.solution, platform, true)
  if (r.outcome !== 'win' || r.collateral > 0 || r.winTick !== level.parTick) return false
  return findWin(level, platform, 2) === null
}

function seedFor(key: string, attempt: number) {
  let h = 2166136261 ^ attempt
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

const BACKUP_NAME = 'Caldera Rerun'
const cache = new Map<string, Level>()

export function isBackupDaily(level: Level) {
  return level.name === BACKUP_NAME
}

export function generateDaily(key: string): Level {
  const hit = cache.get(key)
  if (hit) return hit
  let level: Level | null = null
  for (let attempt = 0; attempt < MAX_ATTEMPTS && !level; attempt++) {
    const draft = build(key, makeRng(seedFor(key, attempt)))
    if (draft && verify(draft)) level = draft.level
  }
  // Backup: the Caldera Fortress, renamed for the day.
  if (!level) {
    const backup = LEVELS.find((l) => l.id === '3-2')!
    level = { ...backup, id: `D${key}`, name: BACKUP_NAME }
  }
  cache.set(key, level)
  return level
}
