// The rules of one shift, with no React or DOM: newShift() builds the state,
// stepShift() advances it (doctor movement every frame, vitals at a fixed
// 10 Hz), and the functions below it are what the floor taps, buttons and
// keys call. Randomness comes from a seeded rng, so a shift (and the balance
// tests in shift.test.ts) can be replayed exactly.
import { makeRng } from '../../../shared/rng'
import { MESSAGES, NAMES, REASONS } from '../content'
import * as C from './config'
import { clampToFloor, findPath, isWalkable, nearStation, SPOTS, START } from './floor'
import {
  BAYS,
  type Action,
  type BabyLog,
  type Condition,
  type Item,
  type Ledger,
  type Patient,
  type ShiftState,
  type SimEvent,
  type Station,
  type Target,
  type ToastTone,
} from './types'

export function cfg(s: ShiftState): C.ShiftConfig {
  return C.SHIFTS[s.shift]
}

export function newShift(shift: number, seed: number): ShiftState {
  const s: ShiftState = {
    shift: Math.min(C.SHIFTS.length - 1, Math.max(0, shift)),
    timeRemaining: C.SHIFT_SECONDS,
    score: 0,
    deliveriesCompleted: 0,
    csections: 0,
    midwifeDeliveries: 0,
    complicationsCount: 0,
    transfers: 0,
    stars: [],
    ledger: { babies: 0, skill: 0, codeStork: 0, midwife: 0, transfers: 0, stress: 0, waiting: 0 },
    log: [],
    activeView: 'FLOOR_VIEW',
    patients: [],
    doctor: {
      x: START.x,
      y: START.y,
      targetX: START.x,
      targetY: START.y,
      speed: C.DOCTOR_SPEED,
      currentTask: 'Ready',
      isScrubbedIn: false,
      scrubProgress: 0,
      path: [],
      goal: null,
      pending: null,
      input: { x: 0, y: 0 },
      hands: [],
      at: null,
      warnedOr: false,
    },
    procedure: null,
    spawnTimer: 0,
    nextId: 1,
    tickAcc: 0,
    toasts: [],
    events: [],
    over: null,
    rng: makeRng(seed),
  }
  const c = cfg(s)
  for (let i = 0; i < c.startPatients; i++) {
    const p = newPatient(s)
    p.assignedBay = BAYS[i]
    // Starting patients are a little further along, so the first baby comes soon.
    p.dilation = Math.min(8, p.dilation + i * 1.2)
    s.patients.push(p)
  }
  s.spawnTimer = s.rng.range(c.spawnEvery[0], c.spawnEvery[1]) * 0.5
  return s
}

function newPatient(s: ShiftState): Patient {
  const { rng } = s
  const c = cfg(s)
  const taken = new Set(s.patients.map((p) => p.name))
  const free = NAMES.filter((n) => !taken.has(n))
  const name = free[rng.int(0, free.length)] ?? NAMES[rng.int(0, NAMES.length)]
  const dilation = rng.range(C.ARRIVE_DILATION[0], C.ARRIVE_DILATION[1])
  const stallFrom = Math.max(dilation + 0.5, C.STALL_RANGE[0])
  const stallAt = rng.next() < c.stallChance && stallFrom < C.STALL_RANGE[1] ? rng.range(stallFrom, C.STALL_RANGE[1]) : null
  const distressFrom = Math.max(dilation + 0.3, C.DISTRESS_RANGE[0])
  const distressAt = rng.next() < c.distressChance ? rng.range(distressFrom, C.DISTRESS_RANGE[1]) : null
  const preeclampsia = rng.next() < c.preeclampsiaChance
  const baseFhr = rng.range(C.FHR_BASE[0], C.FHR_BASE[1])
  // A calm trace from before she arrived, so her strip starts full.
  const fhrHistory: number[] = []
  let fhr = baseFhr
  for (let i = 0; i < C.FHR_HISTORY; i++) {
    fhr += (baseFhr - fhr) * 0.15 + rng.range(-1, 1) * 1.5
    fhrHistory.push(fhr)
  }
  return {
    id: `p${s.nextId++}`,
    name,
    assignedBay: 'WAITING',
    dilation,
    dilationRate: rng.range(C.DILATION_RATE[0], C.DILATION_RATE[1]),
    maternalStress: rng.range(C.START_STRESS[0], C.START_STRESS[1]),
    fetalHeartRate: baseFhr,
    fetalOxygen: 100,
    condition: preeclampsia ? 'PREECLAMPSIA' : 'NORMAL',
    hasEpidural: false,
    hasPitocin: false,
    stalled: false,
    stallAt,
    distress: false,
    distressAt,
    distressOnset: 0,
    distressLow: true,
    preeclampsia,
    pitocinTime: 0,
    pitocinDoubled: false,
    magnesiumTime: 0,
    stabilizeTime: 0,
    repositionCooldown: 0,
    readyTime: 0,
    waitTime: 0,
    baseFhr,
    fhrNoise: 0,
    fhrHistory,
  }
}

