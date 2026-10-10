// A dry run of the wiring, for the workshop: replays IGNITE and STAGE 1-4
// (plus the automatic triggers they set off -- tanks running dry, engine
// burnouts, timers) against the weld graph to work out what is still
// attached, what burns and what drops at each step. From that come the
// per-stage TWR / delta-v table, the stage colours on the board, and the
// wiring warnings. It's rough on purpose: every lit engine is assumed to
// burn all the fuel it can reach before the next event, and barometers
// (which fire at an altitude, not a moment) are ignored.
import { G0, fuelFlow, type PartDef } from './parts'
import { components, defOf, welds, type Blueprint, type PlacedPart } from './workshop'
import { BUTTONS, BUTTON_LABEL, OUTPUT_LABEL, type ButtonId, type SourceRef, type Wire } from './wiring'

export interface StagePlan {
  label: string // what starts it: a button, or an automatic trigger
  color: ButtonId | 'part' // matches the wire colours
  engines: number[] // uids burning this stage
  thrust: number // N
  startMass: number // kg
  twr: number // at the start of the stage, sea-level gravity
  deltaV: number // m/s
}

export interface Staging {
  stages: StagePlan[]
  // Stage index each part flies through last before it drops off (or the
  // final stage for whatever stays on). -1 for parts that never fly.
  stageOf: Map<number, number>
  totalDeltaV: number
  warnings: string[]
}

interface Event {
  label: string
  color: ButtonId | 'part'
  wires: Wire[]
}

const MAX_EVENTS = 24 // a timer loop can't run forever

export function planStaging(bp: Blueprint): Staging {
  const byUid = new Map(bp.parts.map((p) => [p.uid, p]))
  const def = (uid: number): PartDef => defOf(byUid.get(uid)!)
  const allWelds = welds(bp)
  const command = bp.parts.find((p) => defOf(p).command)
  const warnings = wiringWarnings(bp, allWelds)

  const blown = new Set<number>() // bolts that have fired
  const lit = new Set<number>()
  const spent = new Set<number>() // engines / tanks with no fuel left
  const fuelLeft = new Map<number, number>()
  for (const p of bp.parts) {
    const d = defOf(p)
    const f = d.tank?.fuel ?? d.engine?.internalFuel ?? 0
    if (f > 0) fuelLeft.set(p.uid, f)
  }

  const attachedNow = (): Set<number> => {
    const uids = bp.parts.filter((p) => !blown.has(p.uid)).map((p) => p.uid)
    const edges = allWelds.filter((w) => !blown.has(w.a) && !blown.has(w.b))
    const comps = components(uids, edges)
    if (command) return new Set(comps.find((c) => c.includes(command.uid)) ?? [])
    return new Set(comps.reduce<number[]>((best, c) => (c.length > best.length ? c : best), []))
  }

  const wiresFrom = (src: SourceRef) =>
    bp.wires.filter((w) =>
      src.kind === 'button'
        ? w.from.kind === 'button' && w.from.id === src.id
        : w.from.kind === 'part' && w.from.uid === src.uid && w.from.port === src.port,
    )

  const stages: StagePlan[] = []
  const stageOf = new Map<number, number>()
  let attached = attachedNow()
  const auto: Event[] = []
  const buttons = BUTTONS.filter((b) => wiresFrom({ kind: 'button', id: b }).length > 0)
  let events = 0

  while (events++ < MAX_EVENTS) {
    const ev =
      auto.shift() ??
      (() => {
        const b = buttons.shift()
        return b ? { label: BUTTON_LABEL[b], color: b, wires: wiresFrom({ kind: 'button', id: b }) } : undefined
      })()
    if (!ev) break

    // Fire the event: blow bolts, light engines, start timers.
    for (const w of ev.wires) {
      if (!byUid.has(w.to.uid)) continue
      if (w.to.port === 'blow') blown.add(w.to.uid)
      else if (w.to.port === 'ignite') lit.add(w.to.uid)
      else if (w.to.port === 'start') {
        const ding = wiresFrom({ kind: 'part', uid: w.to.uid, port: 'ding' })
        if (ding.length > 0) auto.push({ label: `${def(w.to.uid).name} ${OUTPUT_LABEL.ding}`, color: 'part', wires: ding })
      }
    }
    const before = attached
    attached = attachedNow()
    const cur = Math.max(0, stages.length - 1)
    for (const u of before) if (!attached.has(u)) stageOf.set(u, cur)

    // Burn: each lit, attached engine takes all the fuel it can reach.
    const feed = feedGroups(bp, allWelds, attached, blown)
    const burning = [...lit].filter((u) => attached.has(u) && !spent.has(u) && hasFuel(u))
    if (burning.length === 0) continue
    let startMass = 0
    for (const u of attached) startMass += defOf(byUid.get(u)!).mass + (fuelLeft.get(u) ?? 0)
    let thrust = 0
    let flow = 0
    let burned = 0
    const dried: number[] = []
    for (const u of burning) {
      const e = def(u).engine!
      thrust += e.thrust
      flow += fuelFlow(e)
    }
    for (const u of burning) {
      const e = def(u).engine!
      const sources = e.internalFuel ? [u] : [...attached].filter((t) => def(t).tank && feed.get(t) === feed.get(u))
      for (const s of sources) {
        const f = fuelLeft.get(s) ?? 0
        if (f <= 0) continue
        burned += f
        fuelLeft.set(s, 0)
        dried.push(s)
      }
      spent.add(u)
    }
    const isp = flow > 0 ? thrust / flow / G0 : 0
    const endMass = startMass - burned
    stages.push({
      label: ev.label,
      color: ev.color,
      engines: burning,
      thrust,
      startMass,
      twr: startMass > 0 ? thrust / (startMass * G0) : 0,
      deltaV: endMass > 0 && isp > 0 ? isp * G0 * Math.log(startMass / endMass) : 0,
    })
    // Everything that ran dry fires its "runs dry" wires next.
    for (const s of dried) {
      const w = wiresFrom({ kind: 'part', uid: s, port: 'empty' })
      if (w.length > 0) auto.push({ label: `${def(s).name} ${OUTPUT_LABEL.empty}`, color: 'part', wires: w })
    }
  }

  function hasFuel(u: number): boolean {
    const e = def(u).engine
    if (!e) return false
    if (e.internalFuel) return (fuelLeft.get(u) ?? 0) > 0
    return true // tank-fed: the burn step finds out
  }

  const last = Math.max(0, stages.length - 1)
  for (const u of attached) stageOf.set(u, last)
  if (stages.length === 0) stageOf.clear()
  for (const p of bp.parts) if (!stageOf.has(p.uid)) stageOf.set(p.uid, -1)

  return { stages, stageOf, totalDeltaV: stages.reduce((s, st) => s + st.deltaV, 0), warnings }
}

