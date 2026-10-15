# Orbital Siege

> Program an orbital platform's strike timeline to crack a rogue AI fortress, layer by layer.
> Every tick is deterministic, so every failure is a flaw in the plan.

Status: **planned — not yet built.** See [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) for the
coding plan. That plan also resolves the gaps and contradictions in this spec, and reframes the
theme for the family site: the targets are rogue robot fortresses, and the "collateral" is
protected sites such as ruins, seed vaults and preserves.

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