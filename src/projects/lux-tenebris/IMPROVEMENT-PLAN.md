# Lux Tenebris: improvement plan (v2)

Status: **planned, not started.** This plan implements all 17 suggestions from the design
review that followed the first release (site v1.1.0). When it's done, fold the changes into
SPEC.md and delete this file.

## Goal

The core idea works: light costs steps and looking costs time. But in v1 several systems
undercut it:
- scouting is nearly free
- the "blind" chapter is mostly lit
- the echo doesn't help where the danger is
- the light renders as blocky tiles

v2 makes darkness the real challenge, makes the light look like a flashlight, and turns sound
into a navigation tool.

## Order of work

Each phase can be finished and checked on its own:

1. **Rules and controls** (items 1, 2, 4, 5, 6, 15), because everything else depends on them
2. **Levels** (7, 8, 9), plus moving the level-check script into the repo
3. **Graphics** (10, 11, 12)
4. **Sound** (13, 14)
5. **Phone and tutorial** (16, 17)
6. **Docs and version**

---

## Phase 1: Rules and controls

### 1. The clock starts only on a deliberate input
- **Problem:** mouse movement over the canvas sends an aim action, and aiming starts the clock.
- **Change:** in `LuxTenebris.tsx` `handlePointer`, ignore mouse `pointermove` until the level has
  started (`playRef.current.started`).
  - A click (`pointerdown`) aims and starts the clock.
  - Keys (move, Shift+aim, E) and touch start it as before.
- After the clock starts, hovering aims as now.
- Update the start hint to "The air starts running on your first move, look, or click."

### 2. The beam turns at a fixed speed
- **Problem:** the beam snaps to the cursor almost instantly, so scouting a room is free.
- **Change:** split the aim target from the beam's actual direction in `logic.ts`.
  - `PlayState.facing` stays the *target* direction.
  - Add `PlayState.beam`: the beam's actual angle.
  - `tick` turns `beam` toward `facing` by at most `TURN_RATE × dt`, taking the shorter way
    around. Use `TURN_RATE = 4` rad/s, so a 90° turn takes about 0.4s.
- This applies to every kind of turn, including the turn when you step in a new direction, so
  the rule is the same for everyone.
- `initialState` sets `beam = facing`.
- The solver is unaffected, because it never ticks.
- Rendering and lighting use `s.beam`. Delete the frame-based easing on `angleRef` in the
  component.
- Mouse hover keeps updating the target, so a cursor sweep still costs real time.

### 4. No more accidental auto-walking
- **Keyboard:** ignore `KeyboardEvent.repeat` for moves, so each step needs its own key press.
  Keep the one-step buffer, so a quick double-tap still works.
- **Touch D-pad:** remove the hold-to-repeat interval from `holdMove`. One tap is one step.

### 5. A real target time for the time star
- Replace `PAR_TIME_FRACTION` with a per-level target time:
  `parTime = (shortest × 0.45 + level.lookAllowance) × difficulty.timeScale`.
  - `lookAllowance` is a new optional `Level` field, default 6 seconds.
- Add `parTime(level, shortest, timeScale)` to `logic.ts`, so the clear card and the star rule
  share one formula.
- The clear card shows "Time: 9.4s (target 12s)".

### 6. Unlocks shared across difficulties
- In `progress.ts`, `isUnlocked`: a cavern is unlocked if the previous cavern has stars on
  **any** difficulty.
- Stars stay per difficulty. The level select shows the current difficulty's stars, plus a small
  dot on levels cleared on another difficulty.

### 15. Show light as a step count
- In the HUD, replace the light bar with "🔦 7": the battery value, which is the number of lit
  steps left.
- Keep a thin bar underneath for at-a-glance reading.
- At 0, show "🔦 —" in dim red.

**Tests (Phase 1)** — browser `page.evaluate` tests that import `logic.ts`:
- `beam` moves at most `TURN_RATE × dt` per tick.
- Aiming before the first tick doesn't change `beam` until ticks run.
- Moving doesn't snap `beam`.
- `parTime` matches the formula.
- `isUnlocked` works across difficulties.

---

## Phase 2: Levels

### Move the level checker into the repo
- Add `src/projects/lux-tenebris/check-levels.ts`, run with
  `npx tsx src/projects/lux-tenebris/check-levels.ts [level#]`. It ports the scratch script used
  for v1.
- For each level it prints:
  - shortest route
  - lit and dark steps
  - row-width errors
  - solvability
  - the route drawn over the map
- **Flags:**
  - chapter 1 lit share below 60%
  - chapter 4 dark steps outside **10–15** (the new target)
  - time limit under 1.6× the minimum
  - `parTime` above 70% of the time limit
- Add a **"cell value" report**: for each spare cell, the lit steps on the best route that picks
  it up, against the shortest route. This needs `solve()` to accept an optional "must visit
  tile" (search to the cell, then from the cell to the exit, with the battery carried over).
  Levels about cells must show the detour adding at least 3 lit steps.
- Run it after every level edit. All 20 levels must pass with no flags.

