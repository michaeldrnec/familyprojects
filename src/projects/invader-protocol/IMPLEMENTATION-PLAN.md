# Invader Protocol: implementation plan

Status: **planned, not started.** The design lives in [SPEC.md](SPEC.md). When the game is built,
fold the decisions below into SPEC.md, set its status to built, and delete this file.

## Goal

Build **Invader Protocol**, a fixed-screen Space Invaders–style shooter. On top of the classic
formula it adds:
- a march tempo locked to the music's beat
- column-snap and decapitation rules for the invader grid
- four weapons that share a heat meter
- hardlight bunkers that absorb fire and can be vented into a beam
- a mystery UFO

It goes on the site under Space Arcade. The build is a new game, so it gets a **minor** version
bump.

---

## Resolved gaps & interpretations (defaults; easy to retune in `constants.ts`)

| Topic | Spec says | Plan decision |
|---|---|---|
| Space key | Fire (§5) and dash (§1.2) | **Space = fire.** Dash = Left Shift + direction; with no direction held, dash toward the last move direction. |
| Gamepad RB / D-pad | RB = vent *and* next weapon; D-pad = move *and* weapon select | Left stick = move. D-pad = direct weapon select (↑1 →2 ↓3 ←4). LB/RB = cycle weapon. **B/Circle = vent.** RT = fire. LT or A = dash. |
| Grid step ΔX | unspecified | 16 px per beat. Bounds are checked against the outermost *living* column (120 / 1800). |
| Tempo vs. audio BPM tiers | F_step formula 60–210 BPM; audio tiers up to 220 | **The F_step formula is the single master clock**, and each grid step is one bass note. The audio tiers only pick which instrument layers play. The formula already matches the tiers (N=45→67, N=20→126, N=6→182, N=1→205 BPM). |
| Column snap direction | neighbors collapse inward 40 px | Every column on each side of the gap shifts 40 px toward it, so each side stays rigid. Shift is tweened over 0.12 s via per-column `xOffset`. Grid stuns for 0.6 s; the music keeps playing. |
| Who fires | Raiders fire straight down, 1.5–4.0 s per column | Each column has a fire timer (1.5–4.0 s). The lowest living entity fires, whatever its type, so columns still threaten after their raiders die. Frenzy: timer ×(1/1.5), ±12° aim spread, ±30% jitter on step size. |
| Weapon damage | unspecified | Disruptor 20. Needle 45 per entity (pierces 3, ignores armor and barriers). Spread 14 per pellet. Siege 70 direct + 45 splash (R=75, linear falloff to 50%). |
| Barrier Drone armor / barrier | "requires angle shots, Needle pierce, or Siege splash" | Drone carapace: Disruptor and the straight Spread pellet deal ×0.5. The Grunt beneath a living Drone has a barrier that absorbs *vertical, non-piercing, non-splash* shots (`|vx| < 1`). Angled Spread pellets, Needle, and Siege splash get through. |
| Siege "arcing" | Vy −900, arcing | Travels straight; the arc is visual only (scale-up/down plus a shadow). Detonates on the first entity hit or at Y=100. |
| Perfect Beat | ±50 ms of the bass pulse | Compared against beat timestamps in game time, not AudioContext time. On success: +25% speed, 0 heat, ×1.2 score on kills by that projectile, plus a chime and a flash. |
| Overheat | locks 2.5 s, cooling to 0 | Heat falls linearly from 100 to 0 over 2.5 s with fire locked. Normal cooling: 25/s after 0.3 s without firing. |
| Player shots vs. own bunkers | unspecified | Player shots pass through bunkers, since hardlight is friendly. "Chips cover shields" refers to Drone barriers. |
| Enemy damage | unspecified | Plasma bolt 25 to a cell (3 hits per cell). Grunt fragment 30. Invaders touching a bunker erase the cells they overlap. Any hit on the player costs a life. |
| Vent | converts E into a beam for 1.5 s; vaporizes the bunker | Requires E ≥ 10 and the player within the bunker's X-span. Beam DPS = 30 + 1.6·E to invaders in its X-span. It also erases enemy projectiles in the span. |
| UFO points "by distance" | 1,000–5,000 | 1000 + 4000·clamp(|ufoX − playerX| / 960, 0, 1), so longer shots score more. Rounded to 100s. |
| UFO bunker restore | +25% integrity to the most damaged bunker | Integrity = summed cell HP (max 1800). Restores 450 HP, rebuilding cells nearest the center first. Vented bunkers are gone for good and are not eligible. |
| Laser markers | dropped "behind shields" | Up to 2 per pass, placed at a random X inside a bunker's span at the player line. 1.2 s telegraph, then a 0.5 s orbital beam that hits the player only, ignoring bunkers. |
| Lives / waves / scoring | unspecified | 3 lives, 1.5 s respawn i-frames. Points: Raider 10, Grunt 20, Drone 30, Command 500. After a wave clears, the next spawns 32 px lower (capped at +160) and enemy fire cadence speeds up ×0.92. **All three bunkers rebuild at the start of each wave**, otherwise venting is only usable in wave 1. A bonus life every 10,000 pts. Endless, scored. |
| Touch | unspecified | Phone-friendly on-screen buttons, following Starwarden: ◀ ▶ / Fire (hold) / Dash / Vent / weapon chip row. |