// --- Lookups -------------------------------------------------------------------

export function patientInBay(s: ShiftState, bay: number): Patient | undefined {
  return s.patients.find((p) => p.assignedBay === BAYS[bay])
}

export function orPatient(s: ShiftState): Patient | undefined {
  return s.patients.find((p) => p.assignedBay === 'OR_1')
}

export function waitingPatients(s: ShiftState): Patient[] {
  return s.patients.filter((p) => p.assignedBay === 'WAITING')
}

export function bayIndex(p: Patient): number {
  return (BAYS as readonly string[]).indexOf(p.assignedBay)
}

export type Status = 'normal' | 'warning' | 'critical' | 'ready'

// What the heart rate strip and the floor glow show for a patient.
export function patientStatus(p: Patient): Status {
  if (p.distress && p.stabilizeTime <= 0 && p.distressOnset >= 1) return 'critical'
  if (p.dilation >= 10) return 'ready'
  if (p.distress || p.stalled || p.preeclampsia || p.maternalStress >= C.HIGH_STRESS) return 'warning'
  return 'normal'
}

function deriveCondition(p: Patient): Condition {
  if (p.distress) return 'FETAL_DISTRESS'
  if (p.preeclampsia) return 'PREECLAMPSIA'
  if (p.stalled) return 'STALLED_LABOR'
  return 'NORMAL'
}

export function itemAvailable(s: ShiftState, item: Item): boolean {
  if (item === 'magnesium') return cfg(s).preeclampsiaChance > 0
  if (item === 'oxygen') return cfg(s).distressChance > 0
  return true
}

export function actionAvailable(s: ShiftState, action: Action): boolean {
  if (action === 'magnesium') return itemAvailable(s, 'magnesium')
  if (action === 'oxygen' || action === 'reposition') return itemAvailable(s, 'oxygen')
  if (action === 'codeStork') return cfg(s).codeStork
  return true
}

// --- Messages ------------------------------------------------------------------

let toastId = 0

function toast(s: ShiftState, text: string, tone: ToastTone) {
  s.toasts.push({ id: ++toastId, text, tone, age: 0 })
  if (s.toasts.length > 4) s.toasts.shift()
}

function emit(s: ShiftState, ev: SimEvent) {
  s.events.push(ev)
}

// --- The main step ---------------------------------------------------------------

export function stepShift(s: ShiftState, dt: number) {
  if (s.over) return
  for (const t of s.toasts) t.age += dt
  s.toasts = s.toasts.filter((t) => t.age < 5)

  let worldDt = dt
  if (s.procedure) {
    s.procedure.elapsed += dt
    worldDt = dt * C.PROCEDURE_SLOWDOWN
  } else {
    moveDoctor(s, dt)
    updateStations(s, dt)
  }

  s.timeRemaining = Math.max(0, s.timeRemaining - worldDt)
  s.tickAcc += worldDt
  while (s.tickAcc >= C.TICK && !s.over) {
    s.tickAcc -= C.TICK
    tick(s)
  }
  if (!s.over && s.timeRemaining <= 0 && !s.procedure) s.over = 'complete'
}

