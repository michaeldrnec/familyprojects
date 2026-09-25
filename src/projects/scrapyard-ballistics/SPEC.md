# Scrapyard Ballistics (The Junker's Space Program)

> Bolt a rocket together out of lawn mower engines, soda kegs and surplus fireworks,
> wire up its staging by hand, then fly it through Max-Q, flaky hardware and an
> orbital insertion burn. Crash, salvage what survived, and try again.

Status: **built**. See the build order below.

## 1. Pitch

You're an eccentric backwoods inventor trying to reach orbit with no aerospace budget.
Each run has two quick, high-stakes halves: **Fabrication** (build and wire the rig in
a blueprint workshop) and **Flight** (fly it by hand from a rattling telemetry
dashboard). Every flight pays cash by altitude and contract. Whatever parts survive the
landing go back into your scrap inventory, and the Black Market sells better junk.

## 2. Structure: the roguelite loop

`hub → workshop → wiring → flight → debrief → hub`

- **Hub**: shows cash, the contract board, the Black Market and the Launch button.
- **Workshop**: place parts from your *inventory* on a 9×14 blueprint grid.
- **Wiring**: draw trigger wires from dashboard buttons and part sensors to part actions.
- **Flight**: the live sim. The flight ends when you land, crash, or press "End flight".
- **Debrief**: stats, contracts completed, cash earned, parts salvaged and parts lost.

Inventory is physical. Launching removes every part on the rocket from inventory, and
only recovered parts come back. A free "scrap pile" dole always tops the inventory back
up to a minimal launchable kit, so a run can never soft-lock.

## 3. Fabrication

