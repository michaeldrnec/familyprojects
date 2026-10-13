# Invader Protocol

> Break the marching alien lattice on the beat — four hot-running weapons, ventable hardlight
> bunkers, and a tempo that climbs as they fall.

Status: **planned — not yet built.** See [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) for the
coding plan. That plan also resolves the gaps and ambiguities in this spec.

---

# Technical Game Design Specification: Invader Protocol

**Document Version:** 1.0  
**Genre:** Fixed-Screen Tactical Arcade Shoot 'Em Up (Shmup)  
**Perspective:** 2D Top-Down / Fixed Perimeter  
**Core Pillars:** Synchronized Formations, Accelerating Tension, Kinetic Grid Physics, Dynamic Cover Conversion.

---

## 1. System Architecture & Entities

### 1.1 Playfield Geometry
* **Coordinate Space:** Normalized internal resolution 1920x1080 (16:9 fixed aspect ratio).
* **Baseline Player Track:** Confined to the horizontal axis at Y = 980.
* **Alien Grid Bounds:** Spawn domain spans X in [200, 1720], Y in [100, 500].
* **Invasion Fail Threshold:** If any living invader reaches Y >= 940, trigger an instant game over.

### 1.2 Player Entity (`PlayerCannon`)
* **State Variables:**
  * `position_x`: Float
  * `velocity_x`: Float
  * `current_weapon`: Enum (`DISRUPTOR`, `NEEDLE`, `SPREAD`, `SIEGE`)
  * `heat_level`: Float [0.0, 100.0]
  * `overheated`: Boolean
  * `dash_cooldown_timer`: Float
  * `is_dashing`: Boolean
* **Locomotion:**
  * Standard horizontal speed: 600 px/s.
  * Acceleration: 3600 px/s²; Deceleration/Friction: 4800 px/s².
  * **Micro-Dash Ability:** Tap `[Shift]` or `[Space]` with direction input. Lunges 180 px horizontally over 0.15 s with invulnerability frames (i-frames). Cooldown: 1.2 s.

---

## 2. Core Mechanics & Mathematical Rules

### 2.1 The Invader Grid: Lattice Coupling & Speed Scaling
The standard formation consists of 5 rows of 11 columns ($N_0 = 55$ entities total).

* **Descent & March Cadence:**
  * The marching speed scales dynamically with the remaining alien count ($N$).
  * Grid step frequency $F_{\text{step}}(N)$ (steps per second):
    $$F_{\text{step}}(N) = F_{\text{min}} + (F_{\text{max}} - F_{\text{min}}) \cdot \left(1 - \frac{N}{N_0}\right)^p$$
    *Parameters:* $F_{\text{min}} = 1.0\text{ Hz}$ (60 BPM), $F_{\text{max}} = 3.5\text{ Hz}$ (210 BPM), $p = 1.8$.
  * Movement cycle: Moves horizontally by step increment $\Delta X$ on every beat. Upon hitting screen bounds ($X \le 120$ or $X \ge 1800$), the grid drops by $\Delta Y = 32\text{ px}$ on the subsequent step and reverses horizontal direction.
* **Kinetic Resonance (Column Snap):**
  * When an entire vertical column of 5 invaders is completely eliminated, the grid lattice breaks.
  * Columns to the left and right immediately collapse inward toward the cleared gap by $\Delta X_{\text{snap}} = 40\text{ px}$.
  * The shockwave stuns the entire grid for 0.6 s (freezing descent and shooting).
* **Decapitation (Commander Collapse):**
  * When an entity in **Row 1 (Top / Command Row)** is eliminated, all surviving entities directly beneath it in that column enter an unsynchronized `FRENZY` state for 4.0 s.
  * During `FRENZY`, their march cadence becomes erratic (+/- 30% jitter) and their weapon accuracy drops, but their rate of fire increases by 50%.

### 2.2 Ballistics, Weapons & Heat Economy
Shooting generates heat. At Heat >= 100.0, the weapon locks into an `OVERHEATED` penalty state for 2.5 s (cooling down to 0 before allowing fire). Natural cooling rate: 25 units/s after 0.3 s idle.

Players cycle through 4 distinct weapon profiles using `[Q]` / `[E]` or `[1]`–`[4]`:

| Weapon | Projectile Profile | Heat Cost / Shot | Cooldown (Fire Rate) | Strengths / Weaknesses |
| :--- | :--- | :--- | :--- | :--- |
| **1. Standard Disruptor** | Single high-velocity kinetic bolt. $V_y = -1400\text{ px/s}$. | 6 heat | 0.18 s (5.5 shots/s) | **Balanced.** Reliable base DPS; zero specialized drawbacks. |
| **2. Needle Rail** | Linear ray piercing up to 3 entities. $V_y = -2400\text{ px/s}$. | 24 heat | 0.55 s (1.8 shots/s) | **Armor-Piercing / Decapitation.** Bypasses lower grunts to snipe Commanders; rapid heat generation. |
| **3. Arc Spread** | 3-way fan pattern (-15°, 0°, +15°). $V_y = -1100\text{ px/s}$. | 18 heat | 0.30 s (3.3 shots/s) | **Crowd Control.** Sweeps wide gaps; chips cover shields; inefficient at single-target puncture. |
| **4. Siege Mortar** | Heavy arcing slug with area splash on hit ($R = 75\text{ px}$). $V_y = -900\text{ px/s}$. | 35 heat | 0.80 s (1.2 shots/s) | **Splash Demolition.** Cracks armored units; high heat overhead makes missing catastrophic. |

* **Rhythm Fire Synergies:**
  * Firing within a +/- 50 ms window of the procedural bass pulse grants a **Perfect Beat** flag: +25% projectile speed, zero heat accumulation, and +20% score value.

