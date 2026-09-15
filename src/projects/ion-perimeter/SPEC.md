# Ion Perimeter

> A classic space tower defense: enemy ships run a fixed lane toward your outpost core.
> Build and upgrade weapon platforms along the way, hold the perimeter for twenty waves,
> and break two dreadnoughts before the core gives out.

Status: **built** — see build order in the implementation plan.

## 1. Pitch

An alien fleet is inbound along a single, winding lane through an asteroid corridor,
converging on your outpost's core. You can't move — only build. Credits earned from
kills buy weapon platforms on fixed pads flanking the lane, and upgrading a platform
matters as much as adding a new one. Twenty waves, escalating in variety and pressure,
capped by two dreadnought bosses. Hold the line or watch the core go dark.

## 2. Theme & fantasy

- A lone outpost at the end of a debris-strewn space corridor, holding a perimeter
  against an escalating alien assault.
- Visual mood: dark starfield and drifting nebula gradients, the lane rendered as a lit
  corridor of light, glowing vector-drawn towers and ships with particle trails and
  burst explosions — the same neon-arcade energy as Gravity Well and Starwarden rather
  than painterly rendering.
- The tension is economic and spatial at once: where to spend the next credit, and
  which pads matter most as enemy composition shifts wave to wave.

## 3. Core mechanic: build, upgrade, hold

- **Placement**: a fixed set of buildable pads sit along the lane. Tap a tower type in
  the shop bar, then tap an empty pad to build it (a range-preview ring shows before
  confirming). No open-field maze-building — pad positions are hand-placed per map, so
  the challenge is choosing *what* to build where, not *whether* a maze can be built at
  all.
- **Upgrading**: tap a built tower to open its panel — upgrade through 3 stat tiers,
  then choose one of two tier-3 specializations (a single branch point per tower, not a
  deep tree). Upgrading is often the better spend late-game versus a new tower on a
  worse pad.
- **Selling**: any tower can be sold back for a partial refund, freeing a pad to
  rebuild differently as enemy composition shifts.
- **Pacing**: 1x/2x speed toggle and pause, so the player can spend build time without
  the run feeling like a race against a clock outside of active waves.

## 4. Towers

Five platform types, each with 3 stat tiers and a tier-3 specialization branch:

1. **Pulse Cannon** — cheap, rapid single-target kinetic fire. The starter tower and
   most cost-efficient early DPS. Branch: *Twin Barrel* (higher fire rate) vs
   *Overcharged Round* (bigger single hit, small splash).
2. **Laser Lance** — instant-hit beam piercing every enemy in a line. Strong vs.
   groups/swarms strung out along the lane. Branch: *Phase Beam* (pierces + brief slow)
   vs *Focus Array* (narrower beam, much higher single-target damage).
3. **Flak Battery** — arcing shells with splash damage on impact. Best vs. clustered
   swarms. Branch: *Cluster Charge* (bigger radius) vs *Proximity Fuze* (faster
   fire rate, smaller radius).
4. **Ion Disruptor** — slows every enemy in range and arcs a light chain-damage tick
   between nearby targets. Support/control tower, weak alone, strong paired with
   heavy hitters. Branch: *Deep Freeze* (stronger slow) vs *Chain Reactor* (chain
   jumps to more targets).
5. **Railgun** — long range, very high single-target damage, slow fire rate, ignores
   armor entirely. The anti-boss, anti-armor answer; unlocks after reaching wave 8 in
   any prior run (see Persistence). Branch: *Penetrator Slug* (shot pierces one extra
   target) vs *Siege Coil* (bonus damage vs. bosses specifically).

## 5. Enemies

Seven types plus two bosses, introduced gradually across the twenty waves:

- **Scout Drone** — fast, low HP. Early pressure and a fire-rate check.
- **Cruiser** — the baseline mid-HP, mid-speed threat.
- **Armored Hulk** — high HP, slow, resists a flat portion of non-piercing damage
  (Railgun ignores this entirely).
- **Swarm** — spawns in tight clusters of many cheap, fast, fragile units. The
  reason Flak/Laser exist.
- **Shield Skiff** — carries a regenerating shield that absorbs hull damage until
  broken; the shield regenerates if left alone too long.
- **Stealth Phantom** — periodically cloaks, rendering near-transparent and only
  faintly targetable while cloaked.
- **Dreadnought (boss, wave 10)** — large, high HP, two damage phases (a shield
  phase then a hull phase).
- **Harbinger (boss, wave 20, final)** — larger still, three phases, spawns a
  small Scout Drone escort partway through its fight.

Each leaked enemy drains Core Integrity by an amount scaled to its threat (bosses
drain far more than a Scout Drone).

## 6. Structure: 20-wave campaign, finite

- Waves are hand-authored, not procedurally generated — with only twenty of them the
  full curve is tunable by hand, unlike Solar Ward's endless procedural escalation.
- Enemy variety and density ramp wave over wave; the two bosses land at wave 10 and
  wave 20 as fixed milestones.
- A short **wave-cleared** banner shows between waves (kills, credits earned) before
  the next wave's countdown begins; the player may start the next wave early once
  ready.
- **Victory**: clearing wave 20 (the Harbinger) ends the run with a Victory screen and
  final stats. No endless mode in v1 — the campaign is deliberately finite and
  finishable.
- **Game over**: Core Integrity reaches 0 at any point.

## 7. Scoring & economy

- Credits per kill (higher for tougher enemies), spent on builds/upgrades; selling
  refunds a fraction of total credits spent on a tower.
- Score = credits earned + a per-wave-cleared bonus scaled to remaining Core
  Integrity, rewarding a clean wave over a scraped-through one.
