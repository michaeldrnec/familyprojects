# Feline Ballistics: The 3 AM Zoomies

> It's 3:15 AM and the humans are asleep. Fling squishy, liquid cats across the house
> to knock every precious thing off its perch before the snooze alarm rings.

Status: **built**. See the M0–M8 milestones below.

## 1. Design pillars

1. **Squish is the star.** Cats deform, pour through gaps and pancake on impact.
2. **Readable chaos.** Collapses you can follow, with slow-mo, shake, comic
   "CRASH! ×2" popups and a chain multiplier.
3. **One-finger agency mid-air.** Tap, hold and swipe are the whole vocabulary.
4. **Cozy mischief.** Humans and the dog are never hurt. A cat that's done trots off
   in a puff.

## 2. Core loop

- **Per level**: a fixed lineup of 3–4 cats, plus 1–3 **Precious** items (a dashed
  gold outline and sparkles).
- **Per shot**:
  1. Drag back anywhere to aim. Power is the drag length, and the dotted arc
     previews 0.8 s of flight.
  2. Release to launch.
  3. Use reflexes in flight.
  4. The shot settles: every awake body is below 0.35 speed for 1 s, or the
     cat leaves the room, or 12 s pass.
- **Down**: a Precious item counts as down if it's broken, *or* it dropped more
  than 60% of its height, *or* it was batted sideways more than max(80, 2.5 × its
  width). The last rule covers things already on the floor, cat-under-the-fridge
  style.
- **Win**: all Precious items down. **Lose**: out of cats.
- **Score**: chaos plus 5,000 per unused cat.
  - 1 paw is guaranteed on a win.
  - 2 and 3 paws come from per-level thresholds, tuned from solver replays (§9).
- **Clock**: 3:15 AM plus 4 minutes per cat launched.

## 3. Cats and reflexes

**Soft body**: a ring of 12 circles around a collision-free centre, held by:
- perimeter springs,
- cross braces,
- soft spokes,
- and a **pressure** term that pushes the ring back toward its rest area.

The pressure term is what makes it liquid rather than a puddle.

**M0 spike results:**
- Particle friction must be very low (0.03) or a squeezing cat wedges in place.
  With it, a Tabby passes 0.55× and 0.7× gaps and is blocked by 0.45× and 0.40×.
- The Coon (friction 0.15, stiff) doesn't squeeze. That's by design.

**Inputs** (`game/input.ts`):

| Gesture | Rule | Keyboard |
|---|---|---|
| Tap | < 180 ms and < 12 px | Space |
| Hold | ≥ 180 ms still | Shift |
| Swipe | ≥ 40 px within 250 ms | arrows |

**Aiming** (launch/cancel): any drag longer than 24 px launches, opposite to the
drag. A full pull is 170 px.

**Reflexes:**
- **Tap**: the breed's ability (§4).
- **Hold**:
  - Touching a `grip` sensor (dish towel, curtain, beam): **Claw Dig**, a pin
    constraint that swings the cat. It lasts up to 2 s, once per flight, and
    releasing pounces off with a +20% boost.
  - Otherwise: **Loaf**. Mass ×2, springs ×3, a shrunken rest area and no bounce.
- **Swipe**: **Tail Swish**, a nudge of 2.7 per 1/60 s. 2 charges.
- **Swipe up**: **Floof Glide**. Falling speed is capped for 1.2 s, using 1 charge.

## 4. Breeds (`game/breeds.ts`)

| Cat | Room | Personality | Tap |
|---|---|---|---|
| Orange Tabby | Kitchen | restitution 0.85; each hard bounce is deflected ±25° by the seeded rng | **Zoomies**: velocity ×1.6, capped |
| Maine Coon | Living Room | mass 26 (vs 8), slow, stiff; ×4 damage to wood; the only cat that breaks floorboards | **Chonk Slam**: straight down at 16, impact mass ×5 |
| Siamese | Office | light and fast | **Screamer Meow**: radius 260; shatters thin glass, shoves light items, wakes the dog |
| Calico | Bedroom | balanced | **Paw Swipe** ×3: radius 90; swats items under mass 5 sideways and up |

**The Dog** (office-3, office-5):
- It's asleep on its bed.
- It wakes when it hears a scream within 1.6 × 260, or glass breaks within 200, or a
  cat touches it.
- It then charges back and forth for 4 s, bulldozing whatever is on the floor.

## 5. Objects, materials and breakage

**Materials:** `game/materials.ts` defines 11 materials (thin glass through
electronics). Each has toughness, HP, noise, a break style and a sound.

**Impact:** on `collisionStart`, impact = relative normal speed × effective mass.
- A cat always counts as its whole-body mass, not the one particle that touched.
- Damage = impact − toughness, with ×4 for the Coon against wood.

