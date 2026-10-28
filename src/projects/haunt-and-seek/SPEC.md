# Haunt & Seek

> Four friendly ghosts, one candy-gobbling raccoon burglar. Scare him out of the manor before he
> eats every last sweet.

Status: **built.** Playable at `/haunt-and-seek`. Part 1 is the original pitch. Part 2 records how
the build resolved it for a family site: the rules as coded, the numbers, and what changed and
why. Part 3 is the code map. Phase 5 of the plan (local split-screen co-op and random "Endless
Night" manors) was not built; see the end of Part 2.

---

## Part 1: Original pitch

Working title *Hauntman*: a 3D asymmetric stealth-action horror-comedy that reverses the roles of
the classic arcade maze chase. You play a squad of four ghosts defending their labyrinth from an
insatiable intruder.

- **Win:** fill the intruder's **Fear Meter** to 100% so he panics and flees out through the spawn
  portal. **Lose:** his **Hunger Meter** reaches 100% (he has eaten every pellet).
- **Hunger** rises linearly per pellet; as it rises he moves faster and shrugs off subtle scares.
  **Fear** comes from jump scares, traps, wails and ambushes; high fear makes him stumble, take
  wrong turns and change routes. The ghosts share an **Ecto-Meter** for abilities, refilled by
  spectral residue and successful scares.
- **Power pellet:** the intruder becomes invulnerable and hunts the ghosts. Offensive abilities lock
  and swap to defensive ones (Wall Slip, Ecto-Decoy, Desperation Dash back to the Ghost House,
  which burns stored fear).
- **Four ghosts:** Red chaser/herder (Shadow Lunge, Strobe, Unseen Presence), Pink ambusher (Wall
  Mimic, Hall of Mirrors, Infinite Corridor), Cyan trickster (Ectoplasmic Sputter, Decoy Pellet,
  Poltergeist Symphony), Orange heavy (Ethereal Shockwave, Ghostly Wail, The Floor is Gloom).
- **Perspective:** first-person or tight third-person; single-player ghost hot-swap with AI for the
  others, or 4-player co-op.
- **Tech:** an intruder state machine (Patrolling/Eating, Investigating/Alert, Terrified/Fleeing,
  Frenzy/Hunting) on A* grid pathing that understands illusory walls, slippery floors and panic;
  a floating ghost controller with noclip windows; a central event and hazard bus.

---

## Part 2: As built

### Changes for a family site (and to keep it original)

- **Name:** Haunt & Seek. Spooky-silly, not horror: cartoon "BOO!"s, yelps and flattened ears.
  Nobody gets eaten or hurt.
- **Original characters.** No borrowed names, look, maze layout or sounds.
  - The intruder is **Snaxley**, a raccoon candy burglar with a headlamp and a candy sack that
    grows as he eats.
  - The pellets are wrapped **sweets** and the power pellets are **Sugar Rush gumballs**.
  - The labyrinth is **Hollowmere Manor**.
  - The ghosts are bedsheet ghosts:

    | Ghost | Color | Role |
    |---|---|---|
    | **Ember** | red | chaser |
    | **Blush** | pink | ambusher |
    | **Drizzle** | cyan | trickster |
    | **Marm** | orange | heavy |

- **Ability renames:** see the ability table below. "Blood-Red Strobe" became **Lantern Snuff**,
  and "The Floor is Gloom" became **Gloom Goo**.
- **Photosensitivity:** no strobes or flicker anywhere.
  - A lantern snuff fades the light over about a third of a second (most of a second with reduced
    motion).
  - The Sugar Rush glow pulses slowly.
- **Sugar Rush bonks instead of eating:** a bonked ghost poofs back to the Ghost House.
- **Single player only.** You fly one ghost and swap freely; the others run helper AI. Couch co-op
  was planned as a stretch phase and isn't built.

### The round

- **Win:** Fear reaches 100%. Snaxley drops his sack and runs for the front door at 1.8× speed,
  eating nothing. The round is won when he reaches the door.
- **Lose:** Hunger reaches 100%, meaning every sweet is gone.
- **Stars:** ★★★ if ≥ 50% of the sweets were left when he fled, ★★ if ≥ 25%, otherwise ★.

### Snaxley

**Movement:**
- He walks tile center to tile center at `1.9 × difficulty × manor × (1 + 0.35 × hunger)`
  tiles/s, with a 0.15 s munch per sweet.
- Multipliers:

  | Situation | Speed |
  |---|---|
  | Sugar Rush | ×1.2 |
  | spooked | ×1.45 |
  | fleeing | ×1.8 |
  | blind sprint | ×1.5 |
  | skidding | ×2.2 |

**States:**
- **Forage:**
  - At each tile he runs Dijkstra over the manor and heads for the best value per distance.
  - A sweet is worth 1, a gumball 2 and a Trick Treat 4, plus 0.4 for each sweet within two
    steps.
  - He keeps his current goal unless another scores 15% better.
  - Path cost per tile: 1, +6 × danger, and +4 for a slime he has seen. Mirror walls count as
    solid.
- **Spooked:** after a scare with a `spook` time. He runs from the scare's source (and turns
  round on the spot if he was heading toward it), eating nothing.
