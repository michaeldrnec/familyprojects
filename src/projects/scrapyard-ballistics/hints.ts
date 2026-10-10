// Post-flight hints for the debrief, plus the hub's strategy guide. Each
// rule looks at what went wrong this flight (and the rig that flew) and
// suggests one fix; the debrief shows the first few that match, most
// urgent first, then a nudge toward the next open contract.
import { CONTRACTS, contractVisible } from './contracts'
import type { FlightOutcome, FlightSim } from './flight'
import type { ContractId } from './parts'
import { blueprintStats, defOf, partCenter, type Blueprint } from './workshop'

const MAX_HINTS = 3

type Rule = (o: FlightOutcome, bp: Blueprint) => string | null

const RULES: Rule[] = [
  (o, bp) => {
    if (o.kind !== 'scrubbed') return null
    const s = blueprintStats(bp)
    if (s.thrust === 0) return 'Nothing lit. Wire your bottom engines to IGNITE (Auto-wire does it for you).'
    if (s.twr < 1) return `Liftoff TWR was ${s.twr.toFixed(2)}, so it never left the pad. Add an engine or cut heavy plates until TWR is above 1.2.`
    return null
  },
  (o) =>
    o.stats.weldsBroken > 0 && o.stats.maxQ > 14000
      ? `Welds snapped at ${(o.stats.maxQ / 1000).toFixed(0)} kPa of Max-Q. When the MAX-Q light comes on, throttle down (S) until it goes out, then throttle back up.`
      : null,
  (o) =>
    o.stats.weldsBroken > 0 && o.stats.maxQ <= 14000
      ? 'A weld let go. Rusty plates are the weakest link: swap them for Steel Scaffold, keep the stack short and straight, and watch the JOINT STRESS light.'
      : null,
  (o) =>
    o.stats.overheats > 0
      ? 'An engine cooked itself. Don’t sit at full throttle when the OVERHEAT light is on. Ease off for a few seconds and the heat bleeds away.'
      : null,
  (o) =>
    o.stats.burnups > 0
      ? 'Parts burned up from going too fast in thick air. Put a Traffic Cone Nose or Bathtub Capsule on the front, and don’t floor it below 10 km.'
      : null,
  (o) =>
    o.stats.chuteShredded
      ? 'The bedsheet shredded because you opened it too fast. Wait until you’re falling slowly in thick air: wire it to a Barometer set to about 1500 m, going down.'
      : null,
  (o, bp) =>
    o.kind === 'crashed' && !bp.parts.some((p) => defOf(p).chute)
      ? 'No parachute means no pilot. Put a Bedsheet Parachute on top of the command seat.'
      : null,
  (o, bp) =>
    o.kind === 'crashed' && bp.parts.some((p) => defOf(p).chute) && !o.stats.chuteDeployed
      ? 'The chute never opened. Wire it to your last STAGE button or to a Barometer, and actually press that button on the way down.'
      : null,
  (o) =>
    o.kind === 'crashed' && o.stats.chuteDeployed && !o.stats.chuteShredded
      ? `The chute opened, but you still hit at ${o.impactSpeed.toFixed(0)} m/s. Drop the empty lower stage before you open it, or add a second chute.`
      : null,
  (o, bp) => {
    if (o.stats.maxSpin < 1.6) return null
    const s = blueprintStats(bp)
    const fins = bp.parts.filter((p) => defOf(p).fin)
    if (fins.length === 0) return 'It tumbled. Fins near the bottom of the rocket keep the pointy end forward. Use a pair, one on each side (F mirrors them).'
    if (s.com && fins.every((p) => partCenter(p).y < s.com!.y)) return 'It tumbled because your fins sit above the center of mass, which pushes the nose around. Move them down to the tail.'
    if (Math.abs(s.torque) > 1500) return 'It spun because the thrust is off-center. Line the engines up under the center-of-mass roundel until the torque arrow disappears.'
    return 'It started spinning. Steer gently, in short taps. Big inputs at high speed flip the rocket.'
  },
  (o) =>
    o.stats.hardwareFailures > 0
      ? 'Junk hardware fails. When a fault light blinks, hit that engine’s BYPASS: two seconds at half power and it’s fixed.'
      : null,
  (o) =>
    o.kind === 'abandoned'
      ? 'Ending a flight in the air throws away the whole rocket. Fly it down to a chute landing and you get the parts back.'
      : null,
  (o) =>
    o.stats.reachedSpace && !o.stats.orbitAchieved
      ? 'You reached space but fell back. Orbit means going sideways, not just up: start tipping over around 10 km and burn flat near the top until Pe climbs above 80 km.'
      : null,
  (o, bp) => {
    if (o.kind === 'scrubbed' || o.stats.maxAltitude > 3000) return null
    const s = blueprintStats(bp)
    return s.twr > 0 && s.twr < 1.4
      ? `Liftoff TWR was only ${s.twr.toFixed(2)}, so the rocket spent its fuel fighting gravity. Aim for about 1.5–2.`
      : null
  },
]

// The next visible, unfinished contract, phrased as a goal.
const NEXT_GOAL: Record<ContractId, string> = {
  fence: 'Next goal, Clear the Fence (500 m): a lawn chair, two mowers on jerry cans, fins at the bottom and a chute on top will do it.',
  sonic: 'Next goal, Sonic Boom: you need Mach 1 below 10 km. Soda kegs or Firework SRBs in a short, light first stage give you the kick.',
  home: 'Next goal, Bring Her Home: pass 5 km, then land the pilot. Make sure the chute is wired before you try for height.',
  space: 'Next goal, Touch Space (80 km): you need two stages. Blow the bolts when the first stage runs dry so you aren’t hauling the dead weight.',
  radio: 'Next goal, Pirate Radio: bolt the satellite on top, reach a stable orbit (Pe > 80 km), then blow that bolt.',
  roundTrip: 'Next goal, Round Trip: orbit, then burn backwards to drop Pe into the air. A Bathtub Capsule survives the re-entry heat.',
}