- Grid cells are 1 m. A part is 1×1 or 1×2 and can rotate in 90° steps.
- Adjacent parts are welded wherever both touching faces are attachable (an engine's
  nozzle face isn't, and a nose cone or chute only attaches at its base).
- Live overlays show the center of mass, the center of thrust, the net thrust torque
  about the COM (a torque arrow and a kN·m readout), total mass, liftoff TWR and Δv.
- Warnings (no command seat, nothing ignitable, disconnected parts, unwired engines)
  are advisory. You're allowed to launch a bad idea.

## 4. Wiring (the trigger graph)

- **Sources**: the dashboard buttons `IGNITE` and `STAGE 1–4`, each tank's *pressure
  valve* (fires when the tank runs dry), each self-fuelled engine's *burnout*, the
  Kitchen Timer's *ding* (fires N s after its *start* input), and the Barometer's
  *trip* (fires when passing its set altitude going up or down).
- **Targets**: engine *ignite* and *shutdown*, explosive bolt *blow*, chute *deploy*,
  tank *vent*, and timer *start*.
- One source can feed many targets. Anything unwired never fires. Miswiring is allowed
  and often hilarious. An **Auto-wire** button builds a sensible default: IGNITE lights
  the bottom stage, each STAGE blows the next bolt ring and lights the next engines, and
  the last STAGE deploys the chutes.

## 5. Physics

Matter.js simulates the rig's internal dynamics: each part is a rigid body and each
weld is two zero-length constraints along the shared edge. The Matter world has gravity
switched off and sits in a **free-falling floating frame**:

- Our own float64 integrator tracks the frame's position and velocity around the
  planet's center under central gravity. Gravity is uniform across a small craft, so
  Matter never sees it.
- Thrust (at each nozzle), per-part drag (at each part's own position, which creates
  torque) and fin/gyro torques are applied in Matter.
- After every step, the COM position and velocity of the part group that holds the
  command seat are folded into the frame and subtracted from every body. That keeps
  Matter's numbers small whether you're on the pad or at 2 km/s.
- **Atmosphere** (below 80 km): `ρ = ρ0·e^(−h/H)`. Each part gets
  `F_d = ½ρv²·C_d·A`, and parts shielded by an upwind neighbor get much less. There's a
  wind-shear band at 6–14 km, and `q = ½ρv²` drives the Max-Q light.
- **Vacuum**: no drag. With the engines off above 80 km, time warp up to ×1000 freezes
  Matter and propagates the frame alone.
- Orbit elements (Ap, Pe, e) come from the state vector every frame. The
  trajectory is drawn as a conic, and "stable orbit" means Pe > 80 km.
- **Planet**: a scaled-down Earth. Radius 300 km, surface gravity 9.81 m/s²,
  atmosphere 80 km (scale height 6.5 km), low-orbit speed about 1.5 km/s.
- **Balance, checked headlessly**: the piloted starter rig reaches about 1–2 km; a
  3×turbopump two-stage rig with fins on both stages reaches a 107 × 90 km orbit with
  about 10% fuel left.
- **Joint stress**: a section cut through every weld line. Newton on the far side of
  the cut (external forces plus rigid-body acceleration, rotation and spin) gives a
  force and a bending moment, which the welds on that line share like a bolt group.
  A load above the weaker part's rating breaks the weld, and sustained heavy load
  also fatigues it. Everything cut off from the command seat becomes debris. (Matter's
  own pin stretch turned out to be a poor load signal: the iterative solver spreads
  error unevenly along long chains.)
- **Aero scale**: face drag is multiplied by 0.35, because a 1 m grid cell of junk is
  narrower than a flat square metre. Without it even the starter rig is limited to a
  terminal velocity of 35 m/s. Fins and chutes aren't scaled.
- **Bolt rings clamp nozzles**: an engine's nozzle face welds to nothing *except* an
  explosive bolt, so an upper stage's engine can sit straight on its staging ring.

## 6. Flight & failures

- **Controls**: throttle, steer (engine gimbal, fin deflection and gyroscope torque),
  IGNITE, STAGE 1–4, per-engine BYPASS and CUT, per-tank VENT, SAS (with a guidance
  computer), time warp, map view and End flight.
- **Keyboard**: `W/S` throttle, `A/D` steer, `Space` IGNITE, `1–4` stage, `,`/`.` warp,
  `M` map, `T` SAS.
- **Imperfect hardware**: each engine rolls a hidden ±thrust variance per flight, and
  a seeded hazard per burning second can cause failures:
  - *Stuck valve*: throttle locks until BYPASS is used.
  - *Running hot*: heat builds 2.5× faster, and the engine explodes at 100% heat.
  - *Uneven burn*: the thrust vector skews and spins the craft.
  - *Fuel leak*: the stage's fuel drains fast.
  BYPASS clears any failure after a 2 s half-power spool. Heat is a separate gauge: an
  engine explodes at 100% heat whatever its failure state.
- **Warning lights**: MAX-Q, OVERHEAT, VALVE STUCK, SPIN, JOINT STRESS, LOW FUEL,
  ORBIT.
- **Re-entry**: heating ∝ ρv³. Parts without heat tolerance burn up. The Bathtub
  Capsule and the Traffic Cone Nose tolerate it.

## 7. Landing, salvage & economy

- Touching the ground ends the flight. Each part in the main craft survives if the
  impact speed is below its crash tolerance. Ocean landings (a band of longitude)
  soften impacts ×1.5.
- Debris that separated with a deployed chute is recovered. Other debris is lost.
- A craft left in space at End flight is lost, unless you're in a stable orbit with
  a delivered satellite, in which case the satellite counts.
- **Cash**: `4·√(max altitude in m)` plus contract payouts, plus a bonus for any
  stable orbit.

## 8. Contracts & unlocks

1. **Clear the Fence**: reach 500 m. Unlocks Steel Scaffold and Barometer.
2. **Sonic Boom**: Mach 1 below 10 km. Unlocks Propane Torch, Propane Tank and
   Gyroscope.
3. **Touch Space**: reach 80 km. Unlocks Corrugated Aluminum, Turbopump, Guidance
   Computer and the Bathtub Capsule, and grants a free Radio Satellite.
4. **Bring Her Home**: land the command seat intact after passing 5 km.
5. **Pirate Radio**: release the Radio Satellite into a stable orbit.
6. **Round Trip**: reach a stable orbit, then land the command seat intact.

Stretch goal (not in v1): Moon slingshot, with a second gravity body and a sphere of
influence.

## 9. Persistence

`localStorage` key `scrapyard-ballistics:save` holds cash, inventory counts, completed
contracts, best altitude, flight count and the last blueprint and wiring. The hub has a
Reset save button.

## 10. Audio & visuals

- Audio is synthesized with the Web Audio API only, following `ion-perimeter/audio.ts`.
  Cues: mower sputter, keg hiss, firework crackle, bolt pop, joint creak, alarm klaxon,
  chute whump, orbit chime, place click, crash.
- The workshop and wiring views are a blueprint: a cyan grid, white line art and dashed
  COM/COT markers.
- Flight is a green-phosphor vector wireframe that jitters with `q` and joint stress.
  The sky fades from blue to black with altitude, over scanlines, flickering exhaust
  plumes, a minimap with the conic trajectory and a full map view.

## 11. Technical notes (`src/projects/scrapyard-ballistics/`)

- `ScrapyardBallistics.tsx`: the phase machine and save state. The screen
  components are `Hub.tsx`, `Shop.tsx`, `Workshop.tsx`, `Wiring.tsx`, `Flight.tsx`
  and `Debrief.tsx`. `useCanvas.ts` is a DPR-aware canvas plus rAF hook, and
  `format.ts` holds the display helpers.
- `parts.ts`: part catalog. `workshop.ts`: blueprint grid logic, welds, stage groups,
  COM/COT and validation. `wiring.ts`: ports, auto-wire and runtime evaluator.
- `structure.ts`: builds the Matter bodies and welds, measures stress, breaks welds
  and finds components.
- `orbit.ts`: frame gravity integrator and conic elements. `atmosphere.ts`: density,
  drag, q, Mach and wind.
- `flight.ts`: the fixed-step sim orchestrator (no DOM). `failures.ts`: hazard rolls.
- `contracts.ts`, `economy.ts`, `shop.ts`, `progress.ts`: meta-progression.
- `render/partArt.ts`, `render/blueprint.ts`, `render/telemetry.ts`: canvas drawing.
- `audio.ts`, `rng.ts`, `explosions.ts`: copied per the repo convention.
- Matter.js is code-split: the route is `lazy()`-loaded in `App.tsx`.
