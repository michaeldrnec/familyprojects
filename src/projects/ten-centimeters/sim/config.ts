// Every tuning number for 10 Centimeters, and the five shifts.

// A 12-hour night shift (7 PM to 7 AM) in five real minutes.
export const SHIFT_SECONDS = 300
export const TICK = 0.1 // vitals update at 10 Hz

// While the doctor is busy with a delivery or a C-section, the rest of the
// floor keeps going at this fraction of normal speed.
export const PROCEDURE_SLOWDOWN = 0.25

// Labor
export const ARRIVE_DILATION: [number, number] = [3, 6]
export const DILATION_RATE: [number, number] = [0.05, 0.1] // cm/s: ~60-140 s to 10 cm
export const PITOCIN_MULT = 2
export const PITOCIN_SECONDS = 45
export const EPIDURAL_RATE_MULT = 0.85
export const EPIDURAL_LATEST = 8 // cm; too late for an epidural after this
export const STALL_MULT = 0.08
export const STALL_RANGE: [number, number] = [4.5, 7.5]
export const WAITING_RATE_MULT = 0.6
export const MAX_WAITING = 3

// Mother's stress
export const START_STRESS: [number, number] = [15, 35]
export const PAIN_STRESS = 0.2 // per second, plus PAIN_STRESS_DILATION × dilation/10
export const PAIN_STRESS_DILATION = 0.45
export const EPIDURAL_STRESS_CAP = 30
export const EPIDURAL_PAIN_MULT = 0.3
export const WAITING_STRESS = 0.8
export const PREECLAMPSIA_STRESS = 1.1
export const MAGNESIUM_MULT = 0.4
export const MAGNESIUM_RELIEF = 35
export const MAGNESIUM_SECONDS = 45
export const HIGH_STRESS = 80

// Baby's heart rate and oxygen
export const FHR_NORMAL: [number, number] = [110, 160]
export const FHR_LOW = 100 // below this, or above FHR_HIGH, oxygen drains
export const FHR_HIGH = 180
export const FHR_BASE: [number, number] = [125, 150]
export const DISTRESS_RANGE: [number, number] = [4, 9.5]
export const DISTRESS_ONSET_SECONDS = 6 // the yellow warning before red
export const OXYGEN_DRAIN = 2 // per second in distress: 50 s from full
export const OXYGEN_RECOVER = 0.4
export const OXYGEN_MASK_SECONDS = 25
export const REPOSITION_SECONDS = 10
export const REPOSITION_COOLDOWN = 20
export const PITOCIN_DISTRESS_HAZARD = 0.003 // per second while a drip runs
export const DOUBLE_PITOCIN_HAZARD = 0.015 // per second after doubling up
export const FHR_HISTORY = 200 // samples kept (20 s)

// Delivery
export const MIDWIFE_AFTER = 25 // seconds at 10 cm before the midwife delivers instead
export const POINTS_PER_STAR = 100
export const CSECTION_BONUS = 50
export const SKILL_BONUS = 50 // up to this many points for a well-played mini-game
export const MIDWIFE_POINTS = 40
export const TRANSFER_PENALTY = 150
export const MAX_TRANSFERS = 3
export const HIGH_STRESS_PENALTY = 1 // points per second per patient above HIGH_STRESS
export const WAITING_PENALTY = 0.5 // points per second per patient in triage

// The doctor
export const DOCTOR_SPEED = 280
export const SCRUB_SECONDS = 1.5
export const HANDS = 2

export interface ShiftConfig {
  name: string
  startPatients: number
  spawnEvery: [number, number] // seconds between arrivals
  stallChance: number // per patient
  distressChance: number // per patient (0 = no distress this shift)
  preeclampsiaChance: number // per patient
  codeStork: boolean
  stars: [number, number, number] // score for 1, 2, 3 stars
  briefing: string[]
}

export const SHIFTS: ShiftConfig[] = [
  {
    name: 'First Night',
    startPatients: 2,
    spawnEvery: [34, 44],
    stallChance: 0.4,
    distressChance: 0,
    preeclampsiaChance: 0,
    codeStork: false,
    stars: [900, 1500, 2200],
    briefing: [
      'Walk to a bay and deliver each baby when Mom reaches 10 cm.',
      'Some labors stall. Fetch Pitocin from Supply to get things moving.',
      'An epidural keeps Mom comfortable, but only before 8 cm.',
    ],
  },
  {
    name: 'Heartbeats',
    startPatients: 2,
    spawnEvery: [32, 42],
    stallChance: 0.3,
    distressChance: 0.3,
    preeclampsiaChance: 0,
    codeStork: true,
    stars: [900, 1600, 2300],
    briefing: [
      'Watch the heart rate strips. Red means baby needs help now.',
      'An oxygen mask or repositioning buys time. Too much Pitocin causes trouble.',
      'Call a Code Stork for a C-section: scrub in at the sink, then go to the OR.',
    ],
  },
  {
    name: 'Pressure',
    startPatients: 2,
    spawnEvery: [30, 40],
    stallChance: 0.3,
    distressChance: 0.3,
    preeclampsiaChance: 0.25,
    codeStork: true,
    stars: [1000, 1700, 2500],
    briefing: [
      'Preeclampsia makes Mom’s stress climb fast, and an epidural won’t stop it.',
      'Magnesium from Supply calms it down for a while.',
      'If her stress hits 100, the baby goes into distress.',
    ],
  },
  {
    name: 'Full Moon',
    startPatients: 3,
    spawnEvery: [24, 32],
    stallChance: 0.3,
    distressChance: 0.35,
    preeclampsiaChance: 0.25,
    codeStork: true,
    stars: [1300, 2200, 3200],
    briefing: ['Everyone picked tonight. More moms, arriving faster.', 'Keep triage moving: waiting moms get stressed.'],
  },
  {
    name: 'Code Stork',
    startPatients: 3,
    spawnEvery: [20, 28],
    stallChance: 0.35,
    distressChance: 0.45,
    preeclampsiaChance: 0.35,
    codeStork: true,
    stars: [1400, 2400, 3500],
    briefing: ['The busiest night of the year. Everything, all at once.', 'Plan your trips to Supply. Two hands, four bays.'],
  },
]

// "7:00 PM" .. "7:00 AM" for the time left.
export function clockLabel(timeRemaining: number): string {
  const elapsed = Math.min(1, Math.max(0, 1 - timeRemaining / SHIFT_SECONDS))
  const minutes = Math.floor(elapsed * 12 * 60)
  const total = 19 * 60 + minutes
  const h24 = Math.floor(total / 60) % 24
  const m = total % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`
}
