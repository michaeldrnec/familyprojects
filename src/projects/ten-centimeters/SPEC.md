# 10 Centimeters

> Run the Labor & Delivery night shift: four bays, one OR, one doctor. Catch every baby before 7 AM.

Status: **playable: all four milestones built; awaiting playtest feedback on balance.** Live at
`/ten-centimeters` with the full simulation, the floor, the heart rate strips, the push-meter
delivery and the five-step Code Stork surgery, synthesized sound, saved progress with shifts that
unlock in turn, and an end-of-shift scorecard. Star thresholds are tuned against a bot (see
*Balance check*) and still need real-player tuning. Part 1 is the original pitch (working title
*Labor & Delivery: Code Stork*). Part 2 records how the build resolves it. Part 3 is the code map.

---

## Part 1: Original pitch

### 1. Project Overview & Tech Stack

Build a 2D top-down tactical time-management and surgical micro-game playable in a desktop web
browser.

- **Framework:** React + TypeScript + Vite (or HTML5 Canvas / Phaser 3 inside a React wrapper for
  UI overlays).
- **Styling:** Tailwind CSS for HUD, patient charts, and shift summaries.
- **Audio:** Web Audio API procedural sound effects (heart rate monitor beeps, alarm sirens,
  suction sounds, baby cry chime).
- **Art Style:** Clean, stylized 2D vector/canvas graphics (similar to *Overcooked* or *Mini
  Motorways* clarity: high contrast, readable status icons, color-coded vitals).

### 2. Core Data Models (`types.ts`)

- `ShiftState`: `timeRemaining` (seconds, e.g., 300s = 12hr shift), `score`,
  `deliveriesCompleted`, `complicationsCount`, `isPaused`, `activeView`
  (`'FLOOR_VIEW' | 'OR_SURGERY_VIEW' | 'DELIVERY_VIEW'`).
- `Patient`: `id`, `name`, `assignedBay` (`'BAY_1' | 'BAY_2' | 'BAY_3' | 'BAY_4' | 'OR_1' |
  'DISCHARGED'`), `dilation` (0.0 to 10.0 cm), `dilationRate` (cm per second, modifiable by
  Pitocin), `maternalStress` (0 to 100; high stress risks blood pressure spikes), `fetalHeartRate`
  (normal 110–160 bpm; distress <100 or >180), `fetalOxygen` (100 to 0; drains only when
  `fetalHeartRate` is in distress), `condition` (`'NORMAL' | 'STALLED_LABOR' | 'FETAL_DISTRESS' |
  'PREECLAMPSIA'`), `hasEpidural`, `hasPitocin`.
- `DoctorAvatar`: `x`, `y`, `targetX`, `targetY`, `speed`, `currentTask`, `isScrubbedIn`.

### 3. Gameplay Systems & Mechanics

**System A: The L&D Floor (top-down canvas).** 4 L&D bays on the left/bottom, 1 Operating Room
(OR) on the top right, a Scrub Sink outside the OR, and a Supply Station (Pitocin, Epidural kits,
Oxygen masks). Click-to-move (or WASD) doctor avatar. Clicking a patient bay moves the doctor there
and opens a radial or quick-action menu:

1. *Administer Pitocin:* increases `dilationRate` by 2x, but increases chance of `FETAL_DISTRESS`
   if overused.
2. *Administer Epidural:* caps `maternalStress` at 30, slightly slows `dilationRate`.
3. *Give Oxygen / Reposition:* temporarily stabilizes `FETAL_DISTRESS` to buy time.
4. *Deliver Baby (available at 10cm):* triggers `DELIVERY_VIEW` mini-game.
5. *Call Crash C-Section:* immediately moves patient to `OR_1` and triggers `OR_SURGERY_VIEW`
   (requires doctor to touch the Scrub Sink first for 1.5 seconds).

**System B: Fetal Heart Rate (FHR) Strip HUD.** A live scrolling waveform strip at the top of the
screen for all active bays. Green steady wave = normal; yellow erratic wave = warning; red
flat/dipping wave + audio alarm = critical distress (`fetalOxygen` draining).