function tick(s: ShiftState) {
  const c = cfg(s)
  s.spawnTimer -= C.TICK
  if (s.spawnTimer <= 0) {
    if (waitingPatients(s).length < C.MAX_WAITING) {
      const p = newPatient(s)
      s.patients.push(p)
      emit(s, 'arrival')
      toast(s, MESSAGES.arrival(p.name), 'info')
      if (p.preeclampsia) {
        s.complicationsCount++
        emit(s, 'complication')
      }
      s.spawnTimer = s.rng.range(c.spawnEvery[0], c.spawnEvery[1])
    } else {
      s.spawnTimer = 5
    }
  }

  // The nurses move the longest-waiting patient into any free bay.
  for (let bay = 0; bay < BAYS.length; bay++) {
    if (patientInBay(s, bay)) continue
    const next = waitingPatients(s)[0]
    if (!next) break
    next.assignedBay = BAYS[bay]
    toast(s, MESSAGES.toBay(next.name, bay + 1), 'info')
    if (next.preeclampsia) toast(s, MESSAGES.preeclampsia(next.name), 'warn')
  }

  for (const p of [...s.patients]) tickPatient(s, p)

  for (const p of s.patients) {
    if (p.maternalStress >= C.HIGH_STRESS) {
      s.score -= C.HIGH_STRESS_PENALTY * C.TICK
      s.ledger.stress -= C.HIGH_STRESS_PENALTY * C.TICK
    }
    if (p.assignedBay === 'WAITING') {
      s.score -= C.WAITING_PENALTY * C.TICK
      s.ledger.waiting -= C.WAITING_PENALTY * C.TICK
    }
  }
}

function startDistress(s: ShiftState, p: Patient, instant: boolean) {
  p.distress = true
  p.distressAt = null
  p.distressOnset = instant ? 1 : 0
  p.distressLow = s.rng.next() < 0.65
  s.complicationsCount++
  emit(s, 'complication')
  if (instant) emit(s, 'critical')
  toast(s, instant ? MESSAGES.crisis(p.name) : MESSAGES.distress(p.name), 'bad')
}

function tickPatient(s: ShiftState, p: Patient) {
  const dt = C.TICK
  const c = cfg(s)
  const waiting = p.assignedBay === 'WAITING'
  const inProcedure = s.procedure?.patient === p

  p.pitocinTime = Math.max(0, p.pitocinTime - dt)
  if (p.pitocinTime <= 0) {
    p.hasPitocin = false
    p.pitocinDoubled = false
  }
  p.magnesiumTime = Math.max(0, p.magnesiumTime - dt)
  p.stabilizeTime = Math.max(0, p.stabilizeTime - dt)
  p.repositionCooldown = Math.max(0, p.repositionCooldown - dt)
  if (waiting) p.waitTime += dt

  // Dilation
  if (p.dilation < 10) {
    let rate = p.dilationRate
    if (p.hasPitocin) rate *= C.PITOCIN_MULT
    if (p.hasEpidural) rate *= C.EPIDURAL_RATE_MULT
    if (p.stalled) rate *= C.STALL_MULT
    if (waiting) rate *= C.WAITING_RATE_MULT
    p.dilation = Math.min(10, p.dilation + rate * dt)
    if (p.dilation >= 10) {
      p.stalled = false
      p.stallAt = null
      if (!waiting && !inProcedure) toast(s, MESSAGES.ready(p.name), 'good')
    }
  }

  // Complications start once she's in a bay.
  if (!waiting && p.assignedBay !== 'OR_1') {
    if (p.stallAt !== null && p.dilation >= p.stallAt) {
      p.stallAt = null
      // A running Pitocin drip carries her past the stall.
      if (!p.hasPitocin) {
        p.stalled = true
        s.complicationsCount++
        emit(s, 'complication')
        toast(s, MESSAGES.stalled(p.name), 'warn')
      }
    }
    if (!p.distress && p.distressAt !== null && p.dilation >= p.distressAt) startDistress(s, p, false)
    if (!p.distress && p.hasPitocin && c.distressChance > 0) {
      const hazard = p.pitocinDoubled ? C.DOUBLE_PITOCIN_HAZARD : C.PITOCIN_DISTRESS_HAZARD
      if (s.rng.next() < hazard * dt) startDistress(s, p, false)
    }
  }

  // Mother's stress
  let rise = C.PAIN_STRESS + (C.PAIN_STRESS_DILATION * p.dilation) / 10
  if (p.hasEpidural) rise *= C.EPIDURAL_PAIN_MULT
  if (waiting) rise += C.WAITING_STRESS
  if (p.preeclampsia) rise += C.PREECLAMPSIA_STRESS * (p.magnesiumTime > 0 ? C.MAGNESIUM_MULT : 1)
  if (p.hasEpidural && !p.preeclampsia) {
    p.maternalStress = p.maternalStress > C.EPIDURAL_STRESS_CAP ? Math.max(C.EPIDURAL_STRESS_CAP, p.maternalStress - 4 * dt) : Math.min(C.EPIDURAL_STRESS_CAP, p.maternalStress + rise * dt)
  } else {
    p.maternalStress += rise * dt
  }
  p.maternalStress = Math.min(100, Math.max(0, p.maternalStress))
  if (p.preeclampsia && p.maternalStress >= 100 && !p.distress && !waiting) startDistress(s, p, true)

  // Baby's heart rate
  const active = p.distress && p.stabilizeTime <= 0
  if (active && p.distressOnset < 1) {
    p.distressOnset = Math.min(1, p.distressOnset + dt / C.DISTRESS_ONSET_SECONDS)
    if (p.distressOnset >= 1) emit(s, 'critical')
  }
  const jitter = p.distress || p.stalled ? 3 : 1.2
  p.fhrNoise = p.fhrNoise * 0.9 + s.rng.range(-1, 1) * jitter
  let target = p.baseFhr
  if (active) {
    const t = C.SHIFT_SECONDS - s.timeRemaining
    const bad = p.distressLow ? 86 - 10 * Math.max(0, Math.sin(t * 0.9)) : 190
    target = p.baseFhr + (bad - p.baseFhr) * (p.distressOnset >= 1 ? 1 : p.distressOnset * 0.5)
  }
  p.fetalHeartRate += (target - p.fetalHeartRate) * 0.15 + p.fhrNoise * 0.35
  p.fetalHeartRate = Math.min(210, Math.max(60, p.fetalHeartRate))
  p.fhrHistory.push(p.fetalHeartRate)
  if (p.fhrHistory.length > C.FHR_HISTORY) p.fhrHistory.shift()

  // Baby's oxygen drains only while the heart rate is out of range, once
  // the warning has turned critical (red).
  const outOfRange = p.fetalHeartRate < C.FHR_LOW || p.fetalHeartRate > C.FHR_HIGH
  if (outOfRange && active && p.distressOnset >= 1) p.fetalOxygen -= C.OXYGEN_DRAIN * dt
  else p.fetalOxygen = Math.min(100, p.fetalOxygen + C.OXYGEN_RECOVER * dt)
  if (inProcedure) p.fetalOxygen = Math.max(5, p.fetalOxygen)

  p.condition = deriveCondition(p)

  if (p.fetalOxygen <= 0) {
    transfer(s, p)
    return
  }

  if (p.dilation >= 10 && !inProcedure && bayIndex(p) >= 0) {
    p.readyTime += dt
    if (p.readyTime >= C.MIDWIFE_AFTER) {
      removePatient(s, p)
      s.score += C.MIDWIFE_POINTS
      s.ledger.midwife += C.MIDWIFE_POINTS
      s.log.push({ name: p.name, how: 'midwife', stars: 0 })
      s.midwifeDeliveries++
      emit(s, 'midwife')
      toast(s, MESSAGES.midwife(p.name), 'warn')
    }
  }
}

