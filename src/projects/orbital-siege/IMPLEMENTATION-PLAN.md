# Orbital Siege: implementation plan

Status: **planned, not started.** The design lives in [SPEC.md](SPEC.md). When the game is built,
fold the decisions below into SPEC.md, set its status to built, and delete this file.

Decisions made with the user when this plan was written:
- **Tone:** the planets are rogue robot fortresses, an automated AI defense grid with no people.
- **Scope:** about 24 handcrafted levels (4 sectors × 6) with light upgrades. Every level is
  solvable at base stats.
- **Visuals:** a side-on cross-section of the defense strata.
- **Extras:** solution replay and share codes, and a daily generated puzzle with guaranteed
  solvability.

## Goal
Build **Orbital Siege** under the **Puzzles** category: a deterministic puzzle where you program an
orbital platform's strike timeline to crack layered planetary defenses. The build is a new game, so
it gets a **minor** bump.

## Theme pass (family-friendly reframing)
- The player is the *Warden Platform*, sent to shut down rogue "Sentinel" AI fortresses that took
  over abandoned mining worlds. No people are harmed. Targets are machines ("Command Core" replaces
  "Command Vault").
- **Protected sites** (Ruins, Seed Vault, Preserve) sit in surface slots. Damaging one either fails
  the level (a hard constraint, marked in the intel) or just loses the *Surgical* badge.
- Explosions are stylized: sparks and flashes.

## Resolved gaps & contradictions in the GDD

| Topic | GDD says | Decision |
|---|---|---|
| Heat "misfires" | Overheat causes stutter or misfire | Misfires would be RNG, which breaks pillar 1, so there are none. If a launch would push heat over cap **H**, it **stutters one tick** (and cascades). The sequencer previews this live. |
| Magnetosphere | Matrix: refracts lasers, neutralizes EMP. Sample 3-2: laser and EMP work through an active one. | Two tiers. **Ion Field (weak)** only scrambles guided missiles. **Magnetosphere (strong)** also refracts UV lasers and absorbs single EMPs. Two EMPs arriving in the same tick *overload* it, dropping it for 2 ticks. Sample 3-2 uses the weak tier, so it stays canonical. |
| Scrambled missile | "Redirects telemetry" | Deterministic: the missile lands one slot over in the field's drift direction (shown in intel), which can be used deliberately. |
| PDC vs. chaff timing | In the sample the lance survives because chaff blinds the PDC | A projectile is **in transit** on ticks strictly between launch and arrival. PDCs only engage in-transit projectiles, so transit-1 weapons (chaff, EMP) can't be intercepted, missiles (transit 2) are exposed for 1 tick, and the lance (transit 3) for 2. Chaff blinds every PDC in its cover zone for its arrival tick and the next. |
| "Exhausting ammunition" (sample) | PDC ammo | Dropped. Blinding fully explains the sample. A PDC fires `barrels` shots per tick (default 1) by its intel-listed priority rule: highest mass, nearest arrival, or first launched. |
| Kinetic shield vs. lance | "Shatters shield (if uncharged)" | The shield has a strength of 1–3. A UV laser costs it 1 (and the laser is absorbed). A lance against strength ≤1 shatters it (strength → 0) and the lance is consumed. Against strength >1 the lance is destroyed. An EMP collapses it for 2 ticks, and a de-powered generator or relay drops it. No regeneration. |
| Same-tick ordering | "EMP drops the shield precisely as the lance arrives" | Fixed tick pipeline (below): **Launch → Effects → Interception → Strikes (beams first, then projectiles in fire order) → Defenses fire → Upkeep.** |
| Retaliation deadline | "Fires at Tick 5" | Batteries fire in the *Defenses* step, after strikes, so a kill on tick 5 still saves you. The UI says "fires at END of tick 5". If a battery is EMP-disabled on its tick, it fires on the first tick it's re-enabled. |
| Charge delay | Every weapon has one, but the sample assumes 0 | Base weapons have charge 0. Charge only matters for the sector-4 weapons. |
| Hypersonic missile, resonance beam, drilling laser | Mentioned but not in the catalog | Added as unlocks (arsenal table). |
| Thermobaric in matrix | Missing | It hits the target slot plus adjacent slots, damaging *exposed light* structures (not bunkers, nothing under a shield). In a **volatile atmosphere** the splash covers the whole surface. It's physical, so PDCs can intercept it and shields block it. |
| Hyper-Velocity badge | "≤3 ticks" | Per-level `parTick`. "≤3" is the default. |
| Minimalist badge | <60% energy | Measured against the level's *base* energy cap, so upgrades can't inflate it. |

