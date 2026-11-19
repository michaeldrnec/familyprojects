import { describe, expect, it } from 'vitest'
import * as C from './config'
import {
  actionCheck,
  command,
  dropItem,
  finishProcedure,
  newShift,
  orPatient,
  patientInBay,
  pickItem,
  shiftResult,
  stepShift,
  walkTo,
} from './shift'
import { BAYS, type Action, type Item, type Patient, type ShiftState } from './types'

const SEEDS = [1, 2, 3, 4, 5, 6]
const FRAME = 1 / 30

function run(s: ShiftState, seconds: number) {
  for (let t = 0; t < seconds && !s.over; t += FRAME) {
    stepShift(s, FRAME)
  }
}

// Walks the doctor to `target` and waits until arrival.
function goTo(s: ShiftState, target: Parameters<typeof walkTo>[1]) {
  walkTo(s, target)
  for (let i = 0; i < 600 && s.doctor.path.length; i++) stepShift(s, FRAME)
  stepShift(s, FRAME)
}

function freshPatient(s: ShiftState, bay = 0): Patient {
  const p = patientInBay(s, bay)
  if (!p) throw new Error('no patient')
  return p
}

describe('a shift', () => {
  it('starts with patients in bays and runs out of time after SHIFT_SECONDS', () => {
    const s = newShift(0, 7)
    expect(s.patients.length).toBe(C.SHIFTS[0].startPatients)
    expect(s.patients.every((p) => (BAYS as readonly string[]).includes(p.assignedBay))).toBe(true)
    run(s, C.SHIFT_SECONDS + 1)
    expect(s.over).toBe('complete')
    expect(s.timeRemaining).toBe(0)
  })

  it('dilates labor and hands an ignored delivery to the midwife', () => {
    const s = newShift(0, 3)
    const p = freshPatient(s)
    p.stallAt = null
    p.dilation = 9.9
    run(s, 3)
    expect(p.dilation).toBe(10)
    run(s, C.MIDWIFE_AFTER)
    expect(s.midwifeDeliveries).toBeGreaterThanOrEqual(1)
    expect(s.patients).not.toContain(p)
  })

  it('needs items from Supply, two at a time', () => {
    const s = newShift(1, 3)
    const p = freshPatient(s)
    expect(actionCheck(s, p, 'pitocin').ok).toBe(false)
    expect(pickItem(s, 'pitocin')).toBe(false) // not at Supply
    goTo(s, { kind: 'supply' })
    expect(s.doctor.at).toBe('supply')
    expect(pickItem(s, 'pitocin')).toBe(true)
    expect(pickItem(s, 'oxygen')).toBe(true)
    expect(pickItem(s, 'epidural')).toBe(false)
    dropItem(s, 1)
    expect(s.doctor.hands).toEqual(['pitocin'])
    expect(actionCheck(s, p, 'pitocin').ok).toBe(true)
  })

  it('doubles dilation with Pitocin, which also restarts a stalled labor', () => {
    const s = newShift(0, 5)
    const p = freshPatient(s)
    p.stalled = true
    p.stallAt = null
    goTo(s, { kind: 'supply' })
    pickItem(s, 'pitocin')
    command(s, 0, 'pitocin')
    for (let i = 0; i < 300 && s.doctor.pending; i++) stepShift(s, FRAME)
    expect(p.stalled).toBe(false)
    expect(p.hasPitocin).toBe(true)
    expect(s.doctor.hands).toEqual([])
  })

  it('caps stress with an epidural, but not after 8 cm', () => {
    const s = newShift(0, 5)
    const p = freshPatient(s)
    p.dilation = 8.2
    s.doctor.hands = ['epidural']
    expect(actionCheck(s, p, 'epidural').ok).toBe(false)
    p.dilation = 5
    p.maternalStress = 70
    p.hasEpidural = true
    run(s, 15)
    expect(p.maternalStress).toBeLessThanOrEqual(C.EPIDURAL_STRESS_CAP + 0.01)
  })

  it('drains oxygen only once the heart rate leaves the safe range, and the mask buys time', () => {
    const s = newShift(1, 9)
    const p = freshPatient(s)
    p.stallAt = null
    p.distressAt = null
    p.dilation = 5
    p.distress = true
    run(s, 2)
    expect(p.fetalOxygen).toBe(100) // still the yellow warning
    run(s, C.DISTRESS_ONSET_SECONDS + 4)
    expect(p.fetalOxygen).toBeLessThan(100)
    const before = p.fetalOxygen
    p.stabilizeTime = C.OXYGEN_MASK_SECONDS
    run(s, 8)
    expect(p.fetalOxygen).toBeGreaterThan(before - 3)
    expect(p.fetalHeartRate).toBeGreaterThan(C.FHR_LOW)
  })

  it('calls in the specialist team when oxygen runs out, and ends the shift after three', () => {
    const s = newShift(1, 9)
    for (let i = 0; i < C.MAX_TRANSFERS; i++) {
      const p = s.patients.find((q) => q.assignedBay !== 'WAITING')
      if (!p) throw new Error('no patient')
      p.distress = true
      p.distressOnset = 1
      p.distressLow = true
      p.stabilizeTime = 0
      p.fetalOxygen = 1
      p.fetalHeartRate = 80
      run(s, 1)
      if (i < C.MAX_TRANSFERS - 1) {
        expect(s.over).toBe(null)
        // keep the floor stocked
        if (s.patients.length < 2) run(s, 60)
      }
    }
    expect(s.transfers).toBe(C.MAX_TRANSFERS)
    expect(s.over).toBe('sentHome')
    expect(shiftResult(s).stars).toBe(0)
  })

  it('runs a Code Stork: OR, scrub at the sink, then surgery', () => {
    const s = newShift(1, 11)
    const p = freshPatient(s)
    p.distress = true
    expect(actionCheck(s, p, 'codeStork').ok).toBe(true)
    goTo(s, { kind: 'bay', bay: 0 })
    command(s, 0, 'codeStork')
    expect(orPatient(s)).toBe(p)
    expect(patientInBay(s, 0)).toBeUndefined()
    // Straight to the OR without scrubbing: refused.
    s.doctor.path = []
    goTo(s, { kind: 'or' })
    expect(s.procedure).toBe(null)
    // Scrub, which then walks to the OR and starts surgery.
    walkTo(s, { kind: 'sink' })
    for (let i = 0; i < 600 && !s.procedure; i++) stepShift(s, FRAME)
    expect(s.procedure?.kind).toBe('csection')
    expect(s.activeView).toBe('OR_SURGERY_VIEW')
    const time = s.timeRemaining
    stepShift(s, 1)
    expect(time - s.timeRemaining).toBeCloseTo(C.PROCEDURE_SLOWDOWN, 5)
    finishProcedure(s, 1)
    expect(s.csections).toBe(1)
    expect(s.deliveriesCompleted).toBe(1)
    expect(s.score).toBeGreaterThan(C.CSECTION_BONUS)
    expect(s.doctor.isScrubbedIn).toBe(false)
  })

  it('locks actions the shift has not introduced yet', () => {
    const s = newShift(0, 1)
    const p = freshPatient(s)
    p.distress = true
    expect(actionCheck(s, p, 'codeStork').ok).toBe(false)
    expect(actionCheck(s, p, 'reposition').ok).toBe(false)
    goTo(s, { kind: 'supply' })
    expect(pickItem(s, 'oxygen')).toBe(false)
    expect(pickItem(s, 'magnesium')).toBe(false)
  })

  it('replays exactly from a seed', () => {
    const a = newShift(4, 99)
    const b = newShift(4, 99)
    run(a, 120)
    run(b, 120)
    expect(a.patients.map((p) => [p.name, p.dilation, p.fetalOxygen])).toEqual(b.patients.map((p) => [p.name, p.dilation, p.fetalOxygen]))
  })
})

