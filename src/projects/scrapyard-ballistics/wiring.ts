// The trigger graph (SPEC.md section 4). Wires run from a source (a
// dashboard button or a part's output) to a part's input. Nothing checks
// that the wiring is *sensible* -- a chute wired to IGNITE deploys on the
// pad, and that's the joke. Pure logic: the flight sim owns the clock and
// executes whatever actions come back out of the runtime.
import { PART_DEFS } from './parts'
import { components, defOf, welds, type Blueprint, type PlacedPart } from './workshop'

export type ButtonId = 'IGNITE' | 'STAGE1' | 'STAGE2' | 'STAGE3' | 'STAGE4'
export const BUTTONS: ButtonId[] = ['IGNITE', 'STAGE1', 'STAGE2', 'STAGE3', 'STAGE4']
export const BUTTON_LABEL: Record<ButtonId, string> = {
  IGNITE: 'IGNITE',
  STAGE1: 'STAGE 1',
  STAGE2: 'STAGE 2',
  STAGE3: 'STAGE 3',
  STAGE4: 'STAGE 4',
}

export type OutputPort = 'empty' | 'ding' | 'trip'
export type InputPort = 'ignite' | 'shutdown' | 'blow' | 'deploy' | 'vent' | 'start'

export type SourceRef = { kind: 'button'; id: ButtonId } | { kind: 'part'; uid: number; port: OutputPort }

export interface Wire {
  from: SourceRef
  to: { uid: number; port: InputPort }
}

export interface PartSettings {
  delay?: number // timer seconds
  altitude?: number // barometer metres
  direction?: 'up' | 'down' // barometer trips when passing its altitude this way
}

export const DEFAULT_TIMER_DELAY = 5
export const DEFAULT_BARO_ALT = 3000

export const OUTPUT_LABEL: Record<OutputPort, string> = {
  empty: 'runs dry',
  ding: 'ding',
  trip: 'trips',
}

export const INPUT_LABEL: Record<InputPort, string> = {
  ignite: 'ignite',
  shutdown: 'shut down',
  blow: 'blow bolts',
  deploy: 'deploy',
  vent: 'vent fuel',
  start: 'start',
}

export function outputsOf(p: PlacedPart): OutputPort[] {
  const def = defOf(p)
  if (def.tank) return ['empty']
  if (def.engine?.internalFuel) return ['empty']
  if (def.timer) return ['ding']
  if (def.barometer) return ['trip']
  return []
}

export function inputsOf(p: PlacedPart): InputPort[] {
  const def = defOf(p)
  if (def.engine) return def.engine.canShutdown ? ['ignite', 'shutdown'] : ['ignite']
  if (def.bolt) return ['blow']
  if (def.chute) return ['deploy']
  if (def.tank) return ['vent']
  if (def.timer) return ['start']
  return []
}

export function sourceKey(s: SourceRef): string {
  return s.kind === 'button' ? `btn:${s.id}` : `p:${s.uid}:${s.port}`
}

export function sameWire(a: Wire, b: Wire): boolean {
  return sourceKey(a.from) === sourceKey(b.from) && a.to.uid === b.to.uid && a.to.port === b.to.port
}

export function settingsFor(bp: Blueprint, uid: number): PartSettings {
  const p = bp.parts.find((q) => q.uid === uid)
  const s = bp.settings[uid] ?? {}
  if (!p) return s
  const def = PART_DEFS[p.partId]
  return {
    delay: def.timer ? (s.delay ?? DEFAULT_TIMER_DELAY) : undefined,
    altitude: def.barometer ? (s.altitude ?? DEFAULT_BARO_ALT) : undefined,
    direction: def.barometer ? (s.direction ?? 'down') : undefined,
  }
}

// ---------------------------------------------------------------------------
// Auto-wire: a sensible default so a first-time player can just launch.
// Stage groups are the components you get with every bolt removed; they're
// ordered by how many bolts separate them from the command seat. The
// farthest groups light on IGNITE, each STAGE blows the next ring of bolts
// inward and lights the engines behind it, and the chutes go last (or on
// a barometer if there is one).
// ---------------------------------------------------------------------------