### 7. Rework chapter 4 so it's truly blind
- **Design rule:** short battery, long reach. You get a big but brief look, then a stretch of
  10–15 steps in the dark.
- Redesign levels 16–20:
  - **16 Last Light:** a corridor ending at a ledge that overlooks a chasm field. About 6 battery,
    reach 12. You see the whole field from the ledge, then cross it blind.
  - **17 Echo Chamber:** a twisting walled maze in the dark. Two echoes and the walls are the
    only guide. A few chasm pockets at corners. Battery about 4.
  - **18 Count Your Steps:** a wide hall with a single plank crossing. The plank lines up with a
    moss tile on the far wall. Battery about 5. Hollow plank footsteps confirm you're on it.
  - **19 Constellation:** a moss-marked path through a chasm field with no other light. Battery
    about 8, and the moss you lit early must guide 12+ dark steps.
  - **20 Lux Tenebris:** finale using a mirror scout, key, plate, and a 15-step blind crossing.
    One spare cell, which buys light at the right moment if you plan for it.
- Times should be around 1.8× the minimum moves, plus the look allowance.

### 8. More variety in levels 1–15
Replace or rework the levels that are just "snake through a chasm grid" or have unused space:
- **3 Spare Cell:** move the cell so skipping it leaves the last 6+ steps dark, and taking it
  lights the whole route. The cell-value report must show it.
- **5 Fork in the Dark → "Double Back":** fetch a key across a field, then return through the
  same field with less light.
- **8 Locked:** put the key on the far side of the currently unused lower-right chasm field, so
  every part of the map matters.
- **11 Pressure:** keep it (it's already a there-and-back). Shorten the dark return so it fits
  chapter 3.
- **14 Toggle Twice:** keep it.
- **15 Waterworks:** use water as the safe path through a dark field, with a splash on every
  correct step and stone underfoot meaning you strayed onto the risky route.
- **New mechanic tile: crumbling ledge (`x`).** Safe to step on once. It collapses into a chasm
  when you step off it.
  - It forces one-way routes, so you can't backtrack lazily.
  - Use it in 12 Drawbridge or 13 Glow-worms.
  - Changes: `tiles.ts` gets the tile type; `logic.ts` tracks collapsed tiles (state
    `collapsed: number[]`, part of the solver key); render draws a cracked floor; sound is a
    crumble when it collapses.

### 9. The exit glows only once seen
- The exit behaves like moss: it glows faintly only after the beam has lit it once (track
  `exitSeen` in the component, like `mossSeen`).
- **Lantern difficulty** keeps the always-visible exit, as an easy-mode assist. Add a
  `showExit: boolean` field to `Difficulty`.
- Echo never reveals the exit.

---

## Phase 3: Graphics

### 10. Draw the light as a real flashlight beam
- **Problem:** brightness is calculated per tile and smoothed up, so the beam looks like blurry
  brown squares.
- **Change:** draw the beam from the actual ray paths.
  - `light.ts`: `computeLight` also records each ray's path (start, any mirror bounce points,
    end) and returns them as `rays: Point[][]`, in tile units. Per-tile brightness is still
    computed, because the "seen" memory and moss/exit tracking use it.
  - New `render.ts` function `drawLightMap(ctx, layout, rays, extras)` renders onto an
    offscreen canvas the size of the view:
    1. Fill it with black (alpha 1).
    2. Using `destination-out` (which cuts holes in the black), fill a 4-sided strip between
       each pair of neighboring rays, segment by segment. For the first segment use a radial
       gradient centered on the player that fades over `reach`. For segments after a mirror
       bounce, use a linear gradient by distance travelled. The beam then has crisp edges and
       wall shadows.
    3. Still with `destination-out`, add soft holes for:
       - the faint glow at your feet (a circle)
       - glow-worms (circles)
       - remembered tiles, using the existing smoothed per-tile mask at memory brightness only
  - Composite: draw the tiles, then the light map on top, then a warm tint (the beam strips
    drawn again in `rgba(255,214,150,0.08)` with `soft-light`), then glowing items and the
    player.
  - Tiles are drawn wherever brightness or memory is above 0, as now. The light map decides what
    is visible.
- **Performance:** at most 120 rays × (1 + bounces) strips per frame, which is cheap. Reuse the
  offscreen canvas between frames.
- Respect `prefers-reduced-motion`: no flicker, no screen shake.

### 11. A proper explorer sprite
- A top-down explorer:
  - helmet (round, amber lamp at the front)
  - shoulders and a pack (a darker oval behind)
  - two small boots that alternate with a step bob while sliding
- Rotated to the **beam** angle, so the body follows the slow beam turn.
- The lamp glows only while the battery is above 0. At 0 it shows a dark lamp with a single tiny
  ember dot.

### 12. Falling that teaches
- **Fall sequence (1.2s):**
  1. A 0.25s screen shake (skipped with reduced motion).
  2. The explorer shrinks and spins down into the hole over 0.5s.
  3. A cold blue rim flashes on the chasm tile.
  4. The screen fades fully to black over 0.3s, then the level restarts.