export function flightHints(o: FlightOutcome, bp: Blueprint, completed: ContractId[]): string[] {
  const out: string[] = []
  for (const rule of RULES) {
    const hint = rule(o, bp)
    if (hint) out.push(hint)
    if (out.length >= MAX_HINTS) break
  }
  const next = CONTRACTS.find((c) => !completed.includes(c.id) && contractVisible(c, completed))
  if (next) out.push(NEXT_GOAL[next.id])
  else if (out.length === 0) out.push('Every contract is done. Now try it with fewer parts, or chase a higher orbit.')
  return out
}

// The hub's always-available strategy guide.
export const STRATEGY_GUIDE: { title: string; tips: string[] }[] = [
  {
    title: 'Building',
    tips: [
      'Keep the center-of-mass roundel above the engines, and fins below it. Heavy stuff high, fins low.',
      'Liftoff TWR of 1.5–2 is the sweet spot. Below 1.2 you crawl; above 3 you hit Max-Q hard and risk snapping welds.',
      'Build symmetrically. Turn on Sym (Y) to place mirrored pairs, or press F to mirror a single part. Off-center thrust shows up as a red torque arrow.',
      'Check the stage table: every stage wants a TWR above 1 (upper stages can get away with less once they’re high).',
      'Rusty plates are heavy and weak. Swap in Steel Scaffold, then Corrugated Aluminum, as soon as you can afford them.',
      'A Traffic Cone Nose on top cuts drag a lot, and it takes the re-entry heat for whatever sits behind it.',
    ],
  },
  {
    title: 'Staging & wiring',
    tips: [
      'Run Auto-wire first, then tweak it. It gets IGNITE, the bolts and the chute about right.',
      'Turn on stage colours in the workshop: each part is tinted with the button that drops it. If the colours look wrong, the wiring is wrong.',
      'Put an Explosive Bolt Ring between stages and blow it the moment the lower stage is dry. Dead weight kills Δv.',
      'Wire a Barometer, set to about 1500 m going down, to the chute. Then the chute opens even if you forget.',
      'A tank’s pressure valve fires when it runs dry, so wiring it to the next stage gives you hands-free staging.',
    ],
  },
  {
    title: 'Flying',
    tips: [
      'Throttle down through MAX-Q (the light comes on around 14 kPa), then open it up once the air thins.',
      'Steer in small taps. Above Mach 1 a hard input flips the rocket.',
      'For orbit, climb straight up to about 10 km, then tip toward the horizon. Burn flat near the top until Pe is above 80 km.',
      'BYPASS clears any engine fault. Watch OVERHEAT and ease off before it hits 100%.',
      'Hit TEST FIRE on the pad to see each engine’s real thrust. An engine at 94% next to one at 106% will pull the rocket sideways.',
    ],
  },
  {
    title: 'Money',
    tips: [
      'Landing softly gets your parts back, and that saves more than any payout. Always fly with a chute.',
      'Cash grows with the square root of altitude, so contracts are where the real money is. Read the board.',
      'Unlocks come from contracts, not cash. Clear the Fence early to get Scaffold and the Barometer.',
      'Side jobs pay every time. Pass on the ones that don’t suit your rocket and a new one appears.',
      'Hard landings wear parts out: weaker welds, flakier engines. Land soft, and repair your engines before a big flight.',
    ],
  },
]

// The in-flight coach (first few flights): one short tip for whatever
// matters most right now, or null when things are fine.
export function coachTip(sim: FlightSim): string | null {
  if (sim.status === 'ended') return null
  if (sim.testing > 0) return 'Test fire: the clamps hold the rocket down. Each engine’s thrust shows up in the log.'
  if (sim.status === 'pad') return sim.t > 1.5 ? 'Press SPACE (or IGNITE) to light the engines. TEST FIRE checks them first.' : null
  const w = sim.warnings
  const main = sim.mainParts()
  if (main.some((p) => p.failure && p.bypass <= 0)) return 'Engine fault! Hit BYPASS on the red engine in the dashboard.'
  if (w.overheat) return 'An engine is running hot. Ease the throttle (S) for a few seconds.'
  if (w.maxQ) return 'MAX-Q! Press S to throttle down until the light goes out.'
  if (w.stress) return 'The welds are straining. Throttle down, and don’t steer hard.'
  if (w.spin) return 'Spinning! Let go of the steering, then tap the other way gently.'
  const packedChute = main.some((p) => p.def.chute && p.chute === 'packed')
  if (packedChute && sim.verticalSpeed < -3 && sim.altitude < 2500) {
    return sim.q < 2500
      ? 'Falling! Pop the chute now: press the STAGE button it’s wired to.'
      : 'Falling too fast for the bedsheet. Wait for q to drop under 2.5 kPa, then pop the chute.'
  }
  const idle = main.some((p) => p.def.engine && !p.ignited && (p.def.engine.internalFuel ? p.fuel > 0 : true))
  if (sim.thrustNow < 1 && sim.verticalSpeed > 0 && idle && sim.fuelFraction > 0.05) {
    return 'Engines are quiet. Press the next STAGE button to drop the empty stage and light the next one.'
  }
  return null
}
