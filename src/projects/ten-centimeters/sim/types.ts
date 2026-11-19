// The simulation's data model (spec section 2). No React or DOM in sim/:
// newShift() builds a ShiftState, stepShift() advances it, and the action
// functions in shift.ts are what the buttons, keys and floor taps call.
import type { Rng } from '../../../shared/rng'

export type BayId = 'BAY_1' | 'BAY_2' | 'BAY_3' | 'BAY_4' | 'OR_1' | 'WAITING' | 'DISCHARGED'
export const BAYS = ['BAY_1', 'BAY_2', 'BAY_3', 'BAY_4'] as const

export type Condition = 'NORMAL' | 'STALLED_LABOR' | 'FETAL_DISTRESS' | 'PREECLAMPSIA'

export type View = 'FLOOR_VIEW' | 'OR_SURGERY_VIEW' | 'DELIVERY_VIEW'

// What the doctor can carry from the supply station (two at a time).
export type Item = 'pitocin' | 'epidural' | 'magnesium' | 'oxygen'
export const ITEMS: readonly Item[] = ['pitocin', 'epidural', 'magnesium', 'oxygen']

export type Action = 'pitocin' | 'epidural' | 'magnesium' | 'oxygen' | 'reposition' | 'deliver' | 'codeStork'
export const ACTIONS: readonly Action[] = ['pitocin', 'epidural', 'magnesium', 'oxygen', 'reposition', 'deliver', 'codeStork']

// Where the doctor can be sent.
export type Target =
  | { kind: 'bay'; bay: number }
  | { kind: 'supply' }
  | { kind: 'sink' }
  | { kind: 'or' }
  | { kind: 'point'; x: number; y: number }

export type Station = 'bay0' | 'bay1' | 'bay2' | 'bay3' | 'supply' | 'sink' | 'or'

export interface Patient {
  id: string
  name: string
  assignedBay: BayId
  dilation: number // 0..10 cm
  dilationRate: number // cm per second before modifiers
  maternalStress: number // 0..100
  fetalHeartRate: number // bpm; normal 110-160
  fetalOxygen: number // 100..0; drains only while the heart rate is in distress
  condition: Condition // the most urgent of the flags below, for display
  hasEpidural: boolean
  hasPitocin: boolean // a Pitocin drip is running

  // Behind the condition:
  stalled: boolean
  stallAt: number | null // dilation at which labor stalls (if it will)
  distress: boolean
  distressAt: number | null // dilation at which distress starts (if it will)
  distressOnset: number // 0..1: the warning build-up before oxygen starts to drain
  distressLow: boolean // decelerations (low) or a racing heart (high)
  preeclampsia: boolean

  pitocinTime: number // seconds of drip left
  pitocinDoubled: boolean // a second bag while one was running
  magnesiumTime: number
  stabilizeTime: number // oxygen mask or repositioning holding distress off
  repositionCooldown: number
  readyTime: number // seconds spent at 10 cm waiting to deliver
  waitTime: number // seconds spent in triage

  baseFhr: number
  fhrNoise: number
  fhrHistory: number[] // one sample per sim tick, newest last
}

export interface Doctor {
  x: number
  y: number
  targetX: number
  targetY: number
  speed: number // px per second
  currentTask: string // a short label for the HUD
  isScrubbedIn: boolean
  scrubProgress: number // seconds held at the sink
  path: { x: number; y: number }[]
  goal: Target | null
  pending: { bay: number; action: Action } | null // done on arrival
  input: { x: number; y: number } // WASD / arrows, -1..1 each
  hands: Item[]
  at: Station | null // where the doctor is standing, if at a station
  warnedOr: boolean // "scrub in first" already said for this visit to the OR
}

export interface Procedure {
  kind: 'delivery' | 'csection'
  patient: Patient
  elapsed: number // real seconds (the floor runs slowed down meanwhile)
}

export type ToastTone = 'good' | 'warn' | 'bad' | 'info'

export interface Toast {
  id: number
  text: string
  tone: ToastTone
  age: number
}

// Where the shift's points came from, for the end-of-shift scorecard.
export interface Ledger {
  babies: number // stars × POINTS_PER_STAR
  skill: number // mini-game bonus
  codeStork: number
  midwife: number
  transfers: number // negative
  stress: number // negative
  waiting: number // negative
}

// One line per mom on the scorecard.
export interface BabyLog {
  name: string
  how: 'delivery' | 'csection' | 'midwife' | 'transfer'
  stars: number // 0 for midwife and transfer
}

// Moments the UI reacts to with a sound.
export type SimEvent =
  | 'arrival'
  | 'complication'
  | 'critical'
  | 'transfer'
  | 'delivered'
  | 'midwife'
  | 'scrubbed'
  | 'pickup'
  | 'treat'
  | 'denied'
  | 'procedure'

export interface ShiftState {
  shift: number // index into SHIFTS
  timeRemaining: number // seconds
  score: number
  deliveriesCompleted: number
  csections: number
  midwifeDeliveries: number
  complicationsCount: number
  transfers: number
  stars: number[] // per-baby grade (1-3) for doctor deliveries
  ledger: Ledger
  log: BabyLog[]
  activeView: View
  patients: Patient[]
  doctor: Doctor
  procedure: Procedure | null
  spawnTimer: number
  nextId: number
  tickAcc: number // leftover time toward the next 10 Hz vitals tick
  toasts: Toast[]
  events: SimEvent[]
  over: 'complete' | 'sentHome' | null
  rng: Rng
}