- Remove the grey white-flash overlay.
- **Ghost footprints:**
  - Keep the tiles of the previous attempt (`lastAttemptRef`). On the restarted level, draw them
    as faint paired footprints, plus a small crack icon on the tile where you fell.
  - Shown on Lantern and Torch, not on Ember.
  - Cleared when you change level.
  - The footprints glow faintly on their own, so they are a deliberate memory aid.

---

## Phase 4: Sound

### 13. Sound as a navigation tool (`audio.ts`)
- **Chasm wind:** one looping noise source (a bandpass filter around 400–700 Hz with a slow
  wobble), through a `StereoPannerNode` and a gain.
  - Each frame, the component sums nearby chasm tiles (and raised bridges, and collapsed ledges)
    within 3 tiles, by Manhattan distance. Weight by `1/distance²`. The weighted average left-right
    position sets the pan, and the total weight sets the volume (clamped).
  - Plays whether or not the tiles are lit. This is the "sound in the dark" skill.
  - New function: `setWind(pan, level)`.
- **Ambience:** a very low two-oscillator drone (about 55 Hz and 82 Hz, with a slow detune) at
  low volume, plus random water drips (a short sine "plip" with a pitch drop), panned toward a
  random nearby wall tile, every 2–6 seconds.
  - New functions: `startAmbience()` and `stopAmbience()`, tied to the play screen.
- Plank and water footsteps stay. Add a soft stone-scrape variant so stone steps aren't
  identical.

### 14. Heartbeat and the moment the light dies
- The heartbeat starts on your first input: an interval of 1.4s at full air, shrinking linearly
  to 0.35s at empty, and louder below 30% air.
- New logic event `'battery-dead'`, fired by the step that takes the battery from 1 to 0.
  - Sound: a filament fizz (filtered noise) then a click, then the hum stops.
  - Visual: the beam stutters twice over 0.3s before going out (render-only, skipped with
    reduced motion).

---

## Phase 5: Phone and tutorial

### 16. Phone controls and camera
- **Swipe on the cave to walk:** a swipe of at least 24px picks the main direction and takes one
  step.
- **Press and hold (250ms without moving) then drag** aims the beam.
- **A quick tap** does nothing, so you don't take accidental steps.
- Keep the D-pad, but make it smaller and move it beside the Echo and Restart buttons in a bottom
  bar.
- **Camera zoom:** `layoutFor(grid, minTilePx)` takes a minimum tile size. If fitting the whole
  cave would make tiles smaller than 36 CSS px (worked out from the canvas's displayed width),
  use 36px tiles and a camera that follows the explorer, clamped to the cave edges.
  - Pointer → tile conversion goes through the same layout.
  - On desktop the whole cave usually fits, so nothing changes there.

### 17. Interactive tutorial prompts
- New optional `Level` field `tutorial: { text: string; until: 'move' | 'aim' | 'echo' | 'steps3' | 'dark' }[]`.
  The hint panel shows each prompt in turn and moves on when its condition happens (the
  component checks events and state).
- Prompts per level:
  - **Level 1:** "Look before you walk: Shift+→ or click to aim your light" (until aim), then
    "Walk with the arrows — each step uses one charge (🔦)" (until 3 steps), then "Mind the
    chasms" (until dark).
  - **Level 2:** "When the light runs out, keep going from memory."
  - **Level 6:** introduces mirrors with "Aim into the mirror".
  - **Level 17:** introduces echo with "Press E to echo" (until echo).
- On touch devices the text switches between "Shift+→" and "drag to aim" automatically, based on
  the pointer type.

---

## Phase 6: Docs and version
- Update SPEC.md: rules (beam turn speed, clock start, crumbling ledge, exit memory, target
  time), sound, phone controls, chapter targets and the level checker. Then delete this file.
- Bump the version: **minor**, because this changes gameplay (see CLAUDE.md).

## Verification
- `npx tsc -b` and `npx oxlint`.
- `npx tsx src/projects/lux-tenebris/check-levels.ts`: all 20 levels pass, chapter 4 dark
  stretches are 10–15 steps, and the cell levels show the cell's value.
- Browser rule tests (Playwright `page.evaluate` importing modules through vite):
  - beam turn rate
  - no clock start on hover
  - key repeat ignored
  - crumbling ledge collapses
  - `battery-dead` event fires
  - exit hidden until seen (Torch/Ember) and visible on Lantern
  - unlocks across difficulties
- **Screenshots, desktop and phone (390×844):**
  - beam with crisp wall shadows
  - a mirror bounce
  - the explorer sprite with lamp on and off
  - fall sequence frames
  - ghost footprints after a retry
  - the HUD step count
  - tutorial prompts on level 1
  - phone camera zoomed on a large cave
- **Manual listening pass** (the browser tests run with no sound):
  - wind pans left and right as you walk past a chasm
  - drips and drone are present but quiet
  - the heartbeat speeds up as air runs out
  - the light-dies fizz plays
- Play every chapter 4 level on Torch to confirm each is beatable from memory.
