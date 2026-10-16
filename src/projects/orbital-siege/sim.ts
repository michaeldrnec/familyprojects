// The deterministic tick simulation (SPEC.md section 8). Pure: the same
// level, plan and platform always give the same result, which is what lets
// replays, share codes and the daily solvability check work.
//
// Each tick runs a fixed pipeline:
//   1. Launch      actions whose (fire + charge + heat stutter) is this tick
//   2. Effects     EMPs and chaff that arrive this tick
//   3. Intercept   dust rings, then each live PDC shoots in-flight projectiles
//   4. Strikes     beams first, then projectiles, each in fire order
//   5. Defenses    batteries whose countdown is up fire at the platform
//   6. Upkeep      heat cools (handled by schedule())
import { canTarget, fieldName, targetCol, targetLabel } from './defenses'
import type { Level, Plan, Platform, StructureDef, Target, WeaponId } from './types'
import { WEAPONS, isBeam, isLaser } from './weapons'

export type Phase = 'launch' | 'effects' | 'intercept' | 'strike' | 'defense'

// Where inside a tick (0..1) each phase plays out during playback.
export const PHASE_T: Record<Phase, number> = {
  launch: 0.1,
  effects: 0.3,
  intercept: 0.45,
  strike: 0.62,
  defense: 0.82,
}

export type EventKind =
  | 'launch'
  | 'stutter'
  | 'emp'
  | 'chaff'
  | 'absorb'
  | 'overload'
  | 'intercept'
  | 'dust'
  | 'destroy'
  | 'damage'
  | 'glance'
  | 'drain'
  | 'shatter'
  | 'blocked'
  | 'refract'
  | 'scramble'
  | 'miss'
  | 'collateral'
  | 'battery-fire'
  | 'battery-hold'
  | 'win'
  | 'lose'

export interface SimEvent {
  tick: number
  phase: Phase
  kind: EventKind
  text: string
  bad?: boolean // a shot that was wasted or failed -- debrief cause candidate
  shot?: number
  col?: number
  entity?: string
}

export type ShotFate =
  | 'hit'
  | 'intercepted'
  | 'dust'
  | 'blocked'
  | 'absorbed'
  | 'refracted'
  | 'lost'
  | 'effect'
  | 'unlaunched'

export interface Shot {
  i: number // index into the plan
  w: WeaponId
  target: Target
  fire: number
  launch: number | null // null: stuttered past the last tick
  arrive: number | null
  stutter: number
  fate: ShotFate | null // null while still flying when the sim stopped
  endTick: number | null
  endPhase: Phase | null
  landCol: number | null // column it finally hit (after drift)
}

export interface StructSnap {
  alive: boolean
  hp: number
  disabled: boolean
  powered: boolean
}
export interface PdcSnap {
  alive: boolean
  disabled: boolean
  blind: boolean
  powered: boolean
}
export interface ShieldSnap {
  strength: number
  up: boolean
  collapsed: boolean
}
export interface Snapshot {
  structs: StructSnap[]
  pdcs: PdcSnap[]
  shields: ShieldSnap[]
  fieldUp: boolean
  heat: number
}

export interface SimResult {
  outcome: 'win' | 'lose'
  reason: string
  endTick: number
  winTick: number | null
  energy: number
  collateral: number
  shots: Shot[]
  events: SimEvent[]
  snapshots: Snapshot[] // [0] before tick 1, [T] at the end of tick T
  cause: string | null // first thing that went wrong (debrief)
}

export interface Schedule {
  launch: (number | null)[] // per action
  stutter: number[] // per action
  heat: number[] // [T] = heat right after tick T's launches (index 0 unused)
}

