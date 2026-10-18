# Invader Protocol

> Break the marching alien lattice on the beat — four hot-running weapons, ventable hardlight
> bunkers, and a tempo that climbs as they fall.

Status: **built.** Playable at `/invader-protocol`. Section 6 records how the build resolved the
spec's gaps and conflicts (and later changes: bunkers block the player's shots, and every fifth
wave is a boss fight against The Conductor), and section 7 maps the code.

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
and dash, Right Bumper to both vent and weapon cycling, and so on). These are the decisions the
build uses. All of the numbers live in `constants.ts`, so they're easy to retune.

| Topic | Spec says | Decision |
|---|---|---|
| Space key | Fire (§5) and dash (§1.2) | **Space = fire.** Dash = Left Shift + direction; with no direction held, dash toward the last move direction. |
| Gamepad RB / D-pad | RB = vent *and* next weapon; D-pad = move *and* weapon select | Left stick = move. D-pad = direct weapon select (↑1 →2 ↓3 ←4). LB/RB = cycle weapon. **B/Circle = vent.** RT = fire. LT or A = dash. |
| Grid step ΔX | unspecified | 16 px per beat. Bounds are checked against the outermost *living* column (120 / 1800). |
| Tempo vs. audio BPM tiers | F_step formula 60–210 BPM; audio tiers up to 220 | **The F_step formula is the single master clock**, and each grid step is one bass note. The audio tiers only pick which instrument layers play. The formula already matches the tiers (N=45→67, N=20→126, N=6→182, N=1→205 BPM). |
| Column snap direction | neighbors collapse inward 40 px | Every column on each side of the gap shifts 40 px toward it, so each side stays rigid. Shift is tweened over 0.12 s via per-column `xOffset`. Grid stuns for 0.6 s; the music keeps playing. |
| Who fires | Raiders fire straight down, 1.5–4.0 s per column | Each column has a fire timer (1.5–4.0 s). The lowest living entity fires, whatever its type, so columns still threaten after their raiders die. Frenzy: timer ×(1/1.5), ±12° aim spread, ±30% jitter on step size. |
| Weapon damage | unspecified | Disruptor 20. Needle 45 per entity (pierces 3, ignores armor and barriers). Spread 14 per pellet. Siege 70 direct + 45 splash (R=75, linear falloff to 50%). |
| Barrier Drone armor / barrier | "requires angle shots, Needle pierce, or Siege splash" | Drone carapace: Disruptor and the straight Spread pellet deal ×0.5. The Grunt beneath a living Drone has a barrier that absorbs *vertical, non-piercing, non-splash* shots (`abs(vx) < 1`). Angled Spread pellets, Needle, and Siege splash get through. |
| Siege "arcing" | Vy −900, arcing | Travels straight; the arc is visual only (scale-up/down plus a shadow). Detonates on the first entity hit or at Y=100. |
| Perfect Beat | ±50 ms of the bass pulse | Compared against beat timestamps in game time, not AudioContext time. On success: +25% speed, 0 heat, ×1.2 score on kills by that projectile, plus a chime and a flash. |
| Overheat | locks 2.5 s, cooling to 0 | Heat falls linearly from 100 to 0 over 2.5 s with fire locked. Normal cooling: 25/s after 0.3 s without firing. |
| Player shots vs. own bunkers | unspecified | **Bunkers block player shots**, as in the arcade original (the first build let them pass, which made bunkers free cover). A shot stops at the first living cell and chips it for 25 (a Siege slug clears the whole cell). It banks **no charge**, so bunkers can't be farmed for vent energy. Vent beams are unaffected. "Chips cover shields" refers to Drone barriers. |
| Enemy damage | unspecified | Plasma bolt 25 to a cell (3 hits per cell). Grunt fragment 30. Invaders touching a bunker erase the cells they overlap. Any hit on the player costs a life. |
| Vent | converts E into a beam for 1.5 s; vaporizes the bunker | Requires E ≥ 10 and the player within the bunker's X-span. Beam DPS = 30 + 1.6·E to invaders in its X-span. It also erases enemy projectiles in the span. |
| UFO points "by distance" | 1,000–5,000 | 1000 + 4000·clamp(abs(ufoX − playerX) / 960, 0, 1), so longer shots score more. Rounded to 100s. |
| UFO bunker restore | +25% integrity to the most damaged bunker | Integrity = summed cell HP (max 1800). Restores 450 HP, rebuilding cells nearest the center first. Vented bunkers are gone for good and are not eligible. |
| Laser markers | dropped "behind shields" | Up to 2 per pass, placed at a random X inside a bunker's span at the player line. 1.2 s telegraph, then a 0.5 s orbital beam that hits the player only, ignoring bunkers. |
| Lives / waves / scoring | unspecified | 3 lives, 1.5 s respawn i-frames. Points: Raider 10, Grunt 20, Drone 30, Command 500. After a wave clears, the next spawns 32 px lower (capped at +160) and enemy fire cadence speeds up ×0.92. **All three bunkers rebuild at the start of each wave**, otherwise venting is only usable in wave 1. A bonus life every 10,000 pts. Endless, scored. |
| Touch | unspecified | Phone-friendly on-screen buttons, following Starwarden: ◀ ▶ / Fire (hold) / Dash / Vent / weapon chip row. |
| Formation layout | spawn domain X 200–1720, Y 100–500 | Columns 120 px apart (X 360–1560) and rows 80 px apart (Y 140–460), inside the spawn domain. That leaves room to march about 13 steps before the first drop. |
| Enemy projectile speed | unspecified | Plasma bolts fall at 520 px/s. |
| Boss waves | not in the spec (added later) | **Every 5th wave is The Conductor** instead of a formation: a mothership that sways across the top (Y=230) and attacks on the beat. **Shielded:** two side pods (300 HP, +100 per later boss) take turns firing aimed bolts every 2 beats, and a 3-bolt fan comes every 8 beats. Hits anywhere else deflect. **Exposed** (both pods down): the core takes full damage, and the hull plating takes 25% (the Needle ignores it). Core HP is 1200, +500 per later boss. It fires an aimed bolt every 3 beats and a 5-bolt fan every 4 (7 bolts from the second boss on). **Overdrive** (core below 40%): it sways faster, the fans get 2 more bolts, and it calls an orbital marker onto the cannon every 8 beats. The tempo reads the boss's total remaining HP as an invader count (minimum 10, about 165 BPM). Points: 1,000 per pod and 5,000 × boss number for the kill. No UFO during a boss wave. Siege splash and vent beams hurt it too. |