**Break styles** (prefab slicing, so there's no poly-decomp dependency):
- Glass shatters into triangles. Ceramic splits into chunks, and wood into planks.
- Cardboard crumples into a smaller body.
- Electronics become a dark sparking **husk** where they stand.
- Floorboards simply open a hole.
- Shards collide only with the world and fade out after 5 s. There are at most 90.

**Chaos:**
- A break scores its material's noise × a chain multiplier (×1.5 per extra break
  within 0.5 s, max ×3). Precious breaks score ×2.
- A topple scores 50, or the material's full noise if the item can't break.
- A burst over 2,000 triggers 0.5 s of slow-mo (off with reduced motion).

**Stability:** Matter never checks sleeping-vs-sleeping contacts. So:
- Levels **pre-settle** for 0.5 s with damage off, then sleep.
- When any body wakes, the world wakes every sleeping body touching its bounds.
  Otherwise the top of a knocked tower would float.

## 6. Content: 20 levels (`levels/`)

| Room | Levels |
|---|---|
| Kitchen (Tabby) | First Pounce · Fridge Ricochet · Top Shelf · Dish Towel Swing · Spice Avalanche |
| Living Room (Coon) | Laundry Mountain · Under the Sofa · Creaky Boards · Curtain Call · Bookcase Domino |
| Home Office (Siamese, Dog) | Glass Cabinet · Monitor Tower · Let Sleeping Dogs Lie · Window Panes · Deadline Disaster |
| Bedroom (Calico) | Trinket Shelf · Perfume Row · Fan Flinger · Tiptoe · The Snooze Button |

- A room unlocks with 8 paws from the previous room.
- A level unlocks once the previous level in its room is cleared.
- Tutorial levels show one-time coach bubbles, remembered in progress.
- Special parts:
  - the ceiling fan (a sensor that flings the cat tangentially),
  - the human's face (a sensor; touching it costs 1,500 chaos),
  - the bouncy bed (restitution 0.9),
  - the sofa gap (40 units, 0.59 of a Tabby). The sofa's legs are drawn only.
    In 2D a leg is a wall across the whole opening, and the first solver run
    caught that no cat could ever get underneath.

## 7. Presentation

**Drawing** (code only, no image assets):
- Rooms: wallpaper pattern, a moonlit window, a light cone and the cat tree.
- Cats: a spline through the ring, breed markings, ears riding ring particles, a
  lagging tail, and a face per state.
- Objects: detail per prefab.

**Camera:** fits the whole room while aiming and follows the cat with look-ahead in
flight. **Peek** (👁 / P) forces the fit view.

**Audio:** everything is synthesized (`audio.ts`): per-breed meows, material impacts
and shatters, the scream, the slam, bark, snore/stir, the win purr and the alarm
ring.

**Accessibility:**
- Reduced motion (defaults from `prefers-reduced-motion`) turns off shake and slow-mo.
- Precious items use outline plus sparkles, not colour alone.
- Everything is playable by keyboard.
- Touch targets are larger on coarse pointers. Portrait phones get a "turn sideways"
  hint, following Ion Perimeter (the rooms are wide), and portrait still plays.
- Debug overlay: `` ` `` shows bodies, sleep state, HP and FPS. `?level=<id>` jumps
  to a level.

## 8. Architecture

- **`game/`** has no DOM:
  - `world.ts` (GameWorld: substeps, collisions, damage, abilities, dog, scoring)
  - `cat.ts`, `breeds.ts`, `materials.ts`, `objects.ts`, `input.ts`
- **`render/`**: `camera.ts`, `room.ts`, `cat.ts`, `objects.ts`, `fx.ts`
- **`screens/`**: `Menus.tsx` (title, rooms, levels) and `Play.tsx` (HUD, coach,
  results)
- **`FelineBallistics.tsx`**: the screen machine and progress
- **Copied per repo convention**: `audio.ts`, `rng.ts`, `useCanvas.ts`, `progress.ts`
- **Determinism**: fixed 1/180 s substeps, seeded rng for physics randomness, and
  `Math.random` for cosmetic effects only. A replayed shot list reproduces the same
  result exactly, which the QA replays depend on.
- **Save data**: localStorage key `feline-ballistics:progress` holds
  `{stars, best, coachSeen, settings}`.

## 9. QA harness (headless, `npx rolldown … --platform node`)

- **M0 spike:**
  - slot squeeze (above),
  - 0 tunnel crossings in 200 max-speed shots through 14–60-unit bodies,
  - a 10-high tower drifts 0.00 over 10 s idle,
  - glass breaks from a 40-unit drop but mugs, crates and boxes survive,
  - identical results on replay,
  - about 0.1 ms per substep.
- **Level sanity:** nothing falls during pre-settle, and nothing moves over 5 idle
  seconds.
- **Solver:** a greedy search per shot (angle × power × tap timing) replays prior
  shots deterministically. Every level must be winnable. Solutions are stored in
  `levels/solutions.ts`, and thresholds are 2 paws ≈ 0.7 × solver score and
  3 paws ≈ the solver score.