**System C: Surgical & Delivery Mini-Games (modal overlay canvas).** In `OR_SURGERY_VIEW`, pause
floor movement (or run the floor at 0.25x) and present a 5-step sequential mini-game:

1. **Incision:** click and drag along a dotted Pfannenstiel line without straying outside the
   guide box.
2. **Retract & Suction:** click rapidly on pooling blood/fluid markers to clear the visual field.
3. **Deliver Infant:** hold and drag the infant icon upward along a curved extraction path at a
   controlled speed (too fast = penalty; too slow = oxygen drops).
4. **Clamp & Cut:** click two clamp targets on the umbilical cord, then slice between them.
5. **Suture Closure:** click alternating stitch points along the incision to close and complete
   the surgery.

### 4. Phased Execution Plan

- **Milestone 1 (Core Loop & State):** game clock, `Patient` generator, vitals simulation tick
  (10 Hz), basic UI cards for the 4 bays so the simulation is playable via buttons first.
- **Milestone 2 (2D Floor & Avatar):** interactive canvas hospital floor, doctor
  pathfinding/movement, scrub sink requirement, live scrolling FHR waveform strips.
- **Milestone 3 (Delivery & C-Section Mini-Games):** vaginal delivery (timing-based push meter) and
  the 5-step Crash C-Section sequence.
- **Milestone 4 (Polish & Balancing):** procedural Web Audio monitor beeps/alarms, shift difficulty
  scaling (more patients, complex conditions like Preeclampsia), and an end-of-shift performance
  scorecard.

---

## Part 2: As built

### Changes from the pitch

- **Name:** *10 Centimeters*. "Code Stork" is the in-game name for the emergency C-section.
- **Site conventions over the pitch's stack:** plain CSS and canvas through the shared
  `useCanvasLoop`, no Tailwind or Phaser, and no new dependencies.
- **Phones and tablets:** tap-to-move and tap buttons for everything, alongside the keyboard.
- **Family-safe:** cartoon style. The surgery is a draped tummy with a glowing seam, clear blue
  fluid bubbles instead of blood ("pooling blood/fluid markers" in the pitch), and a swaddled baby. Nobody is ever lost: when a
  baby's oxygen runs out, the specialist team rushes in and takes over (a penalty), and three of
  those end the shift early.
- **Carrying supplies:** the doctor holds two items, picked up at Supply. Oxygen masks need
  carrying; repositioning is free but shorter and has a cooldown.
- **Magnesium** joins Supply, since preeclampsia had no counter in the pitch.
- **Conditions are flags, not one value:** a patient can be stalled *and* have preeclampsia.
  `condition` shows the most urgent one (distress, then preeclampsia, then stalled).
- **Triage:** new patients wait in triage when every bay is full (`assignedBay: 'WAITING'`), with
  slower labor and rising stress, until the nurses move them into a free bay.
- **The midwife:** a mom left at 10 cm for 25 s is delivered by the midwife, for fewer points.
- **No dead ends in the mini-games:** a surgery step left alone for 25 s is finished by the nurse
  (at the lowest score); in a delivery an unpushed contraction counts as a miss, and the ninth push
  always delivers the baby.
- **Unlocking:** Shift 1 is open from the start; a star on a shift opens the next.

### The shift

- 7:00 PM → 7:00 AM takes `SHIFT_SECONDS` = 300 real seconds. Vitals update at 10 Hz; the doctor
  moves every frame.
- Patients arrive at 3–6 cm and dilate at 0.05–0.10 cm/s (×2 on Pitocin, ×0.85 with an epidural,
  ×0.08 while stalled, ×0.6 in triage).
- **Stalled labor:** some patients (per shift) stall somewhere between 4.5 and 7.5 cm. Pitocin
  restarts it; a Pitocin drip already running carries her past the stall.
- **Pitocin** runs for 45 s. While it runs there's a small chance per second of fetal distress
  (0.3%), five times that after a second bag on top of the first.