- **Best Wave Reached** and **High Score** persist across sessions (see Persistence).

## 8. Persistence

No project in this repo has used `localStorage` before — Ion Perimeter is the first,
scoped narrowly to its own `progress.ts` module (not extracted into a shared utility,
matching the repo's per-project-duplication convention since nothing else uses it
yet):

- Stores **best wave reached** and **high score**, shown on the start screen.
- Gates the **Railgun** tower behind reaching wave 8 in any past run, and gates the
  Ion Disruptor's *Chain Reactor* branch behind reaching wave 14 — so repeat play
  unlocks a persistent arc of stronger options, not just a leaderboard number.
- A fresh browser/profile with no saved data plays the full campaign with the
  ungated tower set only (Pulse Cannon, Laser Lance, Flak Battery, Ion Disruptor
  with one branch), which is still fully completable — the gated content is a bonus
  for returning players, not a requirement to finish.

## 9. Controls

- **Mouse/touch** (primary, identical on both): click/tap a tower in the shop bar to
  select it, click/tap an empty pad to build, click/tap a built tower to open its
  upgrade/sell panel, click/tap elsewhere to close it.
- **Keyboard shortcuts** (optional accelerators): `1`-`5` select a tower type, `Space`
  toggles pause, `2` (context: no tower selected) toggles 1x/2x speed — exact bindings
  finalized during build to avoid clashing with tower-select digits.
- Touch targets sized up under `@media (pointer: coarse)`, the same convention
  Starwarden's CSS already uses for its on-screen buttons.

## 10. Audio & visuals

- **Audio**: synthesized retro SFX via the Web Audio API only, following
  `gravity-well/audio.ts` / `starwarden/audio.ts` exactly (lazy singleton
  `AudioContext` created on first user gesture, `masterGain` node for mute). Cues:
  per-tower fire sound (cannon chatter, laser sizzle, flak thump, disruptor hum,
  railgun crack), explosion, tower-placed click, upgrade chime, enemy-leaked alarm,
  wave-start countdown beep, wave-cleared fanfare, boss-incoming siren, victory
  fanfare, game-over dirge.
- **Visuals**: dark starfield + slow-drifting nebula gradient backdrop; the lane as a
  glowing corridor; pads as dim glowing platforms that brighten when buildable/
  hovered; towers as distinct glowing vector silhouettes per type with a visible
  tier/branch tell; enemies as glowing ship silhouettes with motion trails, shields
  as a visible bubble, cloaked Phantoms rendered near-transparent; particle-burst
  explosions on every kill; Core Integrity rendered as a glowing ring/bar around the
  outpost that visibly dims with damage.

## 11. UI/HUD sketch

- **Main viewport**: the lane, pads, towers, enemies in flight, outpost core.
- **Top HUD**: credits, Core Integrity bar, wave number/progress, score.
- **Bottom shop bar**: the (unlocked) tower types with cost, selected state, and a
  locked/greyed state with an unlock hint for gated towers.
- **Tower panel**: appears on selecting a built tower — current tier/stats, upgrade
  cost/button, tier-3 branch choice when reached, sell button with refund amount.
- **Wave-cleared banner**: kills/credits summary, "Start Next Wave" action (auto-starts
  after a short delay if idle).
- **Start screen**: brief instructions/controls, Best Wave Reached and High Score if
  present.
- **Game-over / Victory screen**: final score, wave reached, new-best indicator,
  Restart action.

## 12. Technical notes

Module split, following the pattern established across the repo's other canvas games
(`gravity-well/`, `starwarden/`, `solar-ward/`):

- `IonPerimeter.tsx` — main component: canvas render loop, game state machine
  (`start | playing | paused | wave-cleared | game-over | victory`), pointer input for
  placement/selection, HUD overlay.
- `IonPerimeter.css` — HUD/shop-bar layout, `.ion-perimeter.fullscreen` page pattern
  (paired with the `:has()` fullscreen override in `App.css`), touch target sizing.
- `path.ts` — fixed lane waypoints + buildable pad positions, plus a
  distance-along-path → `{x, y, angle}` interpolation helper.
- `towers.ts` — tower type/tier/branch definitions.
- `enemies.ts` — enemy type definitions and per-type behavior flags.
- `waves.ts` — the 20-wave authored schedule, including boss markers.
- `projectiles.ts` — kinetic/flak projectile, laser beam, and ion chain update+draw.
- `explosions.ts` — particle-burst effects, modeled on `starwarden/explosions.ts`.
- `economy.ts` — credit awards, upgrade/sell cost curves, scoring.
- `progress.ts` — localStorage read/write for best wave, high score, unlocked towers.
- `audio.ts` — synthesized SFX, following `starwarden/audio.ts` / `gravity-well/audio.ts`.
- `rng.ts` — seeded PRNG (mulberry32), duplicated per the repo's established
  per-project convention (used for swarm-spawn jitter and cosmetic variation, not for
  the wave schedule itself, which is hand-authored).

## 13. Open questions resolved during design

These were open in earlier drafts of this concept and were settled before build:

- **Endless post-campaign mode?** No — finite 20-wave victory, chosen to keep v1 tight
  and finishable.
- **Maze-building vs. fixed pads?** Fixed, hand-placed pads — faster to build and
  balance than a free maze, and keeps the skill focused on tower/upgrade choice.
- **Meta-progression depth?** Shallow and specific: two persistent unlock gates
  (Railgun, Ion Disruptor's Chain Reactor branch) plus best-wave/high-score tracking,
  not a broader currency-between-runs economy.