// Heat is independent of the battle, so the sequencer can preview it.
// Actions launch in fire order; one that would push heat over the cap waits
// a tick (and can keep waiting -- the stutter cascades).
export function schedule(plan: Plan, platform: Platform, ticks: number): Schedule {
  const launch: (number | null)[] = plan.map(() => null)
  const stutter = plan.map(() => 0)
  const heatAt: number[] = [0]
  let heat = 0
  let carry: number[] = []
  for (let T = 1; T <= ticks; T++) {
    const due = [...carry]
    plan.forEach((a, i) => {
      if (a.tick + WEAPONS[a.w].charge === T) due.push(i)
    })
    carry = []
    for (const i of due) {
      const h = WEAPONS[plan[i].w].heat
      if (heat + h > platform.heatCap) {
        carry.push(i)
        stutter[i]++
      } else {
        heat += h
        launch[i] = T
      }
    }
    heatAt[T] = heat
    heat = Math.max(0, heat - platform.cool)
  }
  return { launch, stutter, heat: heatAt }
}

export function planEnergy(plan: Plan) {
  return plan.reduce((sum, a) => sum + WEAPONS[a.w].energy, 0)
}

export function empDuration(level: Level) {
  return level.modifiers?.solarStorm ? 3 : 2
}

interface StructState {
  def: StructureDef
  alive: boolean
  hp: number
  disabledUntil: number
  fired: boolean
  held: boolean
}