---

## Architecture (`src/projects/invader-protocol/`)

Modeled on Starwarden (`src/projects/starwarden/`). One React component owns a `<canvas>` and a
`requestAnimationFrame` loop, mutable game state lives in refs, and the logic sits in small pure
modules.

| File | Responsibility |
|---|---|
| `constants.ts` | All tuning numbers from the spec plus the defaults above (one place to retune). |
| `rng.ts` | Copy of `src/projects/starwarden/rng.ts` (mulberry32; the repo copies it per project). |
| `beat.ts` | `stepFrequency(N)` (F_step formula), a beat clock that accumulates dt and emits beat events with timestamps, and `isPerfectBeat(t)` (±50 ms of nearest beat). Shared by grid, weapons, and audio. |
| `grid.ts` | Formation (5×11, rows typed C/B/G/R/R, HP 60/120/80/40/40). Per-column `xOffset`. March step on beat (ΔX, drop 32, reverse). Column-snap detection and tween, stun timer. Per-entity frenzy timer and jitter. Per-column fire timers. Barrier lookup (`hasBarrier(col)`). Fail check (Y ≥ 940). |
| `player.ts` | Accel/friction locomotion (600 / 3600 / 4800). Dash (180 px over 0.15 s, i-frames, 1.2 s cooldown). Lives, respawn invulnerability. |
| `weapons.ts` | Weapon table (speed, heat, cooldown, damage, pierce, splash). Heat/overheat state machine. `fire()` → projectiles (Spread fan at −15/0/+15°). Perfect-beat flagging. |
| `projectiles.ts` | Player and enemy projectile update. Swept collision against entities, cells, UFO, and player, with pierce counts, barrier/armor rules, and splash resolution. |
| `bunkers.ts` | 3 bunkers at Y=820 (X≈480/960/1440). 6×4 hex cells × 75 HP, cell charge color (blue→amber lerp by recent hits). `E_absorbed` (0.5×damage, cap 100). `vent()` → beam entity. `restore(450)`. |
| `ufo.ts` | Spawn timer 25–40 s, traverse at Y=60, HP 150. Laser markers (telegraph → beam). Reward calculation. |
| `fragments.ts` | Grunt death drops 3 fragments with sinusoidal X wobble, falling at about 450 px/s. |
| `effects.ts` | Explosions/particles, screen shake, floaters (score popups), snap shockwave ring, perfect-beat flash. Pattern from `starwarden/explosions.ts`. |
| `audio.ts` | Web Audio, lazy `init()` from a user gesture, mute toggle (pattern from `starwarden/audio.ts`). `onBeat(noteIndex, N)` plays B2→A♯2→A2→G♯2 (123.47 / 116.54 / 110 / 103.83 Hz). Tier layers by N: sub-bass through a 300 Hz lowpass; then kick and noise percussion; then snare roll and square arpeggio; then a distorted saw lead (WaveShaper) an octave up. SFX: column snap (noise and metallic triangle through a highpass), vent (noise swell crossfading to a resonant hum), rhythm chime, weapon shots, hits, UFO warble, overheat hiss. |
| `input.ts` | Keyboard (A/D/arrows, Space, Shift, F, Q/E, 1–4, Esc/P pause). Mouse (left fire hold, right vent with `contextmenu` prevented, wheel cycle). Gamepad polled each frame via `navigator.getGamepads()`. Touch button state. All of these merge into one `InputState` the loop reads. Edge-triggered actions (dash, vent, cycle) fire only on fresh press, like Starwarden's fire-on-keydown handling. |
| `render.ts` | Draws everything in 1920×1080 logical space: starfield, invader art per type (Command glow, Drone carapace and barrier arc, frenzy tint/shake), hex bunkers with charge color, beams, markers, HUD (score, wave, lives, heat bar with an overheat flash, 4-slot weapon selector, dash cooldown pip, per-bunker charge meters, beat pulse ring around the cannon for rhythm timing). |
| `progress.ts` | localStorage best score and best wave. Copy the shape of `starwarden/progress.ts`, key `invader-protocol:progress`. |
| `InvaderProtocol.tsx` | Phases `intro` / `playing` / `paused` / `gameover`. Canvas sized to its container at a fixed 16:9 aspect with a DPR backing store; `ctx.setTransform` maps 1920×1080 to the screen. Fixed-step update (1/120 s substeps, dt clamped) for consistent beat timing. Pauses on blur and visibility change. Intro screen shows controls; game-over shows score and bests. |
| `InvaderProtocol.css` | Layout, touch controls (shown on coarse pointers), overlays. Class prefix `ip-`. |