// --- Balance --------------------------------------------------------------------

// A decent player: reacts after a short pause, finishes each delivery or
// surgery in a few seconds with a middling grade, and works through
// emergencies first, then ready moms, then comfort.
function bot(s: ShiftState) {
  let wait = 0
  return () => {
    if (s.procedure) {
      if (s.procedure.elapsed >= (s.procedure.kind === 'csection' ? 22 : 6)) finishProcedure(s, 0.7)
      return
    }
    const d = s.doctor
    if (d.path.length || d.pending) return
    if (wait > 0) {
      wait -= FRAME
      return
    }
    wait = 0.5

    if (orPatient(s)) {
      if (d.isScrubbedIn) walkTo(s, { kind: 'or' })
      else if (d.at !== 'sink') walkTo(s, { kind: 'sink' })
      return
    }

    const bays = [0, 1, 2, 3].map((i) => ({ i, p: patientInBay(s, i) })).filter((b): b is { i: number; p: Patient } => !!b.p)
    const can = (i: number, a: Action) => actionCheck(s, patientInBay(s, i), a).ok

    // What each patient would want from Supply.
    const wants: Item[] = []
    for (const { p } of bays) {
      if (p.distress && p.dilation < 10) wants.push('oxygen')
      if (p.preeclampsia && p.magnesiumTime < 10) wants.push('magnesium')
      if (p.stalled) wants.push('pitocin')
      if (!p.hasEpidural && p.dilation < 7 && p.maternalStress > 45) wants.push('epidural')
    }

    if (d.at === 'supply') {
      for (let i = d.hands.length - 1; i >= 0; i--) if (!wants.includes(d.hands[i])) dropItem(s, i)
      for (const w of wants) if (!d.hands.includes(w)) pickItem(s, w)
    }

    const tasks: [number, Action][] = []
    for (const { i, p } of [...bays].sort((a, b) => a.p.fetalOxygen - b.p.fetalOxygen)) {
      if (!p.distress || p.stabilizeTime > 3) continue
      if (p.dilation >= 10) tasks.push([i, 'deliver'])
      else if (p.dilation >= 8.8 || !can(i, 'codeStork')) tasks.push([i, 'oxygen'], [i, 'reposition'], [i, 'codeStork'])
      else tasks.push([i, 'codeStork'])
    }
    for (const { i } of bays) tasks.push([i, 'deliver'])
    for (const { i, p } of bays) if (p.preeclampsia && p.maternalStress > 60 && p.magnesiumTime <= 0) tasks.push([i, 'magnesium'])
    for (const { i, p } of bays) if (p.stalled) tasks.push([i, 'pitocin'])
    for (const { i, p } of bays) if (p.maternalStress > 45 && p.dilation < 7) tasks.push([i, 'epidural'])

    for (const [i, a] of tasks) {
      if (can(i, a)) {
        command(s, i, a)
        return
      }
    }
    // Something needs an item we don't have: restock.
    if (wants.some((w) => !d.hands.includes(w)) && d.at !== 'supply') walkTo(s, { kind: 'supply' })
  }
}

function play(shift: number, seed: number, withBot: boolean) {
  const s = newShift(shift, seed)
  const b = bot(s)
  for (let i = 0; i < 20000 && !s.over; i++) {
    if (withBot) b()
    stepShift(s, FRAME)
  }
  return shiftResult(s)
}

describe('balance', () => {
  it('a decent player finishes every shift with stars', () => {
    for (let shift = 0; shift < C.SHIFTS.length; shift++) {
      const results = SEEDS.map((seed) => play(shift, seed, true))
      for (const r of results) {
        expect(r.outcome, `shift ${shift}`).toBe('complete')
        expect(r.stars, `shift ${shift} score ${r.score}`).toBeGreaterThanOrEqual(1)
      }
      const avg = results.reduce((a, r) => a + r.stars, 0) / results.length
      expect(avg, `shift ${shift}`).toBeGreaterThanOrEqual(1.5)
    }
  })

  it('doing nothing earns no stars', () => {
    for (let shift = 0; shift < C.SHIFTS.length; shift++) {
      for (const seed of SEEDS) expect(play(shift, seed, false).stars, `shift ${shift}`).toBe(0)
    }
  })
})