- **Mother's stress** rises with dilation (0.2 + 0.45 × cm/10 per second), faster in triage. An
  epidural brings it to 30 and holds it there, but only before 8 cm. Above 80 it costs 1 point per
  second.
- **Preeclampsia** adds 1.1 stress per second, which an epidural doesn't cap. Magnesium takes off 35
  and slows the rise to 40% for 45 s. At 100 stress the baby goes straight into distress.
- **Fetal distress:** 6 s of yellow warning, then red. While red, the heart rate sinks to ~86 bpm
  with dips (or races to ~190), and once it's out of the 100–180 range the baby's oxygen drains at
  2% per second (50 s from full). An oxygen mask holds it off for 25 s; repositioning for 10 s (20 s
  cooldown). Only a delivery ends distress.
- **Code Stork** (for any complication, one OR): the patient moves to the OR at once and the doctor
  heads for the sink. Standing still at the sink for 1.5 s scrubs in; then walking into the OR
  starts surgery. Touching Supply or treating a patient undoes the scrub.
- **Procedures:** while delivering or operating, the rest of the floor runs at 0.25× speed, and the
  procedure's own patient can't lose the last of her baby's oxygen.
- **Scoring:** each baby gets 1–3 stars: 3, less one if the baby's oxygen is under 70 (two if under
  40), one if Mom's stress is 80+, and one for a fumbled mini-game (quality under 0.5). 100 points
  per star, plus a skill bonus of up to 50 (quality × 50), +50 for a Code Stork, 40 for a midwife
  delivery, −150 per specialist call, −1 per second per mom at 80+ stress, −0.5 per second per
  patient waiting in triage. The results screen's scorecard breaks the total down by these, and
  lists every mom with how her baby arrived and its stars.

### The delivery: push meter

A contraction marker sweeps back and forth across the meter after a short breath. Push (tap the
canvas, the Push button, or `Space`) while it's in the green zone: the gold middle third is
*perfect* (+40 progress), the rest of the zone *good* (+28), outside it a *miss* (+0). The baby
arrives at 100, so three perfect pushes or four good ones. After each push Mom rests 0.7 s and the
zone moves; each successful push narrows the zone (24% → 15% of the meter) and speeds the marker
8%. The meter's speed comes from Mom's stress (0.55–1.0 widths per second), 15% slower with an
epidural, which ties floor care to the mini-game. Quality is the average push (perfect 1, good
0.75, miss 0). A contraction left for 5 s with no push counts as a miss, and nine pushes always
end it.

### The Code Stork: five steps

On a 600 × 420 board scaled to fit. Each step scores 0.2–1; quality is the average.

1. **Incision:** drag from the green dot along the dotted smile line, inside its pale guide band
   (20 px either side). Leaving the band stops the cut (−0.18 per wobble); start again from the
   green dot where it stopped. Jumping ahead doesn't count. Slow after 6 s costs a little.
2. **Suction:** ten blue fluid bubbles (four at once, then one every 0.45 s) that grow until popped.
   Tap them all; slow after 5 s and missed taps cost a little.
3. **Deliver:** hold the baby and draw them up the curved path. Faster than 300 px/s is "too fast"
   (−0.6 per second of it); after a 3 s grace the baby's oxygen gauge drains (−0.12 per second).
4. **Clamp & cut:** tap the two clamp rings on the cord, then swipe across the cord between them.
   A cut outside the clamps costs 0.25; a tap that misses, 0.08.
5. **Suture:** tap the eight numbered stitch points in order; a wrong one costs 0.12.

### Sound

All synthesized with Web Audio through the site's shared channel and mute (🔊 in the top bar): a
soft Doppler heartbeat at the selected (or operated-on) baby's heart rate, a gentle two-tone alarm
every 3 s while any baby is critical, chimes for arrivals and complications, clicks for supplies,
a water sparkle for scrubbing in, a cartoon newborn cry with a chime for each baby, and the pops,
clamps, snips and stitches of the mini-games.

### The five shifts