## Tick pipeline (the heart of `sim.ts`, pure and deterministic)
For T = 1..N (N is set per level, default 8):
1. **Launch:** each action with `fire + charge` = T (after the heat-stutter shift) launches. Heat is
   added. A beam's arrival is T.
2. **Effects arrive:** EMPs (disable the target, or every defense its relay powers, for 2 ticks)
   and chaff (blinds PDCs).
3. **Interception:** each powered, enabled, un-blinded PDC shoots in-transit physical projectiles by
   its priority rule.
4. **Strikes:** beams, then projectiles in fire order. Each one passes the strata top to bottom:
   ion field/magnetosphere, then shield, then the target's armor. Damage is applied, and
   destroyed relays de-power their linked defenses immediately.
5. **Defenses fire:** batteries at their countdown. If one fires, the platform is lost and the level
   fails at once.
6. **Upkeep:** effect timers tick down, and heat cools by `cool`.

The level is won at the end of any tick in which every objective is destroyed, with no
hard-constraint violation. It is lost on a battery shot, a protected-site hit marked hard, or
reaching tick N with objectives still standing. `simulate(level, plan, platform)` returns a
per-tick event log, a full state snapshot per tick (for playback and scrubbing), the outcome,
energy used, the win tick and collateral.

## Arsenal (starting values; tune in `weapons.ts`)

| Weapon | Unlock | Charge | Transit | Energy | Heat | Physical? | Notes |
|---|---|---|---|---|---|---|---|
| UV Laser | S1 | 0 | 0 | 20 | 4 | no | Kills light structures and PDCs. Drains shields by 1. Refracted by the strong magnetosphere. No effect on hardened targets. |
| Kinetic Lance | S1 | 0 | 3 | 35 | 6 | yes | Kills hardened targets. Ignores fields. Blocked by shields. PDC-exposed for 2 ticks. |
| Chaff Canister | S1 | 0 | 1 | 10 | 1 | — | Blinds PDCs in its zone for 2 ticks. Can't be intercepted. |
| EMP Burst | S2 | 0 | 1 | 20 | 3 | — | Disables a defense or relay network for 2 ticks. No damage. |
| Hypersonic Missile | S2 | 0 | 2 | 20 | 3 | yes, guided | Kills light and medium targets. Exposed 1 tick. Scrambled by fields. |
| Thermobaric Cluster | S3 | 0 | 2 | 30 | 5 | yes | Splash (see above). Collateral risk. |
| Resonance Beam | S4 | 2 | 0 | 40 | 7 | no | Passes through shields and hits what's beneath. Kills light targets. |
| Drill Laser | S4 | 1 | 0 | 35 | 6 | no | Kills hardened targets. Refracted by the strong magnetosphere. |

Base platform: **E = 100 MW** per engagement (the sum of all actions), **H = 10**, **cool = 3/tick**.
Levels may override these.

## Defenses and structures (`defenses.ts`)
- Orbital band: **PDC** (barrels, priority rule, zone of slots).
- Exosphere band: **Ion Field** and **Magnetosphere** (global, with a drift direction).
- Stratosphere band: **Shield dome** (covers a slot range, has a strength, powered by a generator or
  relay).
- Surface: **Command Core** (objective, usually hardened), **Relay** (light, powers linked
  defenses through conduits drawn on screen), **Shield Generator**, **Battery** (countdown),
  **Protected Site**.
- Armor classes: light, medium or hardened. HP defaults to 1. Some sector-4 structures have 2.
- Modifiers: **Solar storm** (EMP lasts 3 ticks), **Dust ring** (physical projectiles in transit on
  tick X are destroyed), **Volatile atmosphere**.

