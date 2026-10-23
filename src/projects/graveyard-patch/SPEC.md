# Graveyard Patch

> The night shift before a game launch: fix bugs, ship patches, stay awake until 6:00 AM.

Status: **built.** Playable at `/graveyard-patch`. Part 1 is the original pitch (working title
*Night Owl: Hotfix Horizon*). Part 2 records how the build resolved it for a family site: the rules
as coded, the numbers, and what changed and why. Part 3 is the code map.

---

## Part 1: Original pitch

You sit in front of a dual-monitor rig in a dark bedroom lit only by RGB glow and panic. The clock
runs from 11:00 PM to 6:00 AM (launch deadline / team standup). Bug reports fly in from a
Twitter-style feed on the left monitor; your IDE sits on the right. Juggle bug squashing,
deployment and staying awake before your user rating drops to 0 stars or you fall asleep at the
keyboard.

1. **Vigilance meter.** A sleep meter keeps filling. Near 100% the screen edges blur, typing gets
   typos and your eyelids close (a vignette). Mash a key to snap awake. Consumables: espresso /
   energy drink (−40% sleep, but "the jitters": cursor drift, faster mini-games), a cold water
   splash (clears blur, small relief, 3 s away from the desk), and a caffeine crash from too much
   coffee without water.
2. **Bug pipeline.** P3 visual glitches (low priority), P1 memory leaks / exploits (players leave),
   P0 server fires (siren; halts all uploads until resolved).
3. **Arcade mini-games.** Syntax Scramble (Guitar Hero-style key matching), Spaghetti Unravel
   (untangle crossed wires before a timer), and the Roll-the-Dice Quick Patch (80% fix, 20% two new
   bugs).
4. **Deploy.** Patches aren't live until a 5–10 s build uploads; new reports keep stacking up
   meanwhile. Shipping while hallucinating risks a broken dependency.
5. **Escalation.** 1:00 AM review bomb (4× reports for 60 s), 2:30 AM auditory hallucinations
   (fake pings), 4:00 AM merge conflicts from a teammate in another timezone, 5:15 AM the 5-AM
   Crash Zone (sleep 2× faster, colors invert unless you wash your face).
6. **Look and sound.** Moody bedroom vs. blinding neon; a ticking clock that gets louder as you
   tire; lo-fi music that goes muffled as you nod off and crisp after a sip; keyboard thocks that
   turn mushy.
7. **Progression.** Spend Overtime Pay between nights: ergonomic keyboard (fewer typos), espresso
   machine (stronger, less jitter), dual-band router (half upload time), desk cat (pet for
   alertness; ignored, it sits on the keyboard).

---

## Part 2: As built

### Changes for a family site

- **Name:** Graveyard Patch (graveyard shift + patch).
- **No energy drinks:** coffee only. The game you're keeping alive is *Galaxy Gardeners*, a cozy
  space-gardening game, so the angry posts are about upside-down carrots and lost harvests.
- **No head-slamming or face-slapping:** you "shake it off", and falling asleep is a cartoon
  *Zzz…*.
- **Photosensitivity:** no strobes. The P0 alert is a slow 1.6 s glow; the Crash Zone flips to
  inverted colors on a ~6.5 s cycle with a 0.6 s CSS fade. With reduced motion there's no head
  shake, the P0 border is solid red, and the Crash Zone is a steady sepia/hue tint.
- **Cursor drift:** a page can't move the real cursor, so the jitters make the mini-game targets
  move instead (Unravel nodes wobble under your finger or mouse; Bug Hunt's bugs speed up and
  weave).
- **Bug Hunt instead of Syntax Scramble:** the first build had Syntax Scramble (tokens falling down
  four lanes, hit D F J K on the line). Playtesting found it confusing, so it was replaced with Bug
  Hunt, which anyone gets at a glance and which works the same with a mouse or a finger. The
  Ergonomic Keyboard upgrade became a Precision Mouse to match, and the ignored cat lies across the
  screen instead of the keyboard.