| Shift | Name | New this shift |
|---|---|---|
| 1 | First Night | Normal labors, stalled labor, Pitocin, epidurals |
| 2 | Heartbeats | Fetal distress, oxygen masks, repositioning, Code Stork |
| 3 | Pressure | Preeclampsia and magnesium |
| 4 | Full Moon | Three starting patients, arrivals every 24–32 s |
| 5 | Code Stork | Arrivals every 20–28 s, more of every complication |

Stars for the shift come from the score (thresholds in `sim/config.ts`: 900/1500/2200,
900/1600/2300, 1000/1700/2500, 1300/2200/3200 and 1400/2400/3500); a shift ended by the specialist
team earns none. Best stars and scores are saved per player profile, and the homepage tile shows
"Shift 3/5 · 7★".

### Balance check

`sim/shift.test.ts` plays every shift on six seeds with a bot that waits half a second between
decisions, takes 6 s per delivery and 22 s per surgery at quality 0.7, handles distress first (mask
or reposition near 10 cm, Code Stork otherwise), then ready moms, magnesium, stalls and epidurals,
fetching from Supply as needed. It must finish every shift with at least one star and average 1.5.
Doing nothing must earn no stars. The bot scores around 3 stars (shift 1 about 2600, shift 5 about
4400); star thresholds sit at roughly 35%, 60% and 80% of its scores. Slower bots (1.5 s reactions,
28 s surgeries) score within 5% of it, so the thresholds mostly measure juggling the floor, which a
real player does far less tidily than the bot: expect 1–2 stars at first.

### Controls

Tap or click a room to walk there (tapping a bay also selects it), or tap a heart rate strip.
In a delivery, tap or press `Space` to push. The surgery is played with a mouse, finger or pen.
WASD / arrow keys walk freely. `1`–`4` walk to a bay, `5` Supply, `6` the sink, `7` the OR. At a
bay: `Z` Pitocin, `X` epidural, `C` magnesium, `V` oxygen mask, `B` reposition, `Space` deliver,
`Enter` Code Stork. At Supply the same `Z`/`X`/`C`/`V` pick up that item. Tapping an action for a bay
you're not at walks there and does it on arrival. Tap a carried item in the top bar to put it back.
`P` / `Esc` pauses (mini-games too), and the game pauses when the tab or app loses focus. 🔊 mutes.

---

## Part 3: Code map

- `sim/types.ts`: the data model. `sim/config.ts`: every tuning number and the five shifts.
- `sim/shift.ts`: the rules: `newShift`, `stepShift`, `walkTo`, `command`, `pickItem`,
  `finishProcedure`, `shiftResult`.
- `sim/floor.ts`: the floor layout, where the doctor can walk, and A* pathfinding.
- `content.ts`: every name and message.
- `render/drawFloor.ts`: draws the floor; `render/Floor.tsx`: its canvas and taps;
  `render/FhrStrip.tsx`: one heart rate strip.
- `Hud.tsx`: top bar (with mute), action bar, supply shelf, toasts. `keys.ts`: shortcuts.
  `Screens.tsx`: menu (locks, best stars) and results (rank, scorecard, baby list).
- `Procedure.tsx`: the panel that hosts a mini-game over the floor.
- `minigames/push.ts` and `minigames/stork.ts`: the mini-games' rules, no DOM.
  `minigames/PushGame.tsx` and `minigames/StorkGame.tsx`: their canvases and input.
  `minigames/drawing.ts`: board fitting and the swaddled baby.
- `audio.ts`: every sound. `progress.ts`: saves, unlocking and the homepage summary.
- `TenCentimeters.tsx`: phases, the main loop (sim, sounds, monitor beeps) and the keyboard.
- Tests: `sim/shift.test.ts` (rules and balance), `sim/floor.test.ts` (every station reachable
  along clear lines), `minigames/minigames.test.ts` (good play scores high, sloppy play less, the
  nurse unsticks idle steps), `progress.test.ts` (unlocking and corrupt saves), `content.test.ts`
  (family-safe text).