## Campaign (24 levels, `levels/sector1..4.ts`)
Each level stores: the layout, N, any E/H overrides, objectives, hard constraints, `parTick`, and a
**reference solution** (used for dev validation and a "show solution" option after 3 fails).

- **S1 Kepler's Rock (tutorial arc):** laser, lance, chaff. Teaches arrival ticks → armor → PDC
  interception → chaff corridors → battery countdowns → a combined finale.
- **S2 Ferrous Belt:** + EMP and missile. Shields, relays and power networks, the weak ion field and
  scramble drift.
- **S3 Caldera Worlds:** + thermobaric. Protected sites, volatile air, multiple PDCs with differing
  priorities. **Level 3-2 is the GDD's Caldera Fortress**, kept as the canonical example; its
  documented solution must win on tick 4.
- **S4 Core Grid:** + resonance and drill. Strong magnetosphere (overload with an EMP pair), HP-2
  cores, tight heat budgets, solar storms and dust rings.

## Progression (light upgrades, `upgrades.ts`)
- Salvage is earned on first clear (+3) and per badge (+1 each, at most once per badge per level).
- The **Refit Bay** sells a few small boosts: +10 MW capacity (×2), +1 heat cap (×2), +1 cooling
  (×1), and a "Targeting Computer" that shows predicted PDC targets in the sequencer.
- Weapons unlock by reaching a sector, not by buying them. Levels are tuned at base stats.
- Badges per level: **Minimalist**, **Hyper-Velocity**, **Surgical**. They show on the star map.

## Screens and UX
- **Star map:** sector rows and level nodes with badge pips, a Daily button, the Refit Bay and a
  salvage counter.
- **Mission:** one screen with two modes that match GDD phases 1–2.
  - **Recon:** tap any structure or band on the cross-section to see its intel card (behavior,
    timers, priority rule, power links).
  - **Sequencer:** a timeline grid below the battlefield, ticks 1..N. To add an action, tap a
    weapon in the tray, then a tick cell, then a target. This works on touch and mouse; dragging a
    card moves it.
  - Each action card shows its fire tick → arrival arc. The panels show live energy and a per-tick
    heat graph (stutter-shifted cards flash amber). Defense timelines appear too: battery
    countdowns, EMP and chaff windows.
  - The sequencer does **not** preview the outcome. Execute is free and retries keep the plan.
  - Undo/redo follows Scrapyard's history pattern.
- **Execute:** tick-by-tick playback (about 1.2 s per tick). Projectiles descend through the bands,
  PDC tracers fire, shields flicker. Controls: pause, step, 2× speed and scrubbing using the
  per-tick snapshots. An event log sits alongside.
- **Debrief:** win or lose with the first causal failure ("Tick 2: PDC-A intercepted Kinetic Lance
  #1"), badges, salvage, and buttons for Retry / Next / Copy share code / Replay.
- Keyboard: 1–8 select a weapon, ←/→ pick the tick, Enter executes, Ctrl+Z/Y undo/redo, Space
  pauses playback.

## Replay and share codes (`share.ts`)
- The best solution per level is saved (fewest energy, then earliest win tick). It can be replayed
  from the star map.
- A share code is `OS1-<level>-<base64url(actions)>`, 2 bytes per action: weapon (3 bits), fire
  tick (4), target slot (5) and a flag. Pasting a code on the star map loads it into that level's
  sequencer. Daily codes carry the date seed.

## Daily puzzle (`daily.ts`)
- A seeded mulberry32 RNG (copied in the pattern of `scrapyard-ballistics/rng.ts`) from the date
  YYYYMMDD in local time.
- **Constructive generation, so it's guaranteed solvable:**
  1. Pick a template (for example "shielded core + PDC + battery").
  2. Place structures and pick weapons from the S1–S3 kit.
  3. Build a solution *backwards* from the core's kill: choose a killer weapon, then an arrival
     tick, then the counters needed for each layer it must pass (EMP for the shield, chaff for the
     PDC window, an early laser for the battery).
  4. Set E to the solution's cost plus 10–20% slack, and N to the win tick plus 1–2.
  5. Run `simulate` on the constructed solution and require a win.
  6. **Too-easy filter:** brute-force every plan of ≤2 actions (tens of thousands of fast sims) and
     reject the puzzle if any of them wins. Retry with the next sub-seed, up to 50 times, then fall
     back to a fixed backup level.
- The daily best is saved locally and there's a streak counter. It uses the base platform only, so
  it's fair.

## Persistence (`progress.ts`)
- One key, `orbital-siege:save`, using Scrapyard's defensive load/write (try/catch, field-by-field
  validation).
