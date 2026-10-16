# Orbital Siege

> Program an orbital platform's strike timeline to crack a rogue AI fortress, layer by layer.
> Every tick is deterministic, so every failure is a flaw in the plan.

Status: **built.** Playable at `/orbital-siege`. Sections 1–7 are the original game design document.
Sections 8–14 record how the build resolved its gaps and contradictions, the rules as coded, and the
code map. For the family site the targets are rogue robot fortresses ("Sentinel" AI grids on
abandoned mining worlds, no people anywhere), and the "collateral" is protected sites such as ruins,
seed vaults and preserves. Explosions are stylized sparks and flashes.

---

# Game Design Document: Orbital Siege (Working Title)

**Genre:** Asynchronous Tactical Sci-Fi Puzzle  
**Target Loop:** Reconnaissance $\rightarrow$ Sequence Programming $\rightarrow$ Deterministic Execution $\rightarrow$ Post-Strike Evaluation  
**Reference Touchstones:** *Into the Breach*, *Frozen Synapse*, *SpaceChem*, *HighFleet*

---

## 1. High Concept & Core Pillars

* **Tactical Determinism:** No random rolls ($0\%$ RNG during execution). Every failure is a flaw in sequence planning; every success is a solved puzzle.
* **Layered Vulnerability:** Planetary targets are protected by multi-tier, interdependent defensive networks. Players must crack the outer layers to expose the core.
* **Time-Tick Sequencing:** Attacks are not instantaneous. Travel time, firing cycles, and charge-up windows determine order-of-arrival at the target.
* **Information Mastery:** The Intel phase provides complete (or decipherable) data on defense behavior rules, environmental hazards, and power lines.

---

## 2. Core Gameplay Loop

```
┌─────────────────┐       ┌──────────────────────┐       ┌─────────────────────┐       ┌────────────────────┐
│   Phase 1:      │  ──>  │      Phase 2:        │  ──>  │      Phase 3:       │  ──>  │     Phase 4:       │
│ Planetary Recon │       │ Sequence Programming │       │ Execution & Resolve │       │ Evaluation & Score │
└─────────────────┘       └──────────────────────┘       └─────────────────────┘       └────────────────────┘
```

1. **Recon Phase:** The player inspects the planet, active defensive layers, automated threat protocols, atmosphere composition, and power conduits.
2. **Sequencer Phase:** The player allocates platform energy and drags weapon actions onto a segmented timeline (Ticks $1$ to $N$).
3. **Execution Phase:** The player commits the queue via `EXECUTE`. The simulation plays out deterministically as orbital projectiles descend and automated defenses react.
4. **Debrief Phase:** Victory condition check (Target eliminated vs. Platform integrity intact vs. Collateral constraints respected).

---

## 3. Platform Resources & Sequencer Rules

### 3.1 Platform Constraints
* **Energy Capacity ($E$):** A hard cap per engagement (e.g., $100$ MW). Each weapon assignment consumes a specific amount of power.
* **Heat Threshold ($H$):** Firing multiple heavy systems simultaneously increases thermal buildup. Overheating causes temporal delay (stuttering ticks) or weapon misfires.
* **Timeline Slots ($T$):** Matches are divided into distinct execution intervals (Ticks $1$ through $8$).

### 3.2 Time & Travel Mechanics
Every weapon profile has three critical time variables:
* **Charge Delay ($t_{charge}$):** Number of ticks before the weapon discharges after being triggered.
* **Flight Transit ($t_{transit}$):** Time taken to traverse low orbital space down to the planetary surface.
  * *Beam weapons:* $t_{transit} = 0$ (instant impact upon discharge).
  * *Hypersonic Missiles:* $t_{transit} = 2$.
  * *Heavy Kinetic Rods:* $t_{transit} = 3$.
* **Arrival Tick ($T_{hit}$):** 
  $$T_{hit} = T_{fire} + t_{charge} + t_{transit}$$
  Success relies on synchronizing $T_{hit}$ across systems so countermeasures and breach weapons hit in exact serial order.

---

## 4. Planetary Defense Layers