### 2.3 Ablative Hardlight Shields (Absorption & Venting)
* **Structure:** 3 defensive bunkers positioned at Y = 820.
* **Cellular Grid:** Each shield is composed of a 6x4 cluster of discrete hexagonal hardlight cells (24 cells per bunker, 75 HP per cell).
* **Absorption Mechanics:**
  * Enemy projectiles chip away cell HP.
  * When an enemy projectile hits a cell, that cell charges with kinetic energy, changing color from cool blue to incandescent amber.
  * The bunker stores a global charge meter: $E_{\text{absorbed}} = \sum (\text{Damage Absorbed}) \times 0.5$, capped at 100 units.
* **Active Venting (Secondary Action: Right Click / Key `[F]`):**
  * When the player is positioned within the X-span of a bunker:
  * Triggers **Bunker Overload**: Converts all current $E_{\text{absorbed}}$ into an upward-firing beam covering the width of that bunker for 1.5 s.
  * **Cost:** Completely vaporizes that specific bunker's remaining cells. Shields are non-regenerating consumable defensive batteries.

---

## 3. Enemy Entities & Behaviors

```
[Row 1]  [C] [C] [C] [C] [C] [C] [C] [C] [C] [C] [C]  <- Command Cores (Tempo Anchors)
[Row 2]  [B] [B] [B] [B] [B] [B] [B] [B] [B] [B] [B]  <- Barrier Drones (Shield Projectors)
[Row 3]  [G] [G] [G] [G] [G] [G] [G] [G] [G] [G] [G]  <- Heavy Grunts (Armor & Explosive Shards)
[Row 4]  [R] [R] [R] [R] [R] [R] [R] [R] [R] [R] [R]  <- Standard Raiders (Direct Fire)
[Row 5]  [R] [R] [R] [R] [R] [R] [R] [R] [R] [R] [R]  <- Standard Raiders (Direct Fire)
```

### Entity Specifications

1. **Command Core (Row 1):**
   * *HP:* 60.
   * *Behavior:* Synchronizes column march. If destroyed, triggers `FRENZY` down the column and grants +500 pts.
2. **Barrier Drone (Row 2):**
   * *HP:* 120 (Armored carapace).
   * *Behavior:* Projects a directional energy barrier over the entity in Row 3 beneath it. Requires angle shots from Spread, armor pierce from Needle Rail, or direct Siege Mortar splash.
3. **Heavy Grunt (Row 3):**
   * *HP:* 80.
   * *Behavior:* When eliminated, its power supply ruptures, dropping three erratic explosive cluster fragments straight down that damage shields or the player.
4. **Standard Raider (Rows 4 & 5):**
   * *HP:* 40.
   * *Behavior:* Standard plasma bolts fired straight down at periodic intervals (1.5–4.0 s cadence per column).
5. **The Apex Transponder (Mystery UFO):**
   * *HP:* 150.
   * *Spawns:* Traverses top screen (Y = 60) from left-to-right or right-to-left every 25–40 s.
   * *Threat:* Drops orbital laser markers behind player shields, turning safe zones into hazard lanes.
   * *Reward:* 1,000 to 5,000 points based on distance; instantly restores 25% integrity to the most damaged bunker.

---

## 4. Audio Engine Architecture

Sound is not decorative; it is the game's core clock and emotional throttle.

* **Procedural Bassline (The 4-Note Descending Engine):**
  * Musical intervals: $B_2 \to A^\sharp_2 \to A_2 \to G^\sharp_2$.
  * Pitch and tempo locked directly to remaining invader count $N$:
    * $N \in [45, 55]$: 60–75 BPM. Sub-bass pulse, low-pass filter at 300 Hz.
    * $N \in [20, 44]$: 75–125 BPM. 808-style kick and industrial percussion layers fade in.
    * $N \in [6, 19]$: 125–170 BPM. Snare roll, arpeggiated synth ostinato engaged.
    * $N \in [1, 5]$: 180–220 BPM. Distorted aggressive analog lead; pitch climbs up one octave.
* **Audio-Visual Feedback Cues:**
  * **Column Snap:** Low-end industrial metallic strike with a sharp high-pass transient.
  * **Venting Beam:** White noise swell cross-fading into a sustained resonant hum.
  * **Rhythm Hit:** Harmonically tuned audio chime confirms execution of an on-beat shot.

---

## 5. Input Configuration Spec

| Action | Primary Input (Keyboard/Mouse) | Secondary Input (Gamepad) |
| :--- | :--- | :--- |
| **Move Left / Right** | `[A]` / `[D]` or `[Left]` / `[Right]` | Left Stick / D-Pad |
| **Primary Fire** | `[Left Click]` or `[Space]` | `[Right Trigger]` |
| **Tactical Micro-Dash** | `[Left Shift]` | `[Left Trigger]` or `[Face Button Down]` |
| **Shield Vent (Secondary Fire)**| `[Right Click]` or `[F]` | `[Right Bumper]` |
| **Cycle Weapon (Prev/Next)** | `[Q]` / `[E]` or `[Mouse Wheel]` | `[Left Bumper]` / `[Right Bumper]` |
| **Direct Weapon Select** | Keys `[1]`, `[2]`, `[3]`, `[4]` | D-Pad Direct Mapping |

---

## 6. Resolved gaps & interpretations

The spec above leaves some values unspecified and has a few conflicts (Space bound to both fire
and dash, Right Bumper to both vent and weapon cycling, and so on). The decisions that resolve
them are in the **"Resolved gaps & interpretations"** table in
[IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md). When the game is built, move that table here.