function removePatient(s: ShiftState, p: Patient) {
  const bay = bayIndex(p)
  p.assignedBay = 'DISCHARGED'
  s.patients = s.patients.filter((q) => q !== p)
  if (s.doctor.pending && s.doctor.pending.bay === bay) s.doctor.pending = null
}

function transfer(s: ShiftState, p: Patient) {
  removePatient(s, p)
  s.transfers++
  s.score -= C.TRANSFER_PENALTY
  s.ledger.transfers -= C.TRANSFER_PENALTY
  s.log.push({ name: p.name, how: 'transfer', stars: 0 })
  emit(s, 'transfer')
  toast(s, MESSAGES.transfer(p.name), 'bad')
  if (s.transfers >= C.MAX_TRANSFERS) s.over = 'sentHome'
}

// --- The doctor ----------------------------------------------------------------

function moveDoctor(s: ShiftState, dt: number) {
  const d = s.doctor
  const len = Math.hypot(d.input.x, d.input.y)
  if (len > 0) {
    d.path = []
    d.goal = null
    d.pending = null
    const step = (d.speed * dt) / len
    const nx = d.x + d.input.x * step
    const ny = d.y + d.input.y * step
    if (isWalkable(nx, ny)) {
      d.x = nx
      d.y = ny
    } else if (isWalkable(nx, d.y)) {
      d.x = nx
    } else if (isWalkable(d.x, ny)) {
      d.y = ny
    }
  } else if (d.path.length) {
    let step = d.speed * dt
    while (step > 0 && d.path.length) {
      const wp = d.path[0]
      const dist = Math.hypot(wp.x - d.x, wp.y - d.y)
      if (dist <= step) {
        d.x = wp.x
        d.y = wp.y
        step -= dist
        d.path.shift()
      } else {
        d.x += ((wp.x - d.x) / dist) * step
        d.y += ((wp.y - d.y) / dist) * step
        step = 0
      }
    }
    if (!d.path.length) d.goal = null
  }
  const last = d.path[d.path.length - 1]
  d.targetX = last?.x ?? d.x
  d.targetY = last?.y ?? d.y
}