Defenses operate in concentric strata from space to surface:

| Stratum | Layer Name | Behavior / Mechanism | Neutralization Strategy |
| :--- | :--- | :--- | :--- |
| **Exosphere** | **Ion Field / Magnetosphere** | Scrambles electronics; deflects low-intensity thermal beams; redirects missile telemetry. | Overload with concentrated EMP pulse or physical kinetic slugs. |
| **Upper Orbit** | **Point Defense Cannons (PDC)** | Intercepts incoming physical ordnance (torpedoes, kinetic rods) with automated flak salvos. | Saturate with chaff decoys, blind with flare salvos, or bypass with speed-of-light lasers. |
| **Stratosphere**| **Planetary Kinetic Shield** | Energy barrier enclosing continents. Deflects or disintegrates high-speed physical objects. | Pierce with sub-harmonic resonance beams or sever power relays on the ground. |
| **Surface** | **Sub-surface Bunker Armor** | Reinforced planetary command bunkers impervious to standard orbital bombardment. | Require direct kinetic penetrators ("Rods from God") or deep thermal drilling lasers. |
| **Retaliation** | **Anti-Orbital Surface Batteries** | Massive mass-drivers or ground lasers with fixed firing timers (e.g., fires at Tick 5). | Must be disabled, distracted, or destroyed before countdown hits zero. |

---

## 5. Arsenal & System Interactions

### 5.1 Weapon Catalog

1. **Coherent UV Laser (Beam):**
   * *Profile:* Instant transit ($t_{transit} = 0$), medium energy cost.
   * *Specialty:* Effective against thermal-absorbing shields; rapidly melts lightly armored surface relays. Ineffective against hardened deep bunkers.
2. **Tungsten Kinetic Lance (Projectile):**
   * *Profile:* Slow transit ($t_{transit} = 3$), heavy energy cost, high impact.
   * *Specialty:* Ignores magnetic distortion and energy shields; punctures hardened bunkers. Vulnerable to PDC flak during transit.
3. **Sensor-Blind Jammer / Chaff Canister (Utility):**
   * *Profile:* Medium transit ($t_{transit} = 1$), low energy cost.
   * *Specialty:* Deploys an orbital interference field. Automated PDCs target the chaff cloud for $2$ ticks, opening a corridor for missiles.
4. **EMP Orbital Burst (Support):**
   * *Profile:* Fast transit ($t_{transit} = 1$), medium energy cost.
   * *Specialty:* Shuts down local energy relays, turning off shields or PDCs for $2$ ticks. Does zero structural damage.
5. **Thermobaric Cluster Munition (Area Denial):**
   * *Profile:* Slow transit ($t_{transit} = 2$), high collateral hazard.
   * *Specialty:* Ignites volatile atmospheres and destroys multiple exposed surface structures simultaneously.

### 5.2 Interaction & Synergy Matrix

| Weapon $\downarrow$ / Defense $\rightarrow$ | Magnetosphere | Orbital PDCs | Kinetic Shield | Ground Bunker |
| :--- | :--- | :--- | :--- | :--- |
| **UV Laser** | Refracted (No effect) | Bypasses (Destroys PDC) | Melts (Gradual drain) | Glances off (No effect) |
| **Kinetic Lance** | Pierces untouched | **Intercepted & Destroyed** | Shatters shield (if uncharged) | **Direct Kill** |
| **Chaff Canister** | Pierces untouched | **Blinds PDCs ($2$ Ticks)** | Absorbed | Minimal damage |
| **EMP Burst** | Neutralized | **Disables for $2$ Ticks** | **Collapses for $2$ Ticks**| No effect |

---

## 6. Sample Level Scenario

### Level 3-2: The Caldera Fortress
* **Objective:** Destroy the Planetary Command Vault without allowing the Anti-Orbital Mass Driver to fire on Tick 5.
* **Intel Given:**
  * Active Magnetosphere (Scrambles guided missiles).
  * 1x Automated PDC Battery (Priority logic: Targets the highest-mass projectile in transit).
  * 1x Geothermal Shield Generator powering the Command Vault.
  * 1x Surface Anti-Orbital Railgun (Fires at Tick 5: Destroys platform).