// Fuel lines don't cross a bolt ring: feed groups are the attached parts'
// components with every bolt-adjacent weld cut.
function feedGroups(bp: Blueprint, allWelds: ReturnType<typeof welds>, attached: Set<number>, blown: Set<number>): Map<number, number> {
  const bolts = new Set(bp.parts.filter((p) => defOf(p).bolt).map((p) => p.uid))
  const edges = allWelds.filter((w) => !bolts.has(w.a) && !bolts.has(w.b) && !blown.has(w.a) && !blown.has(w.b))
  const out = new Map<number, number>()
  components([...attached], edges).forEach((g, i) => g.forEach((u) => out.set(u, i)))
  return out
}

function wiringWarnings(bp: Blueprint, allWelds: ReturnType<typeof welds>): string[] {
  const out: string[] = []
  const targeted = (p: PlacedPart, port: string) => bp.wires.some((w) => w.to.uid === p.uid && w.to.port === port)
  const engines = bp.parts.filter((p) => defOf(p).engine)
  const unlit = engines.filter((p) => !targeted(p, 'ignite'))
  if (bp.wires.length > 0 && unlit.length > 0) out.push(`${unlit.length} engine(s) aren’t wired to light at all.`)

  const feed = feedGroups(bp, allWelds, new Set(bp.parts.map((p) => p.uid)), new Set())
  const dry = engines.filter(
    (p) => !defOf(p).engine!.internalFuel && !bp.parts.some((t) => defOf(t).tank && feed.get(t.uid) === feed.get(p.uid)),
  )
  if (dry.length > 0) out.push(`${dry.length} engine(s) have no fuel tank on their own stage. Fuel doesn’t flow through a bolt ring.`)

  const chutes = bp.parts.filter((p) => defOf(p).chute)
  if (bp.wires.length > 0 && chutes.some((p) => !targeted(p, 'deploy'))) out.push('A parachute isn’t wired to anything, so it will never open.')
  const bolts = bp.parts.filter((p) => defOf(p).bolt)
  if (bp.wires.length > 0 && bolts.some((p) => !targeted(p, 'blow'))) out.push('A bolt ring isn’t wired, so that stage can never drop off.')
  return out
}

