# Lux Tenebris

> A grid-based puzzle thriller in a pitch-black cave. Every step dims your flashlight, and every
> second spends your air. Look while you can, remember what you saw, and cross the dark from memory.

Status: **built** — 20 caverns in 4 chapters.

## 1. Core idea

Two resources pull against each other:

- **Light (steps).** Each level has a battery: the number of steps your beam stays lit. The beam's
  reach shrinks with the charge left, from `maxReach` tiles on a full battery to 1 tile on the
  last charge, then nothing. You can always keep walking in the dark; the danger is what you
  can't see.
- **Air (seconds).** A real-time clock starts on your first move or look. At zero, the level
  restarts.

The beam is a **~70° cone you aim**. Turning it costs no battery, only time, so scouting means
"spend seconds", and travel means "spend light".

## 2. Rules

- Turn-based movement on a grid in 4 directions. Moving also points the beam that way.
- Aim without moving: Shift + direction, the mouse, or a drag on the canvas (touch).
- Stepping into a chasm (or a raised bridge) is a fall: the level restarts. So does running out
  of air. **R** restarts at any time.
- **Echo** (E): a limited number per level. A sonar pulse outlines **walls only** (not chasms or
  items) for 0.8s.
- Win by stepping onto the exit, which always glows faintly so you know where you're headed.

## 3. Tiles (ASCII level format, see `levels.ts`)

| Char | Tile | Behavior |
|---|---|---|
| `#` | Rock | Blocks movement and light |
| `.` `S` `E` | Stone / start / exit | |
| `C` | Chasm | Deadly. Light passes over it |
| `=` | Plank | Safe. Hollow footstep sound |
| `~` | Water | Safe. Splash footstep sound |
| `B` | Spare cell | +4 battery (up to the level's maximum). Glows faintly as a lure |
| `M` | Moss | Once lit, glows faintly for the rest of the level, as a landmark |
| `/` `\` | Calcite mirror | Blocks movement; reflects the beam 90° |
| `k` / `D` | Key / door | The key opens every door. A closed door blocks light too |
| `p` | Plate | Stepping onto it flips every gate and bridge |
| `g` / `G` | Gate open / closed | |
| `h` / `H` | Bridge raised / lowered | Raised = a hole in the floor |

Glow-worms (`critters` in a level) are harmless: they walk a fixed path back and forth and light
a small area around themselves.

## 4. Chapters

1. **The Basics (1–5):** walls, chasms, spare cells, moss. Most of the route is lit.
2. **Sightlines (6–10):** mirrors, keys and doors.
3. **Mechanisms (11–15):** plates, gates, drawbridges, glow-worms, water.
4. **Blind Faith (16–20):** the light always dies 5–8 steps before the exit; echoes, moss and
   footstep sounds carry you home.

`solver.ts` searches every level for its shortest route using the real rules in `logic.ts` and
reports lit versus dark steps; it's used to check every level is solvable and on target.

## 5. Difficulty

| | Afterimage of tiles you've seen | Air |
|---|---|---|
| Lantern | stays faintly visible | ×1.5 |
| Torch (default) | fades over 4s | ×1 |
| Ember | none — true darkness | ×0.85 |

## 6. Stars and progress

Each cavern awards up to ★★★: one for reaching the exit, one for a route within 2 steps of the
shortest, and one for finishing within 55% of the air. Best stars are saved per difficulty in
localStorage (`progress.ts`), and each cavern unlocks once the previous one is cleared on that
difficulty.

## 7. Presentation

- **Lighting** (`light.ts`): 120 rays across the cone, marching in 0.08-tile steps. Walls and
  closed doors/gates stop them; mirrors reflect them (mirroring the ray across the tile's
  diagonal so the cone keeps its spread). Brightness falls off with distance and toward the
  cone's edges.
- **Rendering** (`render.ts`): tile art for lit tiles, then a one-pixel-per-tile darkness mask
  drawn scaled up with smoothing for soft light edges, then things that glow on their own (exit,
  cells, moss, glow-worms), echo outlines and the explorer.
- **Atmosphere:** the beam flickers below 25% battery, the screen edges redden when air runs low,
  and a flash marks a fall.
- **Audio** (`audio.ts`, synthesized): footsteps by terrain, a filament hum that grows louder as
  the battery dies, a heartbeat that speeds up as air runs out, and cues for echo, pickups,
  plates, falls and the exit.

## 8. Files

`LuxTenebris.tsx` (game loop, input, screens), `logic.ts` (pure rules), `tiles.ts` (level format),
`levels.ts`, `light.ts`, `render.ts`, `solver.ts`, `audio.ts`, `progress.ts`, `LuxTenebris.css`.