### Solution Sequence:
1. **Tick 1:** Fire **Chaff Decoy** ($t_{transit}=1$, lands Tick 2) + Fire **Kinetic Penetrator** aimed at Command Vault ($t_{transit}=3$, lands Tick 4).
2. **Tick 2:** Chaff detonates; PDC tracks and fires at the chaff decoy, exhausting its ammunition cycle.
3. **Tick 3:** Fire **Coherent UV Laser** at the Surface Anti-Orbital Railgun ($t_{transit}=0$, hits Tick 3). Railgun is destroyed before its Tick 5 deadline.
4. **Tick 3 (simultaneous):** Fire **EMP Burst** at Geothermal Shield Relay ($t_{transit}=1$, lands Tick 4).
5. **Tick 4:** EMP impacts and drops the shield precisely as the Kinetic Penetrator reaches the surface, striking the unprotected Command Vault for a total win.

---

## 7. Progression & Replayability Hooks

* **Sub-System Salvage:** Defeating planets grants modular platform upgrades (e.g., secondary cooling loops, overclocked capacitive banks).
* **Par Times & Efficiency Badges:**
  * *Minimalist:* Clear using $< 60\%$ total platform energy capacity.
  * *Hyper-Velocity:* Clear in $3$ ticks or fewer.
  * *Surgical:* $0\%$ collateral damage to planetary research facilities or civilian habitation sectors.
* **Dynamic Modifiers:** Planetary weather systems (e.g., solar storms that accelerate EMP effects, dust rings that intercept kinetic weapons).

---

# As built

## 8. Rules and resolved gaps

Everything is deterministic: there is no randomness anywhere in a mission.