---

## 7. Code map (`src/projects/invader-protocol/`)

| File | Responsibility |
|---|---|
| `constants.ts` | Every tuning number. |
| `beat.ts` | `stepFrequency(N)`, the beat clock, and the perfect-beat window. It is the master clock for the grid, the music, and rhythm fire. |
| `grid.ts` | Formation, march/drop/reverse on the beat, column snap and stun, frenzy, per-column enemy fire, barrier lookup. |
| `player.ts` | Locomotion, micro-dash, lives and respawn. |
| `weapons.ts` | Weapon firing, heat/overheat, switching. |
| `projectiles.ts` | Swept collisions and damage rules: pierce, Drone armor, Grunt barriers, Siege splash, UFO hits, enemy shots vs. bunkers/beams/player, and scoring with bonus lives. |
| `fragments.ts` | Enemy projectiles: plasma bolts and Grunt cluster fragments. |
| `bunkers.ts` | Hex cells, absorption/charge, venting, UFO restore. |
| `ufo.ts` | Apex Transponder passes, laser markers, reward. |
| `boss.ts` | The Conductor: boss waves, phases, sway, the tempo it implies, and its beat-locked attack pattern. Collisions and damage live in `projectiles.ts`. |
| `game.ts` | `GameState`, wave setup, and the fixed-step `stepGame()` in plan order (input → player → beat → grid → enemy fire → weapons → projectiles → bunkers/beams → UFO → deaths → wave/game-over → effects). |
| `effects.ts` | Particles, rings, floaters, shake, flashes. |
| `audio.ts` | Beat-locked bassline with tier layers, and all SFX (Web Audio, synthesized). |
| `input.ts` | Keyboard, mouse, gamepad, and touch merged into one per-frame `FrameInput`. |
| `render.ts` | Canvas drawing and HUD in 1920×1080 logical space. |
| `progress.ts` | localStorage best score and wave. |
| `InvaderProtocol.tsx` | Phases, the 16:9 DPR-scaled canvas, the 120 Hz fixed-step loop, pause on blur, overlays, and touch controls. |