export function simulate(level: Level, plan: Plan, platform: Platform, fast = false): SimResult {
  const N = level.ticks
  const W = level.width
  const empTicks = empDuration(level)
  const events: SimEvent[] = []
  const snapshots: Snapshot[] = []
  const log = (e: SimEvent) => {
    if (!fast) events.push(e)
  }
  const nameOf = (i: number) => `${WEAPONS[plan[i].w].name} #${i + 1}`

  const structs: StructState[] = level.structures.map((def) => ({
    def,
    alive: true,
    hp: def.hp ?? 1,
    disabledUntil: 0,
    fired: false,
    held: false,
  }))
  const byId = new Map(structs.map((s) => [s.def.id, s]))
  const pdcs = level.pdcs.map((def) => ({ def, alive: true, disabledUntil: 0, blindUntil: 0 }))
  const shields = level.shields.map((def) => ({ def, strength: def.strength, collapsedUntil: 0 }))
  const field = level.field ? { def: level.field, disabledUntil: 0 } : null

  const powered = (src: string | undefined, T: number, depth = 0): boolean => {
    if (!src) return true
    const s = byId.get(src)
    if (!s) return true
    return s.alive && s.disabledUntil < T && (depth > 4 || powered(s.def.power, T, depth + 1))
  }
  const pdcActive = (p: (typeof pdcs)[number], T: number) =>
    p.alive && p.disabledUntil < T && p.blindUntil < T && powered(p.def.power, T)
  const shieldUp = (s: (typeof shields)[number], T: number) =>
    s.strength > 0 && s.collapsedUntil < T && powered(s.def.power, T)
  const fieldUp = (T: number) => !!field && field.disabledUntil < T
  const shieldOver = (col: number, T: number) =>
    shields.find((s) => col >= s.def.from && col <= s.def.to && shieldUp(s, T))
  const structAt = (col: number) => structs.find((s) => s.def.col === col && s.alive)
  const objectivesDown = () => level.objectives.every((id) => !byId.get(id)?.alive)

  const sched = schedule(plan, platform, N)
  const shots: Shot[] = plan.map((a, i) => {
    const launch = sched.launch[i]
    return {
      i,
      w: a.w,
      target: a.target,
      fire: a.tick,
      launch,
      arrive: launch === null ? null : launch + WEAPONS[a.w].transit,
      stutter: sched.stutter[i],
      fate: launch === null ? 'unlaunched' : null,
      endTick: null,
      endPhase: null,
      landCol: null,
    }
  })
  // Fire order: launch tick, then plan order.
  const order = shots
    .filter((s) => s.launch !== null)
    .sort((a, b) => a.launch! - b.launch! || a.i - b.i)

  const end = (s: Shot, fate: ShotFate, T: number, phase: Phase, col: number | null = null) => {
    s.fate = fate
    s.endTick = T
    s.endPhase = phase
    s.landCol = col
  }

  const snap = (T: number, heat: number): Snapshot => ({
    structs: structs.map((s) => ({
      alive: s.alive,
      hp: s.hp,
      disabled: s.disabledUntil >= T && T > 0,
      powered: powered(s.def.power, T),
    })),
    pdcs: pdcs.map((p) => ({
      alive: p.alive,
      disabled: p.disabledUntil >= T && T > 0,
      blind: p.blindUntil >= T && T > 0,
      powered: powered(p.def.power, T),
    })),
    shields: shields.map((s) => ({
      strength: s.strength,
      up: shieldUp(s, Math.max(1, T)),
      collapsed: s.collapsedUntil >= T && T > 0,
    })),
    fieldUp: fieldUp(Math.max(1, T)),
    heat,
  })
  if (!fast) snapshots.push(snap(0, 0))

  let collateral = 0
  let outcome: 'win' | 'lose' | null = null
  let reason = ''
  let endTick = N
  let winTick: number | null = null

  for (let T = 1; T <= N && outcome === null; T++) {
    // 1. Launch
    for (const s of order) {
      if (s.launch !== T) continue
      if (!fast) {
        const late = s.stutter ? ` (${s.stutter} tick${s.stutter > 1 ? 's' : ''} late: overheated)` : ''
        log({
          tick: T,
          phase: 'launch',
          kind: s.stutter ? 'stutter' : 'launch',
          shot: s.i,
          text: `${nameOf(s.i)} away at ${targetLabel(level, s.target)}${late}.`,
        })
      }
    }

    // 2. Effects
    const arriving = order.filter((s) => s.arrive === T && s.fate === null)
    const emps = arriving.filter((s) => s.w === 'emp')
    if (emps.length && field && field.def.kind === 'magneto' && fieldUp(T)) {
      if (emps.length >= 2) {
        field.disabledUntil = T + empTicks - 1
        for (const s of emps) end(s, 'effect', T, 'effects')
        log({ tick: T, phase: 'effects', kind: 'overload', entity: 'field', text: `${emps.length} EMPs overload the Magnetosphere: down until the end of tick ${field.disabledUntil}.` })
      } else {
        end(emps[0], 'absorbed', T, 'effects')
        log({ tick: T, phase: 'effects', kind: 'absorb', bad: true, shot: emps[0].i, entity: 'field', text: `The Magnetosphere swallowed ${nameOf(emps[0].i)}.` })
      }
    } else {
      for (const s of emps) {
        const until = T + empTicks - 1
        const col = targetCol(s.target)
        end(s, 'effect', T, 'effects', col)
        if (col !== null) {
          const st = structAt(col)
          if (!st) {
            log({ tick: T, phase: 'effects', kind: 'emp', bad: true, shot: s.i, col, text: `${nameOf(s.i)} hit empty ground.` })
            continue
          }
          st.disabledUntil = Math.max(st.disabledUntil, until)
          const matters =
            st.def.kind === 'battery' ||
            level.structures.some((d) => d.power === st.def.id) ||
            level.pdcs.some((d) => d.power === st.def.id) ||
            level.shields.some((d) => d.power === st.def.id)
          log({
            tick: T,
            phase: 'effects',
            kind: 'emp',
            shot: s.i,
            col,
            entity: st.def.id,
            bad: !matters,
            text: matters
              ? `EMP knocks out ${st.def.name} until the end of tick ${until}.`
              : `EMP washes over ${st.def.name}, which has nothing to switch off.`,
          })
        } else if (s.target === 'field') {
          if (field) field.disabledUntil = Math.max(field.disabledUntil, until)
          log({ tick: T, phase: 'effects', kind: 'emp', shot: s.i, entity: 'field', text: `EMP disrupts the ${fieldName(level)} until the end of tick ${until}.` })
        } else {
          const p = pdcs.find((d) => d.def.id === s.target)
          const sh = shields.find((d) => d.def.id === s.target)
          if (p) {
            p.disabledUntil = Math.max(p.disabledUntil, until)
            log({ tick: T, phase: 'effects', kind: 'emp', shot: s.i, entity: p.def.id, text: `EMP shuts down ${p.def.name} until the end of tick ${until}.` })
          } else if (sh) {
            sh.collapsedUntil = Math.max(sh.collapsedUntil, until)
            log({ tick: T, phase: 'effects', kind: 'emp', shot: s.i, entity: sh.def.id, text: `EMP collapses ${sh.def.name} until the end of tick ${until}.` })
          }
        }
      }
    }
    for (const s of arriving) {
      if (s.w !== 'chaff') continue
      const col = targetCol(s.target) ?? level.pdcs.find((p) => p.id === s.target)?.col ?? 0
      end(s, 'effect', T, 'effects', col)
      const blinded = pdcs.filter((p) => p.alive && col >= p.def.zone[0] && col <= p.def.zone[1])
      for (const p of blinded) p.blindUntil = Math.max(p.blindUntil, T + 1)
      log({
        tick: T,
        phase: 'effects',
        kind: 'chaff',
        shot: s.i,
        col,
        bad: blinded.length === 0,
        text: blinded.length
          ? `Chaff blooms over column ${col + 1}: ${blinded.map((p) => p.def.name).join(', ')} blind through tick ${T + 1}.`
          : `Chaff blooms over column ${col + 1}, but no PDC guards it.`,
      })
    }

    // 3. Interception
    const inFlight = () =>
      order.filter((s) => s.fate === null && WEAPONS[s.w].physical && s.launch! < T && s.arrive! > T)
    if (level.modifiers?.dustTicks?.includes(T)) {
      for (const s of inFlight()) {
        end(s, 'dust', T, 'intercept')
        log({ tick: T, phase: 'intercept', kind: 'dust', bad: true, shot: s.i, text: `The dust ring shreds ${nameOf(s.i)}.` })
      }
    }
    for (const p of pdcs) {
      if (!pdcActive(p, T)) continue
      const cands = inFlight().filter((s) => {
        const c = targetCol(s.target)
        return c !== null && c >= p.def.zone[0] && c <= p.def.zone[1]
      })
      if (!cands.length) continue
      const fireOrder = (a: Shot, b: Shot) => a.launch! - b.launch! || a.i - b.i
      cands.sort((a, b) => {
        if (p.def.priority === 'mass') return WEAPONS[b.w].mass - WEAPONS[a.w].mass || fireOrder(a, b)
        if (p.def.priority === 'nearest') return a.arrive! - b.arrive! || fireOrder(a, b)
        return fireOrder(a, b)
      })
      for (const s of cands.slice(0, p.def.barrels ?? 1)) {
        end(s, 'intercepted', T, 'intercept')
        log({ tick: T, phase: 'intercept', kind: 'intercept', bad: true, shot: s.i, entity: p.def.id, text: `${p.def.name} intercepted ${nameOf(s.i)}.` })
      }
    }

    // 4. Strikes: beams, then projectiles, each in fire order.
    const strikes = order.filter((s) => s.arrive === T && s.fate === null && s.w !== 'emp' && s.w !== 'chaff')
    strikes.sort((a, b) => Number(isBeam(b.w)) - Number(isBeam(a.w)))
    let hardHit: string | null = null
    for (const s of strikes) {
      const def = WEAPONS[s.w]
      const fUp = fieldUp(T)
      if (fUp && field!.def.kind === 'magneto' && isLaser(s.w)) {
        end(s, 'refracted', T, 'strike')
        log({ tick: T, phase: 'strike', kind: 'refract', bad: true, shot: s.i, entity: 'field', text: `The Magnetosphere refracted ${nameOf(s.i)}.` })
        continue
      }
      // Lasers at a PDC.
      const pdc = pdcs.find((p) => p.def.id === s.target)
      if (pdc) {
        if (!pdc.alive) {
          end(s, 'hit', T, 'strike')
          log({ tick: T, phase: 'strike', kind: 'miss', bad: true, shot: s.i, entity: pdc.def.id, text: `${nameOf(s.i)} hit the wreck of ${pdc.def.name}.` })
        } else if (pdc.def.armored) {
          end(s, 'hit', T, 'strike')
          log({ tick: T, phase: 'strike', kind: 'glance', bad: true, shot: s.i, entity: pdc.def.id, text: `${nameOf(s.i)} glanced off armored ${pdc.def.name}.` })
        } else {
          pdc.alive = false
          end(s, 'hit', T, 'strike')
          log({ tick: T, phase: 'strike', kind: 'destroy', shot: s.i, entity: pdc.def.id, text: `${nameOf(s.i)} destroyed ${pdc.def.name}.` })
        }
        continue
      }
      let col = targetCol(s.target)!
      if (fUp && def.guided) {
        const to = col + field!.def.drift
        if (to < 0 || to >= W) {
          end(s, 'lost', T, 'strike')
          log({ tick: T, phase: 'strike', kind: 'scramble', bad: true, shot: s.i, text: `The ${fieldName(level)} scrambled ${nameOf(s.i)} off the edge of the map.` })
          continue
        }
        log({ tick: T, phase: 'strike', kind: 'scramble', shot: s.i, col: to, text: `The ${fieldName(level)} pushed ${nameOf(s.i)} from column ${col + 1} to ${to + 1}.` })
        col = to
      }
      const shield = s.w === 'resonance' ? undefined : shieldOver(col, T)
      if (shield) {
        if (isLaser(s.w)) {
          shield.strength--
          end(s, 'absorbed', T, 'strike', col)
          log({
            tick: T,
            phase: 'strike',
            kind: 'drain',
            shot: s.i,
            entity: shield.def.id,
            text: shield.strength > 0 ? `${shield.def.name} absorbed ${nameOf(s.i)} (strength ${shield.strength} left).` : `${nameOf(s.i)} drained ${shield.def.name} to nothing.`,
          })
        } else if (s.w === 'lance' && shield.strength <= 1) {
          shield.strength = 0
          end(s, 'absorbed', T, 'strike', col)
          log({ tick: T, phase: 'strike', kind: 'shatter', shot: s.i, entity: shield.def.id, text: `${nameOf(s.i)} shattered ${shield.def.name} and was spent.` })
        } else {
          end(s, 'blocked', T, 'strike', col)
          log({ tick: T, phase: 'strike', kind: 'blocked', bad: true, shot: s.i, entity: shield.def.id, text: `${shield.def.name} stopped ${nameOf(s.i)}.` })
        }
        continue
      }
      end(s, 'hit', T, 'strike', col)
      const hitCols =
        s.w === 'thermo'
          ? level.modifiers?.volatile
            ? Array.from({ length: W }, (_, c) => c)
            : [col - 1, col, col + 1].filter((c) => c >= 0 && c < W)
          : [col]
      let anything = false
      for (const c of hitCols) {
        if (c !== col && shieldOver(c, T)) continue
        const st = structAt(c)
        if (!st) continue
        anything = true
        if (!def.kills.includes(st.def.armor)) {
          if (c === col) log({ tick: T, phase: 'strike', kind: 'glance', bad: true, shot: s.i, col: c, entity: st.def.id, text: `${nameOf(s.i)} glanced off ${st.def.name} (${st.def.armor} armor).` })
          continue
        }
        st.hp--
        if (st.hp > 0) {
          log({ tick: T, phase: 'strike', kind: 'damage', shot: s.i, col: c, entity: st.def.id, text: `${nameOf(s.i)} damaged ${st.def.name} (${st.hp} hit${st.hp > 1 ? 's' : ''} left).` })
          continue
        }
        st.alive = false
        if (st.def.kind === 'site') {
          collateral++
          if (st.def.hard) hardHit = st.def.name
          log({ tick: T, phase: 'strike', kind: 'collateral', bad: true, shot: s.i, col: c, entity: st.def.id, text: `${nameOf(s.i)} wrecked ${st.def.name}, a protected site!` })
        } else {
          log({ tick: T, phase: 'strike', kind: 'destroy', shot: s.i, col: c, entity: st.def.id, text: `${nameOf(s.i)} destroyed ${st.def.name}.` })
        }
      }
      if (!anything) log({ tick: T, phase: 'strike', kind: 'miss', bad: true, shot: s.i, col, text: `${nameOf(s.i)} hit empty ground in column ${col + 1}.` })
    }
    if (hardHit) {
      outcome = 'lose'
      reason = `Tick ${T}: ${hardHit} was hit. Mission aborted.`
      endTick = T
    } else if (objectivesDown()) {
      outcome = 'win'
      winTick = T
      endTick = T
      reason = `Tick ${T}: the fortress is offline.`
    }

    // 5. Defenses
    if (outcome === null) {
      for (const b of structs) {
        if (b.def.kind !== 'battery' || !b.alive || b.fired || T < (b.def.fireAt ?? Infinity)) continue
        if (b.disabledUntil < T && powered(b.def.power, T)) {
          b.fired = true
          outcome = 'lose'
          endTick = T
          reason = `Tick ${T}: ${b.def.name} fired on the platform.`
          log({ tick: T, phase: 'defense', kind: 'battery-fire', bad: true, entity: b.def.id, text: `${b.def.name} fired on the platform!` })
          break
        }
        if (!b.held) {
          b.held = true
          log({ tick: T, phase: 'defense', kind: 'battery-hold', entity: b.def.id, text: `${b.def.name} is knocked out and holds its fire.` })
        }
      }
    }

    if (outcome === null && T === N) {
      outcome = 'lose'
      reason = `Tick ${N}: out of time with the fortress still standing.`
    }
    if (!fast) snapshots.push(snap(T, sched.heat[T]))
  }

  if (outcome === 'lose') {
    for (const s of shots) {
      if (s.launch === null) {
        log({ tick: endTick, phase: 'launch', kind: 'stutter', bad: true, shot: s.i, text: `${nameOf(s.i)} never launched: the platform stayed too hot.` })
      }
    }
  }
  if (outcome === 'win') log({ tick: endTick, phase: 'strike', kind: 'win', text: reason })
  else log({ tick: endTick, phase: 'defense', kind: 'lose', bad: true, text: reason })

  const firstBad = events.find((e) => e.bad && e.kind !== 'lose')
  return {
    outcome: outcome!,
    reason,
    endTick,
    winTick,
    energy: planEnergy(plan),
    collateral,
    shots,
    events,
    snapshots,
    cause: outcome === 'lose' ? (firstBad ? `Tick ${firstBad.tick}: ${firstBad.text}` : null) : null,
  }
}

// Plans the sim should refuse outright: over budget or aimed at nothing.
export function planProblem(level: Level, plan: Plan, platform: Platform): string | null {
  if (!plan.length) return 'Add at least one action to the timeline.'
  if (planEnergy(plan) > platform.energy) return `Over the energy budget (${planEnergy(plan)}/${platform.energy} MW).`
  for (const a of plan) {
    if (!canTarget(level, a.w, a.target)) return `${WEAPONS[a.w].name} can't aim at ${targetLabel(level, a.target)}.`
    if (a.tick < 1 || a.tick > level.ticks) return 'An action is off the timeline.'
  }
  return null
}