| Topic | GDD says | Built as |
|---|---|---|
| Heat "misfires" | Overheat causes stutter or misfire | No misfires (that would be RNG). A launch that would push heat over the cap **stutters one tick**, and can keep stuttering. Heat lands when a weapon discharges (after charge). The timeline previews heat and stutter live. |
| Magnetosphere | Refracts lasers and neutralizes EMP, yet sample 3-2 uses lasers and EMP | Two tiers. **Ion Field (weak)** only scrambles guided missiles; an EMP aimed at it drops it for 2 ticks. **Magnetosphere (strong)** also refracts UV and drill lasers and swallows any single EMP; two or more EMPs landing on the same tick are all spent overloading it, which drops it for the EMP duration. Sample 3-2 uses the weak tier. |
| Scrambled missile | "Redirects telemetry" | The missile lands one column along the field's drift (shown in intel). Off the map, it is lost. PDCs judge by the column it was **aimed** at. |
| PDC vs. chaff timing | Chaff blinds the PDC in the sample | A projectile is **in flight** on the ticks strictly between launch and arrival. PDCs only shoot in-flight physical projectiles aimed into their zone: transit-1 weapons can't be hit, missiles and thermobarics are exposed 1 tick, lances 2. Chaff blinds every PDC whose zone covers its column on its arrival tick and the next. |
| PDC ammo | "Exhausting ammunition" | Dropped. A PDC fires `barrels` shots per tick (default 1) by its priority: heaviest (lance 3, thermobaric 2, missile 1), nearest to impact, or first launched. Ties go to fire order. Armored PDCs ignore lasers. |
| Kinetic shield | "Shatters shield (if uncharged)" | Strength 1–3. A laser or drill drains 1 and is absorbed. A lance against strength ≤1 shatters it (and is spent); against more it is destroyed. Missiles and thermobarics are blocked. Resonance passes through. An EMP collapses it for 2 ticks; an unpowered dome is down. No regeneration. |
| Same-tick order | "EMP drops the shield as the lance arrives" | Fixed pipeline, below. |
| Retaliation deadline | "Fires at Tick 5" | Batteries fire in the Defenses step, at the **end** of their tick. If one is EMP-disabled or unpowered then, it fires the first tick it is back. A battery whose power source is destroyed never fires. |
| Winning | — | The mission is won the moment every objective is down (the grid goes dark, so batteries due that tick don't fire). It fails on a battery shot, a hit on a protected site marked hard (an abort), or reaching the last tick with objectives standing. |
| Charge delay | Every weapon has one | Base weapons have charge 0; only the sector-4 resonance (2) and drill (1) charge. |
| Thermobaric | Missing from matrix | Splashes its column and both neighbours (the whole surface in volatile air), wrecking exposed **light** structures. Shielded columns are spared; if its own column is shielded it is blocked outright. It is physical. |
| Badges | Minimalist <60% energy, Hyper-Velocity ≤3 ticks | Per level: **Minimalist** = at most `minimalist` MW (calibrated by brute-force search), **Hyper-Velocity** = win by `parTick`, **Surgical** = no protected site hit (only on levels that have one). Judged at base stats. |

### Tick pipeline (`sim.ts`)

For T = 1..N:

1. **Launch** — actions whose fire + charge (+ stutter) is T. Beams arrive the same tick.
2. **Effects** — EMPs land (disable a structure, PDC, shield or field for 2 ticks, 3 in a solar
   storm; a disabled power source cuts everything it powers) and chaff lands.
3. **Interception** — dust rings shred everything in flight on their ticks, then each live,
   powered, un-blinded PDC shoots by its priority.
4. **Strikes** — beams first, then projectiles, each in fire order (launch tick, then plan
   order). Each passes field → shield → armor. Destroyed sources de-power their links at once.
   Win/abort is checked here.
5. **Defenses** — batteries whose countdown is up fire. A shot loses the mission.
6. **Upkeep** — heat cools by `cool`.

`simulate(level, plan, platform)` returns the outcome, the reason and the first causal failure
(for the debrief), an event log, per-shot fates, a snapshot per tick (for playback and scrubbing),
energy used, win tick and collateral.

## 9. Arsenal, defenses and modifiers

| Weapon | Sector | Charge | Transit | MW | Heat | Physical | Kills |
|---|---|---|---|---|---|---|---|
| UV Laser | 1 | 0 | 0 | 20 | 4 | no | light, unarmored PDCs |
| Kinetic Lance | 1 | 0 | 3 | 35 | 6 | yes | everything |
| Chaff Canister | 1 | 0 | 1 | 10 | 1 | no | — (blinds PDCs) |
| EMP Burst | 2 | 0 | 1 | 20 | 3 | no | — (disables) |
| Hypersonic Missile | 2 | 0 | 2 | 20 | 3 | yes, guided | light, medium |
| Thermobaric Cluster | 3 | 0 | 2 | 30 | 5 | yes | light (splash) |
| Resonance Beam | 4 | 2 | 0 | 40 | 7 | no | light, through shields and fields |
| Drill Laser | 4 | 1 | 0 | 35 | 6 | no | everything |

Base platform: **100 MW** per engagement, **heat cap 10**, **cooling 3/tick**. Levels override these
(e.g. 2-2 has 60 MW, 4-4 a heat cap of 7, the finale 130 MW and heat cap 12).

Targets are surface columns, PDCs (laser, chaff, EMP), shields (EMP) or the field (EMP). Surface
structures: Core and Hangar (objectives), Relay and Generator (power sources), Battery (countdown),
Protected Site (soft or hard). Armor is light, medium or hardened; two sector-4 cores take 2 hits.
Modifiers: solar storm (EMPs last 3 ticks), dust ring (physical projectiles in flight on listed
ticks are destroyed), volatile atmosphere. Levels may also take weapons offline (1-3 has no chaff
yet; 3-5 freezes chaff and EMP to force a decoy).

## 10. Campaign, badges and progression

24 levels in 4 sectors of 6 (`levels/sector1..4.ts`), each with a reference solution:

- **S1 Kepler's Rock** (laser, lance, chaff): First Light, Hard Shell, Flak Umbrella, Chaff
  Corridor, Countdown, Kepler Keep (a heat-budget finale).
- **S2 Ferrous Belt** (+ EMP, missile): Dome Light, Pulse Window, Drift, Relay Web, Twin Spires,
  Ferrous Heart.
- **S3 Caldera Worlds** (+ thermobaric): Drone Nest, **Caldera Fortress** (the GDD's sample; its
  documented solution wins on tick 4, and dropping the railgun laser is the 65 MW Minimalist line),
  Volatile Air, Crossfire, Decoy Run, Caldera Crown.
- **S4 Core Grid** (+ resonance, drill): Resonance, Overload, Twin Hearts, Thermal Limit, Solar
  Storm, Sentinel Prime.

Levels unlock one at a time. Every level was checked by brute force over all plans of up to three
actions. Early levels teach one idea each and can take two actions; from 2-4 on (apart from 3-1, the
thermobaric intro) none can be won in two. Each `minimalist` and `parTick` matches the cheapest
solution that search found, or the reference solution where nothing shorter wins.

Salvage: +3 on first clear, +1 per new badge. The **Refit Bay** sells Capacitor Bank (+10 MW, ×2,
5), Heat Sink (+1 heat cap, ×2, 5), Cooling Loop (+1 cooling, ×1, 8) and the Targeting Computer (6),
which marks the shots a PDC will bring down on the timeline. After 3 failed runs a level offers
"Show solution".

## 11. Daily puzzle (`daily.ts`)

Seeded (mulberry32) from the local date `YYYYMMDD`, so everyone gets the same fortress. Built
constructively: pick a killer (lance on a hardened core, missile on a medium core, or a thermobaric
on three hangars) and its impact tick; add an ion field (missiles must be aimed off-target, often
with a protected site where an uncorrected missile would land); add at least two of shield
(countered by an EMP on its generator), PDC (chaff or a laser) and battery (a laser); add scenery.
Energy is the solution's cost plus 10–20%, the timeline is 1–2 ticks longer than the impact. The
solution must win cleanly on the planned tick, and a brute force over every plan of ≤2 actions must
find no win; otherwise the next sub-seed is tried (up to 50, then a fixed backup). Dailies use the
base platform; the save keeps today's best plan and a streak.

## 12. Share codes and replays (`share.ts`)

`OS1-<level>-<base64url(actions)>`, 2 bytes per action: weapon (3 bits), fire tick (4), target index
into `targetsOf(level)` (5), 4 reserved bits. Daily codes use `D<date>` as the level, so any past
daily can be loaded. Loading a code on the star map puts the plan into that level's sequencer (it
runs on your current platform). The best plan per level (fewest MW, then earliest win) is saved
with the platform it ran on and can be watched from the star map.

