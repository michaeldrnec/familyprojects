# Solar Ward

> Missile Command meets Galaga: swing your orbital turret around a dying star, intercept photon
> beams and diving fighters, and keep the core's five sectors alive as the assault never stops
> escalating.

Status: **draft spec — not yet built**. This document describes the design; no game code exists yet.

## 1. Pitch

A lone turret orbits a dying star. Alien dreadnoughts ring the sky, firing slow telegraphed
photon beams and launching fast weaving fighters, all converging on the core. You can't be
everywhere — swinging your turret to one side of the sky means the other side is briefly
undefended, and everything you fly past on the way still counts. There's no ending, only a score
to chase and a run that gets harder wave after wave until the core finally gives out.

## 2. Theme & fantasy

- A single desperate defender holding the line around humanity's (or whoever's) last dying star,
  besieged from every direction at once.
- Visual mood: a slowly pulsing, dimming star at the center with drifting corona particles for
  atmosphere, a dark starfield backdrop, and glowing angular alien silhouettes fixed at the rim —
  classic vector-arcade energy rather than painterly rendering.
- The tension is spatial, not resource-based (unlike Xenofuse's timer or Starwarden's fuel/crystals):
  it's entirely about *where your turret is pointed right now* versus where the next threat is
  going to land.

## 3. Core mechanic: momentum-based orbital aiming

The turret orbits the star at a **fixed radius** — no moving inward or outward, so the entire
skill lives in one axis: angular position around the circle.

- **Left / Right** apply angular *thrust*, not direct rotation: holding a direction accelerates
  angular velocity, and releasing it lets momentum carry the turret onward. Stopping precisely on
  a target's angle means thrusting the other way to brake, not just letting go — the same
  thrust-vector-with-inertia feel Starwarden uses for linear flight, mapped onto a circle. This is
  what makes "constantly managing thrusters to stay aligned" a real, learnable skill rather than a
  snap-to-target cursor.
- **Fire** launches a shot outward along the turret's current angle. Hitting an inbound beam or
  fighter requires actually being lined up with it, not just pointed roughly its way — the
  Missile-Command-style precision-under-time-pressure at the heart of the game.
- **Overcharge Pulse** (a second, rarer weapon) recharges passively over time, capped at a small
  number of stored charges. Triggering it detonates a radial burst around the turret's current
  position that clears every beam and fighter caught in range — a panic button for when the sky
  is too full to solve shot-by-shot, and a deliberate multi-kill scoring opportunity when timed
  well rather than panic-mashed.

## 4. Threats

Two threat families, matching the two halves of the mashup, both aimed at the core:

### 4.1 Lancer dreadnoughts (the Missile Command half)
- Fixed posts around the rim. Each briefly **telegraphs** before firing — a charging glow at the
  dreadnought plus an audio cue — then launches a slow, straight photon beam inward along a fixed
  angle.
- Rewards reading the telegraph and pre-aiming during the wind-up, the classic Missile-Command
  skill of committing early to an intercept.

### 4.2 Swarm fighters (the Galaga half)
- Launched from dreadnoughts partway through a wave. Curve and weave inward faster than beams,
  and can adjust their target angle mid-flight toward wherever the turret currently is — a
  dogfight-timing target rather than a straight-line intercept.
- Worth more points than a beam, and meaningfully harder to hit given the weaving path and speed.

### 4.3 Siege dreadnoughts (escalation, introduced mid-run)
- Fire a **3-beam fan** at once instead of a single beam, forcing a choice: which beam gets
  intercepted, and which ones are accepted as risk against the core.

## 5. Core Integrity: five sectors, not one health bar

The star is ringed by **five independent integrity segments**, arranged around it at fixed
angular sectors (echoing Missile Command's multiple cities, but wrapped radially around the
defended object instead of lined up along the ground). A beam or fighter that isn't intercepted
damages specifically the segment at the angle it arrived from — not a shared pool.

- This ties the orbital-aiming mechanic directly to the stakes: neglecting one side of the sky for
  too long costs that side specifically, visibly, and separately from the rest.
- Each segment renders as a glowing arc around the star that visibly dims/cracks as it takes
  damage, and goes dark when destroyed.
- **Game over** when all five segments are destroyed.
- This segment-and-angle relationship is the one genuinely novel piece tying "orbital turret" and
  "Missile Command cities" together into something that isn't just a reskin of either source.

## 6. Structure: endless escalating waves

Both Missile Command and Galaga are endless arcade score-chases, not finite campaigns — Solar Ward
follows that shape rather than Gravity Well's fixed 30 tiers or Xenofuse's single-bomb sessions:

- Discrete **waves**, each scheduling a set of dreadnought spawns/fire patterns and fighter
  launches. A wave ends when everything it scheduled has either been destroyed or has already hit
  the core.
- A short **wave-cleared** screen shows the score breakdown (see Scoring) before the next wave
  begins — a breather, not a stopping point.
- **Escalation never stops**: each wave adds more dreadnoughts, shortens the telegraph/fire
  cadence, and speeds up beams and fighters. Siege dreadnoughts start appearing from wave 4
  onward. There is no final wave — the run only ends when the core's segments run out.
- This gives Solar Ward a third distinct session shape in the collection, alongside Gravity Well's
  tiered campaign and Starwarden's continuous real-time endless mode.

## 7. Scoring