- **All text is written ahead of time** (`content.ts`) and checked word by word with
  `isFamilySafe` in `content.test.ts`.

### The night

- 11:00 PM → 6:00 AM takes `NIGHT_SECONDS` = 240 real seconds (4 minutes; it was 6 in the first build, which felt too long).
- **Lose** if your rating reaches 0, or you stay at 100% sleep for `DOZE_LIMIT` = 3 s.
- **Survive** to 6:00 AM: stars = the final rating rounded to the nearest half star (at least ½).
- Rating starts at 4.0 and goes up to 5.0. Each open ticket drains it per second (P3 0.0035,
  P1 0.009, P0 0.022); each shipped patch restores it (P3 +0.12, P1 +0.3, P0 +0.5). Imaginary
  tickets don't drain. The players-online count is flavor, driven by rating and open P1/P0s.
- Reports arrive every `spawnEvery` seconds (15 → 11 across the week, ±25%), shrinking 30% by 6 AM.
  At most one P0 is open at a time.

### Fixing and shipping

- **Fix** opens the ticket's mini-game in the IDE. One ticket at a time; ✕ or Backspace puts it
  back. Passing stages a patch; failing leaves the bug in the queue.
- **Bug Hunt** (`minigames/hunt.ts`): 6 / 9 / 12 bugs (P3 / P1 / P0) crawl in from the edges,
  0.9 / 0.75 / 0.65 s apart, each aimed through the middle of the board and taking about
  4.6 / 4.1 / 3.6 s to cross it (all divided by the night's tempo). Tap or click within 32 px to squash
  one. You may let 1 / 2 / 2 escape; the round ends early once too many have. Sleepy mis-taps (sleep
  above 55%, up to 40%, ×0.35 with the mouse) land 45 px off target. A "tap the bugs" hint shows
  for the first 2.5 s.
- **Spaghetti Unravel** (`minigames/unravel.ts`): 5 / 6 / 7 nodes with 2 / 3 / 4 extra chords and
  25 / 30 / 36 s. Puzzles are built from a crossing-free layout (a polygon plus non-crossing
  chords of a random triangulation), then scattered until there are at least ⌊n/2⌋ crossings, so
  each one is solvable.
- **🎲 Quick Patch:** instant. 20% of the time it also schedules two small (P3) regressions 4–12 s
  later. Not allowed on P0s.
- **Deploy** ships everything staged. The upload takes 8 s (4 s with the router) and **halts**
  while a P0 is open; you can't start one while a P0 is open. Starting a deploy above 80% sleep
  fixes a broken-dependency chance of up to 60%; a broken build sends every patch in it back to the
  queue.

### Staying awake

- Sleep starts at 10% and rises `sleepRate` per second (1/150 on Monday → 1/95 on Friday);
  ×1.6 during a caffeine crash, ×2 in the Crash Zone.
- **Shake it off** (Space / button, mashable): −3% × stamina; each press costs 10% stamina, which
  recovers 12% per second.
- **Coffee** (from Tuesday): −40% sleep, 10 s of jitters, 20 s to refill. The third coffee in a row
  without water starts a 30 s **crash**.
- **Water:** 3 s away from the desk (mini-games freeze, tickets can't be opened), −12% sleep, 15 s
  of clear eyes (less blur), and it resets the coffee streak, ends a crash and clears the Crash Zone
  colors. 6 s cooldown after you get back.
- Visuals: blur above 50% sleep (up to 1.2 px), vignette from 35%, eyelids from 82% (thin until you
  actually doze), and the music filter closes and the clock gets louder as sleep rises.

### Hazards

| Time | Hazard | Nights |
|---|---|---|
| 1:00 AM | **Review Bomb:** a streamer bug (P1, Unravel) plus 28 s of 4× reports, all P3 duplicates. Deploying the streamer bug closes every duplicate (each worth half a P3). | Wed–Fri |
| 2:30 AM | **Phantom pings** every 11–18 s. Each has a 30% + 60% × sleep chance of adding an imaginary ticket that vanishes when opened (or after 14 s). | Thu–Fri |
| 4:00 AM | **Merge Conflict:** every 16–24 s the teammate in Sydney pushes; a random staged patch becomes a conflict ticket (Unravel), or a new P3 conflict appears. | Thu–Fri |
| 5:15 AM | **Crash Zone:** sleep ×2, and the inverted-color flips build up over 14 s until you splash water. | Fri |

### The week

| Night | New this night |
|---|---|
| Monday | P3 bugs, Bug Hunt, Deploy, Quick Patch, water and shaking |
| Tuesday | P1 bugs, Spaghetti Unravel, coffee |
| Wednesday | P0 server fires, Review Bomb |
| Thursday | Phantom pings, Merge Conflict |
| Friday | Crash Zone |

- Surviving a night unlocks the next. Any unlocked night can be replayed for better stars.
- **Overtime Pay:** P3 3, P1 6, P0 12 per shipped patch (+1 per closed duplicate). Surviving adds
  15 + 6 × whole stars; losing pays half of what you shipped.
- **Upgrades:** Precision Mouse 100 (mis-taps ×0.35), Espresso Machine 140 (coffee −50%, jitters
  4 s and milder, 15 s refill), Dual-Band Router 140 (4 s deploys), Desk Cat 80 (walks across the
  desk every 25–40 s; petting it gives −15% sleep; ignored for 8 s, it lies across the middle third
  of Bug Hunt for 10 s, where bugs can't be tapped).

### Balance check

`sim/night.test.ts` plays every night with a bot that takes realistic mini-game times (7–10 s for
Bug Hunt, 11–14 s for Unravel), fails 12% of fixes (plus its mis-tap chance), pauses 1.5 s between
tickets, quick-patches when 5+ tickets are open, deploys in batches and manages its sleep. It must
survive every night on five seeds with no upgrades and more than 1.5 stars. Doing nothing must lose
every night, each upgrade's effect is checked directly, and one good week must pay for every
upgrade. The bot finishes most nights on 4–5 stars; real players are slower, so this is a floor, not
the target difficulty.

### Controls

Mouse/touch for everything (the mini-games need a pointer). Keyboard: Space (shake), C (coffee),
W (water), Enter (deploy), 1–9 (open ticket), Q (quick-patch the oldest small bug), Backspace (put a
ticket back), P / Esc (pause). The game pauses when the tab or app loses focus.

### Screens and save

Week menu (pick a night, read its briefing, buy upgrades, how to play) → the rig → results (stars,
stats, pay, next night / retry / week). Saved per profile through `createStore`
(`graveyard-patch:progress`, v1): unlocked night, best stars per night, Overtime Pay, owned
upgrades. Homepage tile: "Night 3/5 · 2 upgrades".

---

## Part 3: Code map

- `sim/config.ts`: the clock, every tuning number, the five nights and the upgrades.
- `sim/night.ts`: the rules: `newNight`, `stepNight`, the player actions, `nightResult`.
- `content.ts`: every bug title, post and message.
- `minigames/hunt.ts`, `minigames/unravel.ts`: mini-game rules and generators;
  `BugHunt.tsx`, `SpaghettiUnravel.tsx`: their canvases (`useCanvasLoop`); `env.ts`: what
  they read from the night each frame.
- `Rig.tsx`: the in-game screen and overlays. `Screens.tsx`: week menu and results.
- `GraveyardPatch.tsx`: phases, the main loop, keyboard, sound events. `audio.ts`: synthesized
  music and effects. `progress.ts`: the save.
- Tests: `sim/night.test.ts` (rules and balance), `minigames/minigames.test.ts` (every bug is
  catchable, puzzles solvable), `content.test.ts` (family-safe text).