- **Flee:** at 100% fear, to the door. If a mirror wall blocks the only way, he runs through it.
- **Rush:** chases the nearest ghost or jelly decoy he can sense within 8 tiles. Decoys win ties
  by 3 tiles.

**Status effects** (on top of the state, each on a timer):
- Stumble, frozen, confused (random turns, 50% chance to reverse), stuck, treadmill, blind
  sprint, no-eat.
- Skid lasts until he hits a wall.

**Fear's own effects** (above 40%):
- He stumbles for 0.6 s, at a chance per second of `0.15 × (fear − 40)/60`.
- At crossroads he takes a random turn with probability `0.4 × fear`.

**Senses:**
- **Headlamp:** 6 tiles, a 70° cone, blocked by walls. In a snuffed hallway it's 3 tiles and 40°.
  In the Attic everything is ×0.75.
- **Hearing:** a ghost moving within 1.8 tiles makes him turn and look.
- **Seen it coming:** a ghost's "seen" time builds while it's in his cone and drains at 0.25/s. At
  1 s or more, that ghost's scares count half.
- **Danger map:** per-tile heat with a ~3 s half-life. Scares heat radius 2 around their source,
  and a wail heats radius 3 for as long as it lasts.

### Fear, hunger and ecto

**Hunger** = sweets eaten / sweets in the manor. Dropped sweets land on empty floor within 3 tiles
(up to 6 if it's crowded), never more than he has eaten.

**A scare adds** `base × difficulty × modifiers`:

| Modifier | Effect |
|---|---|
| seen it coming | ×0.5 |
| from a ghost the player isn't flying | ×0.5 |
| habituation | ×0.6 per use of the same ability in the last 15 s (25 s in the Great Hall), floor ×0.3 |
| Boo-Combo (a different ghost scared him in the last 2.5 s) | ×1.5 |
| hunger resistance | ×(1 − 0.5 × hunger) for subtle scares, ×(1 − 0.25 × hunger) for big ones |

**Decay:**
- −0.5/s once 6 s pass without a scare, never below the last 25% step reached. The fear bar
  marks that step.
- No decay during a Sugar Rush.

**Ecto:**
- Max 100, start 50.
- Refills 2.5/s on its own (×1.5 on Little Ghost).
- Every scare refunds 25% of the fear it added.
- **Wisps:** +15 each. One spawns every 6 s (9 s on Very Spooky) at least 6 tiles from him, with
  at most 4 out at once.

### Abilities

- Primaries cost 20 ecto (4 s cooldown), utilities 30 (10 s), ultimates 70 (45 s).
- Ultimates unlock from the Conservatory, and only the ghost you're flying can use one.
- Aimed traps (Mirror Wall, Slime Spit, Trick Treat) go on the tile in front of the ghost, which
  is outlined on the floor. Helpers may aim up to 3.2 tiles away.

| Ghost | Primary | Utility | Ultimate |
|---|---|---|---|
| **Ember** | **Swoop:** a 0.3 s dash of up to 3 tiles that passes through walls if it ends on open floor. Coming within 1.5 tiles of him on the way: fear 15, drops 1. | **Lantern Snuff:** the straight hallway the ghost is in (up to 6 tiles each way) goes dark for 8 s. Entering it (or being in it): frozen 1.5 s, fear 8 (subtle). | **Right Behind You:** within 7 tiles. Invisible for 6 s, gliding right behind him with footsteps (+3 fear/s, subtle). Then fear 20 and a 3 s blind sprint. |
| **Blush** | **Wallflower:** flattens into the nearest wall as a portrait for up to 15 s. Bursts out when he comes within 1.2 tiles, or on a second press (free). Within 2 tiles: fear 18 (+5 if he never saw her), drops 3, spooked 2.5 s. Cooldown starts at the burst. | **Mirror Wall:** a fake wall on a floor tile for 12 s (max 2). His pathing treats it as solid. If he panics into it, it shatters: fear 6. | **Endless Hallway:** within 6 tiles. He runs on the spot for 6 s, eating nothing: +4 fear/s. |
| **Drizzle** | **Slime Spit:** a puddle for 10 s (max 3). He skids at 2.2× to the end of the straight and bonks the wall: stumble 1 s, fear 10. Slime he has seen costs him +4 to path through. | **Trick Treat:** a sparkly fake sweet for 25 s (max 2) that he values like 4 sweets. Eating it: fizz, 3 s confused, fear 12. | **Poltergeist Party:** a 3-tile zone for 7 s. Inside it he's confused, +3 fear/s. |
| **Marm** | **Wall Thump:** a 2.5-tile shockwave through walls. Knocks the sweet out of his paws (no eating for 2 s), stumble 0.8 s, fear 12, spooked 1.5 s. | **Wail:** a sound source 4 tiles ahead (through walls) for 6 s. He looks at it and routes away. If he's within 9 tiles: fear 6 (subtle), and within 3 he's spooked. | **Gloom Goo:** the nearest crossroads within 2 steps turns to goo for 6 s. He's stuck in it: +5 fear/s. |

**Sugar Rush:** every ghost's buttons become the defense set.

| Defense | Cost | Cooldown | Effect |
|---|---|---|---|
| **Wall Slip** | 15 ecto | 3 s | noclip and untouchable for 1.2 s |
| **Ecto-Decoy** | 25 ecto | 6 s | a jelly ghost for 10 s; eating it takes him 2 s |
| **Desperation Dash** | 10 fear (can drop below the 25% step) | 8 s | 2× speed for 3 s |

- A rush lasts 8 s (6 s from the Kitchen on).
- He can't enter the Ghost House.
- A bonk (within 0.6 tiles):
  - The ghost respawns in the house after 4 s.
  - Fear −8 (not below the step) and ecto −10.

### Helper AI and the player

- Swap with 1–4, Tab, the portraits, or LB/RB on a gamepad (1 s cooldown). Over the shoulder, the
  camera turns to the new ghost's heading.
- Each helper has its own style:
  - **Ember** hangs 3 tiles behind on his trail and Swoops when he isn't looking.
  - **Blush** waits on his planned route 4 tiles ahead and goes into the wall.
  - **Drizzle** slimes his route 1–4 tiles ahead and leaves Trick Treats.
  - **Marm** lurks just out of sight behind a wall within thump range, and sometimes wails from
    the far side to push him toward the others.
- In a Sugar Rush, helpers run (preferring the Ghost House) and use the defense set.
- Helpers collect wisps when ecto is under 60 and he's far away.
- **Helpers deliberately don't steal the show:**
  - Their scares count ×0.5.
  - They leave 40 ecto in the pool for the player.
  - They wait 3.5–6 s between abilities.
  - They never use ultimates.
  - The planned "plays it safe while you're bonked" behavior wasn't needed.

### Manors and difficulty

| # | Manor | Size | Sweets | Gumballs | Ghosts | Snaxley speed | Other |
|---|---|---|---|---|---|---|---|
| 1 | The Foyer | 15×13 | 77 | 0 | Ember, Blush | ×0.85 | no ultimates |
| 2 | The Library | 19×17 | 141 | 2 | + Drizzle | ×0.92 | no ultimates |
| 3 | The Conservatory | 19×21 | 179 | 2 | all four | ×1 | ultimates unlocked |
| 4 | The Kitchen | 23×21 | 217 | 3 | all four | ×1.05 | 6 s rushes from here on |
| 5 | The Attic | 23×25 | 269 | 3 | all four | ×1.1 | 11 lanterns; vision ×0.75 |
| 6 | The Great Hall | 27×25 | 320 | 4 | all four | ×1.15 | 25 s habituation window |

- The maps were generated once from a seeded braid-maze script and saved as ASCII in
  `sim/manors.ts`. Each has no dead ends, a ring corridor round the Ghost House, a few rooms with
  an armchair in the middle, and the front door at the bottom.
- The per-manor speeds were tuned so the 2-ghost Foyer isn't harder than the 4-ghost manors.
- Winning unlocks the next manor; any unlocked manor can be replayed.

| Difficulty | Snaxley speed | Scares | Ecto refill | Wisps |
|---|---|---|---|---|
| **Little Ghost** | ×0.85 | ×1.3 | ×1.5 | every 6 s |
| **Spooky** | ×1 | ×1 | ×1 | every 6 s |
| **Very Spooky** | ×1.1 | ×0.85 | ×1 | every 9 s |

### Balance check

`sim/balance.test.ts` plays every manor on seeds 1–5 and checks four things:
- **Nobody haunts:** every manor is lost, in under 400 s, and Snaxley never stands still for 5 s
  while foraging.
- **Helpers alone, player idle:** at most 1 win in 4 seeds on Spooky.
- **The bot:** the helpers plus one ghost played "like a person" (no ecto reserve, short waits,
  ultimates, swapping ghost every 20 s) wins at least 4 of 5 on Spooky.
- **Little Ghost:** the bot wins all 5 with an average of at least 2★.

At the time of writing, over 6 seeds:

| Manor | Nobody (lost at) | Helpers alone | Bot, Little Ghost | Bot, Spooky | Bot, Very Spooky |
|---|---|---|---|---|---|
| Foyer | 70 s | 0/4 | 6/6, 2.5★, 73 s | 6/6, 2.0★, 100 s | 3/6, 0.5★ |
| Library | 127 s | 0/4 | 6/6, 2.5★, 102 s | 5/6, 1.2★, 179 s | 2/6, 0.5★ |
| Conservatory | 155 s | 1/4 | 6/6, 3.0★ | 6/6, 2.3★, 120 s | 5/6, 1.0★ |
| Kitchen | 178 s | 1/4 | 6/6, 3.0★ | 6/6, 2.2★, 181 s | 5/6, 1.2★ |
| Attic | 205 s | 1/4 | 6/6, 3.0★ | 6/6, 2.5★, 168 s | 5/6, 1.5★ |
| Great Hall | 259 s | 0/4 | 6/6, 3.0★ | 6/6, 2.5★, 181 s | 5/6, 1.5★ |

The bot is a floor, not the target: a person who aims Swoops from behind and saves ecto for
ultimates does better.

### Camera and controls

**Cameras:**
- **Over the shoulder** is the default with a mouse. It sits 2.5 tiles back and above the walls,
  and walls between the camera and your ghost dither away (a 4×4 screen-door pattern).
- **Overhead** is the default on touch screens. It's fixed north-up and pulls back on tall phone
  screens.
- **First person** has an FOV slider (55–95°), snaps without easing, and has no head bob.
- A mouse-sensitivity slider shows for the two cameras that turn.

**Controls:**

| | Keyboard + mouse | Gamepad | Touch |
|---|---|---|---|
| Move | WASD | left stick | thumb stick |
| Look | mouse (pointer lock after a click; Esc releases it and pauses), ← / → | right stick | drag (over the shoulder and first person) |
| Abilities | Q / E / R (also J / K / L; Space = primary; left / right click while locked) | A / B / Y | the three buttons |
| Swap ghost | 1–4, Tab | LB / RB | portraits |
| Pause | P / Esc | Start | ⏸ |

- In the overhead view the arrow keys move instead of turning.
- The game pauses when the tab or app loses focus.

### Look and sound

**Look:** everything is built from primitives and canvas textures (no image files).
- The floor is a checker rug with brass edging; the walls are instanced brick boxes.
- Lantern light is baked into a per-tile light map (a data texture sampled by the floor and walls)
  that Lantern Snuff darkens.
- Lights: one headlamp `SpotLight`, plus hemisphere, ambient and moonlight. No shadows.
- **Auto quality:** under 45 fps for 2 s drops the pixel ratio to 1.
- Snaxley shows his state:
  - his sack grows with hunger
  - he glows in a rush
  - his ears flatten when scared
  - he sinks in goo, wobbles when confused, and runs on the spot in an Endless Hallway
  - his headlamp's reach and width match what he can actually see

**Barks:** speech bubbles over Snaxley, and "BOO!" pops on every scare. All the text is in
`content.ts`, checked by `content.test.ts`.

**Sound** (all synthesized, panned by screen position):
- a music-box waltz in A minor that speeds up with hunger, and a square-wave jingle during a
  Sugar Rush
- effects for every ability, crunches, a boing for each scare, a chord for Boo-Combos, footsteps,
  a poof for a bonk, and win/lose fanfares

**Reduced motion:**
- no camera shake
- sweets and lantern flames hold still, and goo bubbles don't pulse
- slower light fades
- no banner or BOO! pop animations, and no confetti

### Screens and save

**Screens:** manor menu (manor list with stars, briefing, difficulty, camera, FOV, how to play, the
ghost roster) → play → results (stars, sweets saved, scares, best Boo-Combo, time; next / retry /
all manors).

**Save:** per profile through `createStore` (`haunt-and-seek:progress`, v1), with the unlocked
manor, best stars per manor, difficulty, camera, mouse sensitivity and FOV.

**Homepage tile:** "Manor 3/6 · 7★".

### Not built (stretch)

- **Couch co-op:** 2–4 local players in split-screen through renderer scissor viewports, with
  gamepads and helper AI filling empty seats.
- **Endless Night:** seeded random manors, run through the same solvability and balance tests.

---

## Part 3: Code map

**Simulation (`sim/`):** pure TypeScript with no DOM or three.js, so every rule runs in Vitest.
- `sim/config.ts`: every tuning number, the abilities (cost, cooldown, base fear, blurb), the
  ghosts, the difficulties and the six manors.
- `sim/manors.ts`: the ASCII maps.
- `sim/maze.ts`: parsing, tile queries, corridor runs and line of sight.
- `sim/path.ts`: Dijkstra with a binary heap.
- `sim/types.ts` and `sim/events.ts`: the world state, and the event bus (`WorldEvent`).
- `sim/world.ts`: `newWorld`, `stepWorld` (fixed substeps of at most 1/60 s; `input: null` makes
  the balance bot) and `roundResult`.
- `sim/intruder.ts`: Snaxley's senses, decisions, movement and statuses.
- `sim/fear.ts`: scares, modifiers, decay, dropped sweets and fleeing.
- `sim/ghosts.ts`: ghost movement and collision (with corner nudging), respawn and wisps.
- `sim/abilities.ts`: the 15 abilities and the upkeep of lasting ones.
- `sim/hazards.ts`: traps on tiles and their timers.
- `sim/helpers.ts`: the helper AI.

**Rendering (`render/`):**
- `render/useThreeView.ts`: the WebGL canvas, sized from its parent, pixel ratio capped at 2, auto
  quality, and the no-WebGL fallback.
- `render/scene.ts`: builds the manor and keeps it in sync each frame. Also handles event
  particles, projecting points to the screen, and the see-through hole.
- `render/models.ts`: ghost and raccoon models, plus the light-map and see-through shader patches.
- `render/effects.ts`: hazard visuals and particles.
- `render/textures.ts`: canvas textures and the light map.
- `render/camera.ts`: the three camera rigs and camera-relative movement.

**Input:**
- `input/controls.ts`: keyboard, mouse and gamepad, read into one snapshot per frame.
- `input/TouchControls.tsx`: the thumb stick and drag-to-look.

**UI and the rest:**
- `HauntAndSeek.tsx`: phases, the game loop, sound and banners. `Hud.tsx`: meters, portraits,
  abilities and minimap. `Screens.tsx`: menu and results. `HauntAndSeek.css`.
- `audio.ts`: synthesized music and effects. `progress.ts`: the save. `content.ts`: barks and
  tips.

**Tests:**
- `sim/maze.test.ts`: every manor is closed in, fully connected, has no dead ends and has a sealed
  Ghost House.
- `sim/path.test.ts`
- `sim/fear.test.ts`: every modifier, decay, the tier floors and dropped sweets.
- `sim/abilities.test.ts`: every ability's effect, costs, cooldowns and the rush swap.
- `sim/intruder.test.ts`: vision, spotting, fleeing to the door and determinism.
- `sim/balance.test.ts`
- `content.test.ts`: family-safe text.
- `sim/testWorld.ts`: shared set-up for the tests.