function isMoving(s: ShiftState) {
  const d = s.doctor
  return d.path.length > 0 || d.input.x !== 0 || d.input.y !== 0
}

// Things that happen because of where the doctor is standing.
function updateStations(s: ShiftState, dt: number) {
  const d = s.doctor
  const at = isMoving(s) && d.path.length > 0 ? null : nearStation(d.x, d.y)
  d.at = at

  // Scrubbing in: stand at the sink.
  if (at === 'sink' && !d.isScrubbedIn && !isMoving(s)) {
    d.scrubProgress += dt
    if (d.scrubProgress >= C.SCRUB_SECONDS) {
      d.isScrubbedIn = true
      d.scrubProgress = 0
      emit(s, 'scrubbed')
      toast(s, MESSAGES.scrubbed, 'good')
      // Head for the OR if someone is waiting there.
      if (orPatient(s)) walkTo(s, { kind: 'or' })
    }
  } else {
    d.scrubProgress = 0
  }

  // Arriving in the OR starts surgery, if scrubbed.
  if (at === 'or') {
    const p = orPatient(s)
    if (p) {
      if (d.isScrubbedIn) {
        startProcedure(s, 'csection', p)
        return
      }
      if (!d.warnedOr) {
        d.warnedOr = true
        emit(s, 'denied')
        toast(s, MESSAGES.scrubFirst, 'warn')
      }
    }
  } else {
    d.warnedOr = false
  }

  // A queued action happens on arrival at its bay.
  if (d.pending && at === (`bay${d.pending.bay}` as Station)) {
    const { bay, action } = d.pending
    d.pending = null
    const p = patientInBay(s, bay)
    if (p) perform(s, p, action)
  }

  d.currentTask = taskLabel(s)
}

function taskLabel(s: ShiftState): string {
  const d = s.doctor
  if (s.procedure) return s.procedure.kind === 'csection' ? 'In surgery' : 'Delivering'
  if (d.scrubProgress > 0) return `Scrubbing ${Math.round((d.scrubProgress / C.SCRUB_SECONDS) * 100)}%`
  if (d.pending) return `Heading to Bay ${d.pending.bay + 1}`
  if (d.goal) {
    if (d.goal.kind === 'bay') return `Heading to Bay ${d.goal.bay + 1}`
    if (d.goal.kind === 'supply') return 'Heading to Supply'
    if (d.goal.kind === 'sink') return 'Heading to the sink'
    if (d.goal.kind === 'or') return 'Heading to the OR'
  }
  if (d.at === 'supply') return 'At Supply'
  if (d.at === 'sink') return 'At the sink'
  if (d.at === 'or') return 'In the OR'
  if (d.at) return `At Bay ${Number(d.at.slice(3)) + 1}`
  return 'Ready'
}

function spotFor(target: Target) {
  switch (target.kind) {
    case 'bay':
      return SPOTS[`bay${target.bay}` as Station]
    case 'supply':
      return SPOTS.supply
    case 'sink':
      return SPOTS.sink
    case 'or':
      return SPOTS.or
    case 'point':
      return clampToFloor({ x: target.x, y: target.y })
  }
}

export function walkTo(s: ShiftState, target: Target) {
  if (s.procedure || s.over) return
  const d = s.doctor
  d.path = findPath({ x: d.x, y: d.y }, spotFor(target))
  d.goal = d.path.length ? target : null
  d.pending = null
}

// --- Actions ---------------------------------------------------------------------

export interface Check {
  ok: boolean
  reason?: string
}

const OK: Check = { ok: true }