- It stores: per-level `{ cleared, badges, bestPlan }`, salvage, purchased upgrades, the in-progress
  plan per level, daily `{ date, bestPlan, streak }` and the mute setting.

## Architecture (`src/projects/orbital-siege/`)
- `OrbitalSiege.tsx` holds the screen state machine (star map → mission → execute → debrief, plus
  refit) and the save, following `scrapyard-ballistics/ScrapyardBallistics.tsx`.
- `OrbitalSiege.css` uses a scoped `.orbital-siege` class.
- Pure logic with no React: `weapons.ts`, `defenses.ts`, `types.ts`, `sim.ts`, `levels/*.ts`,
  `daily.ts`, `rng.ts`, `share.ts`, `progress.ts`, `upgrades.ts`, `badges.ts`.
- `render/battlefield.ts` draws the canvas cross-section. It takes a sim snapshot plus `t ∈ [0,1]`
  within the tick for interpolation.
- `useCanvas.ts` is copied from `scrapyard-ballistics/useCanvas.ts` (`useCanvasLoop`,
  `pointerPos`).
- `audio.ts` uses the Web Audio synth pattern from `scrapyard-ballistics/audio.ts` (lazy `init()`,
  master gain, mute). Cues: launch, beam, intercept, shield hit, EMP, structure down, battery
  charge-up, win and lose.
- Screens: `StarMap.tsx`, `Mission.tsx` (+ `Timeline.tsx`, `IntelCard.tsx`), `Execute.tsx`,
  `Debrief.tsx`, `Refit.tsx`.
- `selfcheck.ts` runs in DEV only (`import.meta.env.DEV`). On load it simulates every level's
  reference solution and `console.error`s any that don't win, and it generates and verifies the
  next 30 dailies. No test framework is added.
- Registration: an entry in `src/projects.ts` (slug `orbital-siege`, category `Puzzles`, icon 🪐,
  accent `#818cf8`) and a route in `src/App.tsx`. Use the lazy pattern if the bundle gets large.

## Build phases (each one playable and checkable)
1. **Sim core:** types, weapons, defenses and `sim.ts`, plus level 3-2 data and selfcheck. Proves
   the canonical sample wins on tick 4 and that deliberately broken variants fail for the right
   reasons.
2. **Mission screen:** the battlefield renderer, recon intel and the sequencer (energy, heat
   stutter preview, undo/redo).
3. **Execute and debrief:** playback with interpolation, the event log, failure causes, retries.
4. **Campaign:** all 24 levels with reference solutions, the star map, unlocks, save, badges,
   salvage and refit.
5. **Replay and share codes.**
6. **Daily generator:** constructive builder, too-easy filter, streak.
7. **Polish:** audio, the "show solution" option after 3 fails, mobile layout, a homepage entry,
   and moving the decisions into SPEC.md. Delete IMPLEMENTATION-PLAN.md and bump **minor**.

## Verification (for the build)
- `npm run build` (tsc + vite) and `npm run lint` pass.
- `npm run dev`: the DEV selfcheck logs that all 24 reference solutions win and 30 dailies verify,
  with no errors.
- Manual: play 3-2 with the GDD's exact sequence and confirm a win on tick 4. Remove the chaff and
  confirm "PDC intercepted lance on tick 2". Delay the laser to tick 6 and confirm the battery
  fires at the end of tick 5. Scrub the playback.
- Copy a share code, clear the save, paste the code, and confirm an identical replay.
- Check that the daily is identical across two reloads on the same date.
- Check the mobile width (360 px): the sequencer is usable by tap alone.