## 13. Screens and save

Star map → Mission (Recon / Sequence) → Execute (playback, then the debrief over it), with the Refit
Bay off the star map. Sequencing: arm a weapon (tray or 1–8), pick a tick (timeline header or ←/→),
tap a target on the cross-section or in the target chips. Cards can be dragged or tapped for ◀ ▶ ✕.
Ctrl+Z/Y undo/redo, Enter executes, Esc disarms. Playback: ~1.2 s per tick, pause (Space), step
(→), 2×, scrub, skip.

One localStorage key, `orbital-siege:save`, validated field by field on load: per-level
`{ cleared, badges, best, bestPlatform, bestEnergy, bestTick, fails }`, salvage, upgrades, the
in-progress plan per level, the daily `{ date, best, streak, lastWin }`, and mute.

## 14. Code map and verification

- `OrbitalSiege.tsx` — screen machine, save, undo/redo. Screens: `StarMap`, `Mission` (+
  `Timeline`, `IntelCard`), `Execute`, `Debrief`, `Refit`.
- Pure logic: `types`, `weapons`, `defenses` (targets, intel text), `sim`, `solver` (brute force),
  `levels/`, `daily`, `rng`, `share`, `progress`, `upgrades`, `badges`.
- `render/battlefield.ts` — the canvas cross-section for planning and playback; `useCanvas.ts` and
  `audio.ts` follow scrapyard-ballistics.
- `selfcheck.ts` — DEV only: simulates every reference solution and generates the next 30 dailies,
  logging problems with `console.error`.

