# Starwarden

> Hold the line in a scrolling alien warzone — dodge and blast waves of enemies, and survive as
> long as your fuel and power crystals hold out.

Status: **draft spec — not yet built**. This document describes the design; no game code exists yet.

## 1. Pitch

A Defender-style side-scrolling arcade shooter. You pilot a lone ship patrolling a strip of
contested space that wraps around like a loop, not a line. There's no level to clear and no boss
at the end — just waves of enemies that get tougher the longer you last, and two resources
(engine fuel, laser power crystals) draining the whole time. The game is about how long you can
hold out, not about reaching an ending.

## 2. Theme & fantasy

- A lone defender on patrol above a contested strip of space/terrain — classic arcade tension,
  not a story-driven campaign.
- Visual style: closest to the 1981 original's neon/vector look, or a flatter pixel-art/canvas
  style closer to how Gravity Well renders its bodies — **open question, Section 14**.
- The pressure comes from dwindling resources and an ever-thickening swarm, not from a countdown
  or a finish line.

## 3. Core loop

- The world **scrolls horizontally and wraps around**: flying off the right edge brings you back
  in from the left, and vice versa — the level is a loop the player patrols, matching the
  original Defender's world structure.
- Enemies spawn at random positions/times along that loop. Some are passive/non-shooting
  (still dangerous on collision), others actively fire back.
- The player flies using thrust-vector movement (Section 4) and fires lasers to destroy enemies
  for points.
- Powerups (fuel canisters, power-crystal pickups) drift through the world and also drop from
  destroyed enemies — flying into one collects it.
- The run ends when the ship's hull/health reaches zero (Section 7) — not simply from running out
  of fuel or crystals, though losing either makes surviving much harder.
- Score comes from enemies destroyed plus time survived, and difficulty (spawn rate, enemy mix,
  enemy fire rate) ramps up continuously the longer the run goes (Section 11).

## 4. Controls

- **Up / Down** — move the ship vertically, directly and immediately. Not thrust-gated: this is
  arcade-responsive, available regardless of engine state.
- **Left / Right** — set the ship's **facing** direction (which way it's pointed and which way
  lasers fire). Pressing these does not by itself move the ship horizontally.
- **Engine/thrust key** (held) — ignites the engine and accelerates the ship along its current
  facing direction while held. Releasing it does **not** stop the ship instantly: existing
  velocity decays gradually (drag/inertia), so momentum carries over, matching Defender's
  thrust-vector feel. Burns fuel continuously while active.
- **Fire key** — fires a laser in the ship's current facing direction; consumes one power crystal
  (or a fractional charge) per shot.
- Keyboard-only for v1. Exact key layout (arrows vs. WASD vs. both, which key is thrust vs. fire)
  is an open question, Section 14.

## 5. Ship rendering

- The ship sprite/graphic must visibly change between **engine-on** and **engine-off** states —
  e.g. a thruster flame/glow that only renders while the engine key is held — so the player (and
  an onlooker) can always tell at a glance whether thrust is active.
- The sprite reflects **facing direction** — mirrored or redrawn for left- vs. right-facing —
  independent of engine state, so facing and thrust read as two separate, both-visible signals.

## 6. Enemies

- A small roster of enemy types (exact roster and behaviors: open question, Section 14), spawning
  at random positions/times along the wraparound world.
- **Non-shooting enemies**: still a threat via collision/ramming — the player must dodge or
  destroy them, not just outrun them.
- **Shooting enemies**: track and/or fire projectiles at the player, adding dodge-the-bullet
  danger on top of collision risk.
- Destroying an enemy awards points (weighted by type/difficulty) and has a chance to drop a
  powerup.
- The mix of enemy types and their spawn rate shift as the run's difficulty ramps (Section 11) —
  e.g. tougher or faster types phase in over time rather than being available from second one.

## 7. Resources & loss condition

- **Fuel** — finite, drains continuously while the engine is held on. At zero, the engine can no
  longer accelerate the ship; the ship keeps drifting on whatever velocity it already had (decaying
  via drag) and can still move up/down and fire — a slow, tense decline rather than an instant
  game-over.