- Points per beam intercepted; more points per fighter destroyed (reflecting the added difficulty
  of hitting one).
- A **combo multiplier** that climbs with consecutive intercepts and resets the moment any segment
  takes a hit — the classic arcade "keep the streak alive" pressure, directly rewarding good
  angular positioning rather than just raw kill count.
- **Overcharge Pulse multi-kill bonus**: extra points per target beyond the first caught in one
  burst, rewarding a well-timed clear over a panic trigger.
- **End-of-wave bonus** scaled to how much Core Integrity remains, rewarding a clean wave over a
  scraped-through one.

## 8. Controls

- **Left / Right** (arrows or A/D): angular thrust, momentum-based — no direct/instant rotation.
- **Z**: fire.
- **X**: Overcharge Pulse.
- No radial (in/out) movement — the fixed orbit radius keeps the entire skill on one axis.

## 9. Audio & visuals

- **Audio**: synthesized retro SFX via the Web Audio API, the same technique already used in
  `gravity-well/audio.ts` and `starwarden/audio.ts` — no audio files to source or bundle. Planned
  cues: thruster hum (continuous while thrusting), blaster shot, beam-intercepted pop,
  fighter-destroyed explosion, dreadnought telegraph chime (a fair warning cue, not just flavor),
  segment-hit alarm, Overcharge Pulse boom, wave-cleared fanfare, game-over dirge.
- **Visuals**: a pulsing, slowly dimming central star with drifting corona particles for ambiance
  (cosmetic only — not tied to Core Integrity, so the dying-star flavor doesn't get confused with
  the actual health mechanic); a dark starfield backdrop; a glowing guide ring marking the
  turret's orbit; angular dreadnought silhouettes fixed at the rim with a visible telegraph glow
  before firing; beam projectiles rendered as glowing lances; fighters as small angular ships with
  motion trails; particle-burst explosions on every kill; the five integrity segments as glowing
  arcs around the star that visibly dim/crack with damage.

## 10. UI/HUD sketch

- **Main viewport**: the orbital arena — star and its five segments at center, the turret on its
  guide ring, dreadnoughts fixed at the rim, beams/fighters/explosions in flight.
- **HUD**: score and combo multiplier, current wave number, an Overcharge Pulse charge readout
  (with a recharge progress indicator when not full), and the five segments themselves doubling as
  the "health" HUD since they're already drawn directly in the scene.
- **Wave-cleared screen**: score breakdown (base score, combo bonus, Overcharge bonus, end-of-wave
  integrity bonus) before continuing to the next wave.
- **Start screen**: brief instructions and controls.
- **Game-over screen**: final score, best score for the session, restart action.

## 11. Technical notes for future build (non-binding)

Anticipated module split, following the pattern already established across the repo's other
canvas games (`gravity-well/`, `starwarden/`):

- `SolarWard.tsx` — main component: canvas render loop, keyboard input, game state machine
  (start / playing / wave-cleared / game-over).
- `SolarWard.css` — HUD/layout styling, matching the existing `.fullscreen` canvas page pattern
  (would need the same `:has()` fullscreen override added to `App.css` that Gravity Well and
  Starwarden already use).
- `physics.ts` — turret angular momentum model (thrust, drag, fixed-radius orbit), reusing the
  thrust-vector approach from `starwarden/physics.ts` mapped onto a circle instead of a line.
- `dreadnoughts.ts` — Lancer/Siege dreadnought definitions, rim placement, telegraph/fire timing.
- `fighters.ts` — Swarm fighter spawn/movement (curving, weaving, target-seeking).
- `waves.ts` — wave scheduling and the never-ending escalation curve, akin to how
  `gravity-well/levels.ts` + `levelGen.ts` split fixed definitions from procedural generation.
- `overcharge.ts` — Overcharge Pulse constants, directly analogous to `starwarden/nova.ts`.
- `explosions.ts` — particle-burst effects, reusing the approach in `starwarden/explosions.ts`.
- `scoring.ts` — point values, combo multiplier, end-of-wave bonus calculation.
- `audio.ts` — synthesized SFX, following `starwarden/audio.ts` / `gravity-well/audio.ts`.
- `rng.ts` — seeded PRNG (the same mulberry32 implementation already duplicated in
  `gravity-well/rng.ts`, `xenofuse/rng.ts`, and `starwarden/rng.ts`).

This is a starting point for the build discussion, not a commitment — subject to change once
implementation begins.

## 12. Open questions for the user (resolve before build)

- **Segment count/layout**: is five segments the right number, or would a different count
  (matching Missile Command's classic three-or-six city layouts more closely) feel better?
- **Fighters reaching the core**: should a fighter that reaches an undefended segment deal instant
  damage (simple, matches beams) or "dock" and drain that segment over time until shot off (more
  tense, more novel, more implementation complexity)? This spec assumes instant damage for a
  solid v1; docking is a plausible v2 addition.
- **Boss waves**: should a periodic boss dreadnought (e.g. every 10 waves) be in scope for v1, or
  left out in favor of the plain escalation curve described above?
- **Visual depth**: flat vector/glow style (fastest to build, closest to arcade-era) vs. a more
  rendered look with gradient-shaded bodies (matching Gravity Well's planets/asteroids) — how much
  visual polish is in scope for v1?
- **Music**: any ambient background music expectations, or SFX-only like the other games?