**Site wiring (during the build, not now):**
- `src/projects.ts`: add `{ slug: 'invader-protocol', title: 'Invader Protocol', description:
  'Break the marching alien lattice on the beat — four hot-running weapons, ventable hardlight
  bunkers, and a tempo that climbs as they fall.', category: 'Space Arcade', icon: '👾', accent:
  '#e879f9' }`.
- `src/App.tsx`: eager import plus `<Route path="/invader-protocol" …/>`. No heavy dependencies,
  so no lazy split is needed.

**Main loop order per substep:** input → player → beat clock (emit beats) → grid (march on beat,
unless stunned; frenzy entities step with jitter) → enemy fire timers → weapons/heat → projectiles
and collisions → bunkers/vent beam → fragments → UFO and markers → deaths (score, snap check,
frenzy trigger, fragments) → wave clear / game-over check → effects. Render once per frame.

---

## Build phases (each one playable and checkable on its own)

1. **Scaffold:** folder, registry and route, canvas scaling, loop, intro/pause/game-over overlays,
   player locomotion and dash, keyboard input.
2. **Grid and clock:** `beat.ts`, formation, march/drop/reverse, enemy fire, Disruptor only, lives,
   fail threshold, wave clear and respawn.
3. **Weapons:** all 4 weapons, heat and overheat, weapon switching, perfect-beat window and its
   feedback.
4. **Enemy behaviors:** HP per type, Drone armor and Grunt barrier, Grunt fragments, Command
   decapitation → frenzy, column snap and stun, scoring.
5. **Bunkers:** hex cells, absorption and charge colors, `E_absorbed` meters, vent beam, invader
   contact erosion, rebuild each wave.
6. **Apex Transponder:** UFO pass, laser markers, distance reward, bunker restore.
7. **Audio:** beat-locked bassline with tier layers, all SFX, mute button.
8. **Input breadth and polish:** mouse, gamepad, touch controls, HUD polish, effects, progress
   bests.
9. **Docs and version:** fold the resolved decisions into SPEC.md (status → built), delete
   IMPLEMENTATION-PLAN.md, run `npm version minor --no-git-tag-version` (new game).

---

## Verification (for the build)

- `npm run build` (tsc and vite) and `npm run lint` (oxlint) pass.
- Run `npm run dev` and play at `/invader-protocol`. Check:
  - March tempo audibly climbs as invaders die, and the bass note lands on each step.
  - Clearing a column snaps its neighbors 40 px and freezes the grid for 0.6 s.
  - Killing a Command sends its column into frenzy for 4 s.
  - A vertical Disruptor shot is blocked by a Grunt's barrier; a Spread angle, Needle, or Siege
    shot gets through.
  - Overheat locks fire for 2.5 s.
  - On-beat shots chime and cost no heat.
  - A bunker turns amber as it absorbs, and venting fires a beam and deletes that bunker.
  - The UFO's markers make the lane under a bunker deadly.
  - An invader reaching Y 940 ends the game.
- Spot-check `stepFrequency` against the tier table (N=55→60, 45→67, 20→126, 6→182, 1→205 BPM)
  with a quick throwaway `node` one-liner during the build.
- Test touch layout at phone width and a gamepad, if available.