export function autoWire(bp: Blueprint): Blueprint {
  const wires: Wire[] = []
  const settings = { ...bp.settings }
  const bolts = bp.parts.filter((p) => defOf(p).bolt)
  const boltUids = new Set(bolts.map((b) => b.uid))
  const nonBolt = bp.parts.filter((p) => !boltUids.has(p.uid))
  const allWelds = welds(bp)
  const groupList = components(
    nonBolt.map((p) => p.uid),
    allWelds.filter((w) => !boltUids.has(w.a) && !boltUids.has(w.b)),
  )
  const groupOf = new Map<number, number>()
  groupList.forEach((g, i) => g.forEach((u) => groupOf.set(u, i)))

  // bolt -> adjacent groups
  const boltGroups = new Map<number, Set<number>>()
  for (const w of allWelds) {
    for (const [bolt, other] of [[w.a, w.b], [w.b, w.a]]) {
      if (!boltUids.has(bolt) || boltUids.has(other)) continue
      if (!boltGroups.has(bolt)) boltGroups.set(bolt, new Set())
      boltGroups.get(bolt)!.add(groupOf.get(other)!)
    }
  }

  const command = bp.parts.find((p) => defOf(p).command)
  const depth = new Map<number, number>()
  if (command) {
    const start = groupOf.get(command.uid)!
    depth.set(start, 0)
    const queue = [start]
    while (queue.length) {
      const g = queue.shift()!
      for (const gs of boltGroups.values()) {
        if (!gs.has(g)) continue
        for (const n of gs) {
          if (depth.has(n)) continue
          depth.set(n, depth.get(g)! + 1)
          queue.push(n)
        }
      }
    }
  }
  // Groups not reachable from the seat (loose junk) just count as depth 0.
  groupList.forEach((_, i) => {
    if (!depth.has(i)) depth.set(i, 0)
  })

  const enginesAtDepth = (d: number) =>
    nonBolt.filter((p) => defOf(p).engine && depth.get(groupOf.get(p.uid)!) === d)
  let maxDepth = 0
  for (const d of depth.values()) maxDepth = Math.max(maxDepth, d)
  // If the outermost stages carry no engines (a bare payload ring), start
  // from the deepest level that does.
  let igniteDepth = maxDepth
  while (igniteDepth > 0 && enginesAtDepth(igniteDepth).length === 0) igniteDepth--

  for (const e of enginesAtDepth(igniteDepth)) {
    wires.push({ from: { kind: 'button', id: 'IGNITE' }, to: { uid: e.uid, port: 'ignite' } })
  }

  let stage = 1
  for (let d = maxDepth; d >= 1 && stage <= 4; d--) {
    const ringBolts = bolts.filter((b) => {
      const gs = boltGroups.get(b.uid)
      if (!gs) return false
      const ds = [...gs].map((g) => depth.get(g)!)
      return Math.max(...ds) === d && Math.min(...ds) === d - 1
    })
    if (ringBolts.length === 0) continue
    const id = `STAGE${stage}` as ButtonId
    for (const b of ringBolts) wires.push({ from: { kind: 'button', id }, to: { uid: b.uid, port: 'blow' } })
    if (d - 1 < igniteDepth) {
      for (const e of enginesAtDepth(d - 1)) wires.push({ from: { kind: 'button', id }, to: { uid: e.uid, port: 'ignite' } })
    }
    stage++
  }

  const chutes = bp.parts.filter((p) => defOf(p).chute)
  const baro = bp.parts.find((p) => defOf(p).barometer)
  if (chutes.length > 0) {
    if (baro) {
      settings[baro.uid] = { altitude: DEFAULT_BARO_ALT, direction: 'down', ...settings[baro.uid] }
      for (const c of chutes) wires.push({ from: { kind: 'part', uid: baro.uid, port: 'trip' }, to: { uid: c.uid, port: 'deploy' } })
    } else {
      const id = `STAGE${Math.min(stage, 4)}` as ButtonId
      for (const c of chutes) wires.push({ from: { kind: 'button', id }, to: { uid: c.uid, port: 'deploy' } })
    }
  }

  return { ...bp, wires, settings }
}

// ---------------------------------------------------------------------------
// Runtime: the flight feeds in source firings and the clock; out come
// part actions to execute. Timers are the only stateful nodes.
// ---------------------------------------------------------------------------

export interface WireAction {
  uid: number
  port: InputPort
}

export class WiringRuntime {
  private bySource = new Map<string, Wire[]>()
  private pendingDings: { uid: number; at: number }[] = []
  private delays = new Map<number, number>()
  private tripped = new Set<string>()

  constructor(bp: Blueprint) {
    for (const w of bp.wires) {
      const k = sourceKey(w.from)
      if (!this.bySource.has(k)) this.bySource.set(k, [])
      this.bySource.get(k)!.push(w)
    }
    for (const p of bp.parts) {
      if (defOf(p).timer) this.delays.set(p.uid, settingsFor(bp, p.uid).delay!)
    }
  }

  // Part-output sources fire at most once per flight (a tank only runs dry
  // once); buttons can be mashed.
  fire(src: SourceRef, now: number): WireAction[] {
    const k = sourceKey(src)
    if (src.kind === 'part') {
      if (this.tripped.has(k)) return []
      this.tripped.add(k)
    }
    const actions: WireAction[] = []
    for (const w of this.bySource.get(k) ?? []) {
      if (w.to.port === 'start') {
        if (!this.pendingDings.some((d) => d.uid === w.to.uid)) {
          this.pendingDings.push({ uid: w.to.uid, at: now + (this.delays.get(w.to.uid) ?? DEFAULT_TIMER_DELAY) })
        }
      } else {
        actions.push({ uid: w.to.uid, port: w.to.port })
      }
    }
    return actions
  }

  // Returns timers that just rang; the caller fires them as sources so a
  // timer can itself start another timer.
  dueTimers(now: number): number[] {
    const due = this.pendingDings.filter((d) => d.at <= now).map((d) => d.uid)
    if (due.length) this.pendingDings = this.pendingDings.filter((d) => d.at > now)
    return due
  }

  timerRemaining(uid: number, now: number): number | null {
    const d = this.pendingDings.find((x) => x.uid === uid)
    return d ? Math.max(0, d.at - now) : null
  }

  hasWiresFrom(src: SourceRef): boolean {
    return (this.bySource.get(sourceKey(src))?.length ?? 0) > 0
  }
}