export function actionCheck(s: ShiftState, p: Patient | undefined, action: Action): Check {
  if (!p) return { ok: false }
  if (!actionAvailable(s, action)) return { ok: false, reason: REASONS.locked }
  if (p.assignedBay === 'WAITING') return { ok: false, reason: REASONS.triage }
  if (p.assignedBay === 'OR_1') return { ok: false, reason: REASONS.inOr }
  const has = (item: Item) => s.doctor.hands.includes(item)
  switch (action) {
    case 'pitocin':
      if (p.dilation >= 10) return { ok: false, reason: REASONS.ready }
      return has('pitocin') ? OK : { ok: false, reason: REASONS.need }
    case 'epidural':
      if (p.hasEpidural) return { ok: false, reason: REASONS.hasEpidural }
      if (p.dilation >= C.EPIDURAL_LATEST) return { ok: false, reason: REASONS.tooLate }
      return has('epidural') ? OK : { ok: false, reason: REASONS.need }
    case 'magnesium':
      if (!p.preeclampsia) return { ok: false, reason: REASONS.notNeeded }
      return has('magnesium') ? OK : { ok: false, reason: REASONS.need }
    case 'oxygen':
      if (!p.distress) return { ok: false, reason: REASONS.calm }
      return has('oxygen') ? OK : { ok: false, reason: REASONS.need }
    case 'reposition':
      if (!p.distress) return { ok: false, reason: REASONS.calm }
      if (p.repositionCooldown > 0) return { ok: false, reason: REASONS.resting }
      return OK
    case 'deliver':
      return p.dilation >= 10 ? OK : { ok: false, reason: REASONS.notYet }
    case 'codeStork':
      if (!p.stalled && !p.distress && !p.preeclampsia) return { ok: false, reason: REASONS.noComplication }
      if (orPatient(s)) return { ok: false, reason: REASONS.orBusy }
      return OK
  }
}

// Walk to the bay (if not there already) and do `action` on arrival.
export function command(s: ShiftState, bay: number, action: Action): Check {
  if (s.procedure || s.over) return { ok: false }
  const p = patientInBay(s, bay)
  const check = actionCheck(s, p, action)
  if (!check.ok || !p) {
    emit(s, 'denied')
    return check
  }
  if (s.doctor.at === `bay${bay}`) {
    perform(s, p, action)
  } else {
    walkTo(s, { kind: 'bay', bay })
    s.doctor.pending = { bay, action }
  }
  return check
}

function spendItem(s: ShiftState, item: Item) {
  const hands = s.doctor.hands
  const i = hands.indexOf(item)
  if (i >= 0) hands.splice(i, 1)
}

function perform(s: ShiftState, p: Patient, action: Action) {
  const check = actionCheck(s, p, action)
  const d = s.doctor
  if (!check.ok) {
    emit(s, 'denied')
    if (check.reason) toast(s, check.reason, 'warn')
    return
  }
  if (action !== 'codeStork') d.isScrubbedIn = false
  switch (action) {
    case 'pitocin':
      spendItem(s, 'pitocin')
      if (p.hasPitocin) {
        p.pitocinDoubled = true
        toast(s, MESSAGES.doubledPitocin, 'warn')
      } else if (p.stalled) {
        toast(s, MESSAGES.restarted(p.name), 'good')
      } else {
        toast(s, MESSAGES.pitocin(p.name), 'info')
      }
      p.stalled = false
      p.hasPitocin = true
      p.pitocinTime = C.PITOCIN_SECONDS
      break
    case 'epidural':
      spendItem(s, 'epidural')
      p.hasEpidural = true
      toast(s, MESSAGES.epidural(p.name), 'good')
      break
    case 'magnesium':
      spendItem(s, 'magnesium')
      p.maternalStress = Math.max(0, p.maternalStress - C.MAGNESIUM_RELIEF)
      p.magnesiumTime = C.MAGNESIUM_SECONDS
      toast(s, MESSAGES.magnesium(p.name), 'good')
      break
    case 'oxygen':
      spendItem(s, 'oxygen')
      p.stabilizeTime = Math.max(p.stabilizeTime, C.OXYGEN_MASK_SECONDS)
      toast(s, MESSAGES.stabilized(p.name), 'good')
      break
    case 'reposition':
      p.stabilizeTime = Math.max(p.stabilizeTime, C.REPOSITION_SECONDS)
      p.repositionCooldown = C.REPOSITION_COOLDOWN
      toast(s, MESSAGES.stabilized(p.name), 'good')
      break
    case 'deliver':
      startProcedure(s, 'delivery', p)
      return
    case 'codeStork':
      p.assignedBay = 'OR_1'
      p.readyTime = 0
      toast(s, MESSAGES.codeStork(p.name), 'bad')
      walkTo(s, d.isScrubbedIn ? { kind: 'or' } : { kind: 'sink' })
      break
  }
  p.condition = deriveCondition(p)
  emit(s, 'treat')
}