- **Power crystals** — finite, spent per laser shot. At zero, the player can no longer fire and
  must dodge/evade only until a crystal pickup is found.
- **Game over** — triggered when the ship's health/hull reaches zero, from enemy fire or
  collision. Running out of fuel or crystals doesn't end the run directly, but makes surviving
  far harder and pushes the player toward that outcome. Exact hit-point model (one-hit-destroyed
  vs. a small health bar absorbing multiple hits) is an open question, Section 14.

## 8. Powerups

- **Fuel canister** — restores a fixed amount of fuel on pickup.
- **Power crystal** — restores a fixed amount of laser charge on pickup.
- Spawn both as standalone pickups drifting through the world on their own timer, and as
  chance-based drops from destroyed enemies.

## 9. Radar / mini-map

- A persistent HUD strip showing the **entire wraparound world width** compressed into one view,
  with markers for the player's position, enemies, and active powerups — the player's window into
  threats approaching from off-screen, core to the Defender feel.

## 10. Scoring

- Points per enemy destroyed, weighted by type/difficulty.
- A time-survived component — points per second alive, and/or a milestone bonus every N seconds
  survived.
- Live score shown during the run; a result screen on game over shows final score and (kept for
  the session) best score, with a restart action — following the same start → run → result →
  retry/restart shape used by Gravity Well and Xenofuse.

## 11. Difficulty ramp

- As survival time accumulates: enemy spawn rate increases, the enemy-type mix shifts toward
  tougher/faster types, and/or shooting enemies fire more often/accurately.
- This is what gives an endless mode a rising curve instead of a flat, unchanging difficulty —
  the run is always trending harder, which is what ultimately ends it.

## 12. UI/UX sketch

- **Main viewport**: the scrolling wraparound world — ship, enemies, enemy projectiles, player
  lasers, powerups — rendered on a canvas.
- **HUD**: live score, a fuel gauge, a power-crystal gauge, and the radar strip (Section 9), all
  visible simultaneously without obscuring the play area.
- **Start screen**: brief instructions (controls, objective) and a start action.
- **Game-over screen**: final score, best score for the session, and a restart action.

## 13. Technical notes for future build (non-binding)

Anticipated module split, following the patterns already established in this codebase:

- `Starwarden.tsx` — main component: canvas render loop, keyboard input, game state machine
  (start / playing / game-over). Gravity Well (`src/projects/gravity-well/GravityWell.tsx`)
  already solves canvas sizing, an animation-frame render loop, and keyboard controls in this
  codebase and is the closest existing reference.
- `Starwarden.css` — HUD and layout styling.
- `physics.ts` — ship movement/inertia model (thrust, drag, facing), akin to
  `gravity-well/physics.ts`.
- `enemies.ts` — enemy type definitions, spawn logic, and simple AI/behavior per type.
- `powerups.ts` — powerup spawn/pickup logic.
- `scoring.ts` — point values and the running/final score calculation, akin to
  `gravity-well/scoring.ts`.
- `rng.ts` — seeded PRNG for reproducible enemy/powerup spawns, reusing the existing mulberry32
  pattern already implemented in `gravity-well/rng.ts` and `xenofuse/rng.ts`.

This is a starting point for the build discussion, not a commitment — subject to change once
implementation begins.

## 14. Open questions for the user (resolve before build)

- **Enemy roster**: how many distinct enemy types for v1, and their exact behaviors (e.g. a
  straight-line drone, a gunner that tracks and fires, a fast diver)?
- **Ship health model**: one-hit-destroyed, or a small health/shield bar that absorbs a few hits?
- **Keyboard layout**: arrows, WASD, or both/configurable — and which specific key is thrust vs.
  fire?
- **Visual style**: vector/neon-line look (closest to the 1981 original) vs. flat pixel-art
  sprites vs. a more painterly canvas style (matching Gravity Well's rendered-gradient bodies)?
- **Humanoid rescue mechanic**: should Defender's classic "rescue humanoids from the ground before
  they're abducted" mechanic be included, or is this spec's simpler powerup-and-survive loop the
  intended scope for v1?
- **Audio**: any music/SFX expectations for v1, or out of scope?
