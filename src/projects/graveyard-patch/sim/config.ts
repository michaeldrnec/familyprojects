// Tuning for a night shift: the clock, how fast things drain and refill, and
// the five nights of the week. Every number the sim uses lives here so
// balance changes don't need to touch the rules.

export type Severity = 'P3' | 'P1' | 'P0'
export type GameKind = 'hunt' | 'unravel'

// One night runs 11:00 PM -> 6:00 AM (7 game hours) in NIGHT_SECONDS of real time.
export const NIGHT_SECONDS = 240
const NIGHT_MINUTES = 7 * 60
const START_MINUTE = 23 * 60

// Game minutes since 11:00 PM.
export function clockMinutes(t: number): number {
  return (Math.min(t, NIGHT_SECONDS) / NIGHT_SECONDS) * NIGHT_MINUTES
}

// Real seconds into the night when the clock reads `minutes` past 11:00 PM.
export function atMinute(minutes: number): number {
  return (minutes / NIGHT_MINUTES) * NIGHT_SECONDS
}

// "11:00 PM", "2:35 AM".
export function clockLabel(t: number): string {
  const total = Math.floor(START_MINUTE + clockMinutes(t)) % (24 * 60)
  const h24 = Math.floor(total / 60)
  const m = total % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, '0')} ${h24 >= 12 ? 'PM' : 'AM'}`
}

// Hazards, in game minutes after 11:00 PM.
export const REVIEW_BOMB_AT = atMinute(120) // 1:00 AM
export const PHANTOMS_AT = atMinute(210) // 2:30 AM
export const MERGE_AT = atMinute(300) // 4:00 AM
export const CRASH_AT = atMinute(375) // 5:15 AM

export const REVIEW_BOMB_SECONDS = 28
export const REVIEW_BOMB_RATE = 4

// Stars lost per second for each open ticket, and won back when its patch ships.
export const DRAIN: Record<Severity, number> = { P3: 0.0035, P1: 0.009, P0: 0.022 }
export const RESTORE: Record<Severity, number> = { P3: 0.12, P1: 0.3, P0: 0.5 }
export const PAY: Record<Severity, number> = { P3: 3, P1: 6, P0: 12 }
export const MAX_RATING = 5
export const START_RATING = 4

// Sleep (0 = wide awake, 1 = eyes shut).
export const DOZE_LIMIT = 3 // seconds at 100% before you're out
export const COFFEE_POTENCY = 0.4
export const COFFEE_REFILL = 20
export const COFFEE_JITTERS = 10
export const CRASH_AFTER = 3 // coffees in a row without water
export const CRASH_SECONDS = 30
export const CRASH_MULT = 1.6
export const CRASH_ZONE_MULT = 2
export const WATER_AWAY = 3
export const WATER_COOLDOWN = 6
export const WATER_RELIEF = 0.12
export const WATER_CLEAR_SECONDS = 15
export const SHAKE_RELIEF = 0.03
export const SHAKE_COST = 0.1
export const SHAKE_RECOVER = 0.12
export const CAT_PET_RELIEF = 0.15

// Deploys.
export const DEPLOY_SECONDS = 8
export const HALLUCINATING = 0.8 // sleep above this makes deploys risky
export const MAX_BROKEN_CHANCE = 0.6

export const QUICK_PATCH_FAIL = 0.2

export const STARTING_USERS = 12_000

export interface NightConfig {
  day: string
  // Relative odds of each severity for a new bug report.
  weights: Record<Severity, number>
  games: GameKind[]
  spawnEvery: number // seconds between reports at 11 PM; it shrinks toward 6 AM
  sleepRate: number // sleep gained per second
  coffee: boolean
  reviewBomb: boolean
  phantoms: boolean
  mergeConflict: boolean
  crashZone: boolean
  speed: number // mini-game tempo
  briefing: string[]
}

export const NIGHTS: NightConfig[] = [
  {
    day: 'Monday',
    weights: { P3: 1, P1: 0, P0: 0 },
    games: ['hunt'],
    spawnEvery: 15,
    sleepRate: 1 / 150,
    coffee: false,
    reviewBomb: false,
    phantoms: false,
    mergeConflict: false,
    crashZone: false,
    speed: 1,
    briefing: [
      'P3 visual glitches trickle in. Fix them in Bug Hunt (tap the bugs before they crawl away), then Deploy to ship the patches.',
      'Patches only win back stars once they are deployed.',
      'Getting sleepy? Mash Space (or Shake it off) and splash some water.',
    ],
  },
  {
    day: 'Tuesday',
    weights: { P3: 3, P1: 1.4, P0: 0 },
    games: ['hunt', 'unravel'],
    spawnEvery: 13,
    sleepRate: 1 / 120,
    coffee: true,
    reviewBomb: false,
    phantoms: false,
    mergeConflict: false,
    crashZone: false,
    speed: 1.05,
    briefing: [
      'New: P1 memory leaks drain your rating fast. Some bugs need Spaghetti Unravel: drag the nodes until no wires cross.',
      'New: coffee. Big wake-up, but it gives you the jitters, and three in a row without water means a crash.',
    ],
  },
  {
    day: 'Wednesday',
    weights: { P3: 3, P1: 1.5, P0: 0.35 },
    games: ['hunt', 'unravel'],
    spawnEvery: 12,
    sleepRate: 1 / 110,
    coffee: true,
    reviewBomb: true,
    phantoms: false,
    mergeConflict: false,
    crashZone: false,
    speed: 1.1,
    briefing: [
      'New: P0 server fires. Nothing deploys while one is open, and Quick Patch can’t touch them.',
      'New: at 1:00 AM a streamer finds a glitch live. Fix the streamer bug and its duplicates close with it.',
    ],
  },
  {
    day: 'Thursday',
    weights: { P3: 3, P1: 1.6, P0: 0.4 },
    games: ['hunt', 'unravel'],
    spawnEvery: 11.5,
    sleepRate: 1 / 100,
    coffee: true,
    reviewBomb: true,
    phantoms: true,
    mergeConflict: true,
    crashZone: false,
    speed: 1.15,
    briefing: [
      'New: from 2:30 AM you start hearing pings that aren’t real. The sleepier you are, the more tickets turn out to be imaginary.',
      'New: at 4:00 AM your teammate in Sydney wakes up and pushes to main. Staged patches can turn into merge conflicts, so deploy often.',
    ],
  },
  {
    day: 'Friday',
    weights: { P3: 3, P1: 1.7, P0: 0.45 },
    games: ['hunt', 'unravel'],
    spawnEvery: 11,
    sleepRate: 1 / 95,
    coffee: true,
    reviewBomb: true,
    phantoms: true,
    mergeConflict: true,
    crashZone: true,
    speed: 1.2,
    briefing: [
      'Launch night. Everything at once.',
      'New: the 5 AM Crash Zone. From 5:15 sleep comes twice as fast and the colors drift strange until you splash water.',
    ],
  },
]

// --- Upgrades ---------------------------------------------------------------

export type UpgradeId = 'mouse' | 'espresso' | 'router' | 'cat'

export interface Upgrade {
  id: UpgradeId
  name: string
  icon: string
  cost: number
  blurb: string
}

export const UPGRADES: Upgrade[] = [
  { id: 'mouse', name: 'Precision Mouse', icon: '🖱️', cost: 100, blurb: 'Far fewer sleepy mis-taps in Bug Hunt.' },
  { id: 'espresso', name: 'Espresso Machine', icon: '☕', cost: 140, blurb: 'Stronger coffee, faster refills, milder jitters.' },
  { id: 'router', name: 'Dual-Band Router', icon: '📶', cost: 140, blurb: 'Deploys upload in half the time.' },
  { id: 'cat', name: 'Desk Cat', icon: '🐈', cost: 80, blurb: 'Wanders across the desk. Pet it to perk up. Ignore it and it lies across your screen.' },
]

export const MISTAP_SLEEP = 0.55 // mis-taps start above this much sleep
export const MAX_MISTAP = 0.4