export function pickItem(s: ShiftState, item: Item): boolean {
  const d = s.doctor
  if (s.procedure || s.over || d.at !== 'supply' || !itemAvailable(s, item)) return false
  if (d.hands.length >= C.HANDS) {
    emit(s, 'denied')
    toast(s, MESSAGES.handsFull, 'warn')
    return false
  }
  d.hands.push(item)
  d.isScrubbedIn = false
  emit(s, 'pickup')
  return true
}

export function dropItem(s: ShiftState, index: number) {
  if (index >= 0 && index < s.doctor.hands.length) s.doctor.hands.splice(index, 1)
}

// --- Deliveries ------------------------------------------------------------------

function startProcedure(s: ShiftState, kind: 'delivery' | 'csection', p: Patient) {
  const d = s.doctor
  d.path = []
  d.goal = null
  d.pending = null
  d.input = { x: 0, y: 0 }
  s.procedure = { kind, patient: p, elapsed: 0 }
  s.activeView = kind === 'csection' ? 'OR_SURGERY_VIEW' : 'DELIVERY_VIEW'
  d.currentTask = taskLabel(s)
  emit(s, 'procedure')
}

// How a delivery went: 3 stars, less one for a baby low on oxygen (two if
// very low), one for a very stressed mom, and one for a fumbled procedure.
export function babyStars(p: Patient, quality: number): number {
  let stars = p.fetalOxygen >= 70 ? 3 : p.fetalOxygen >= 40 ? 2 : 1
  if (p.maternalStress >= C.HIGH_STRESS) stars--
  if (quality < 0.5) stars--
  return Math.min(3, Math.max(1, stars))
}

// The delivery or C-section is over. `quality` (0..1) is how well the
// mini-game went: it can cost a star, and earns a small skill bonus.
export function finishProcedure(s: ShiftState, quality: number) {
  const proc = s.procedure
  if (!proc) return
  const p = proc.patient
  const q = Math.min(1, Math.max(0, quality))
  const stars = babyStars(p, q)
  const csection = proc.kind === 'csection'
  const skill = Math.round(q * C.SKILL_BONUS)
  s.score += stars * C.POINTS_PER_STAR + skill + (csection ? C.CSECTION_BONUS : 0)
  s.ledger.babies += stars * C.POINTS_PER_STAR
  s.ledger.skill += skill
  if (csection) s.ledger.codeStork += C.CSECTION_BONUS
  s.log.push({ name: p.name, how: csection ? 'csection' : 'delivery', stars })
  s.deliveriesCompleted++
  if (csection) s.csections++
  s.stars.push(stars)
  removePatient(s, p)
  s.procedure = null
  s.activeView = 'FLOOR_VIEW'
  s.doctor.isScrubbedIn = false
  emit(s, 'delivered')
  toast(s, csection ? MESSAGES.csection(p.name, stars) : MESSAGES.delivered(p.name, stars), 'good')
}

// --- Results ----------------------------------------------------------------------

export interface ShiftResult {
  outcome: 'complete' | 'sentHome'
  score: number
  stars: number // 0..3 for the shift
  deliveries: number
  csections: number
  midwife: number
  transfers: number
  complications: number
  babyStars: number // average per-baby grade, 0 if none
  ledger: Ledger
  log: BabyLog[]
}

export function shiftResult(s: ShiftState): ShiftResult {
  const score = Math.max(0, Math.round(s.score))
  const outcome = s.over === 'sentHome' ? 'sentHome' : 'complete'
  const thresholds = cfg(s).stars
  const stars = outcome === 'sentHome' ? 0 : thresholds.filter((t) => score >= t).length
  return {
    outcome,
    score,
    stars,
    deliveries: s.deliveriesCompleted,
    csections: s.csections,
    midwife: s.midwifeDeliveries,
    transfers: s.transfers,
    complications: s.complicationsCount,
    babyStars: s.stars.length ? s.stars.reduce((a, b) => a + b, 0) / s.stars.length : 0,
    ledger: { ...s.ledger },
    log: [...s.log],
  }
}
