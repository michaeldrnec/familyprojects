# Family Projects

A React + Vite + TypeScript web app that hosts a growing collection of family games. Each game
lives under `src/projects/<slug>/` and is registered once, in `src/projects.ts`: the homepage,
the routes, the full-screen layout and the header all read from that list. Larger games keep their
design doc in a `SPEC.md` next to the code.

The site works offline once visited (it installs as an app on phones and tablets), and several
players can share one device: the header's player picker keeps each person's saves and best
scores separate.

## Games

Grouped the way the homepage's filter groups them.

### Words & Learning

- **Letter Ladder** (`/letter-ladder`): the classic word-ladder puzzle. Get from the start word to
  the end word by changing one letter at a time, and every step in between has to be a real word.
- **Trigaword** (`/trigaword`): fill in a letter pyramid where every row is a word, growing from
  2 letters up to 8.
- **Sentence Spin** (`/sentence-spin`): spin a wheel for a letter, then write a sentence of 7 or
  more words that fits a theme. Any real word counts, and each theme offers "Need ideas?" word
  lists for the letter you spun.
- **Flashigana** (`/flashigana`): hiragana flashcards. Pick the right romaji reading for each
  character, or spell basic Japanese words from a list of 500 in Words mode.
- **LexiCon** (`/lexicon`): multiple-choice trivia from a bank of about 200 questions covering
  word origins and phobias, science, history, geography, arts and pop culture, and math.

### Puzzles

- **Rainglow** (`/rainglow`): mix red, yellow and blue lenses to match a target color. There are
  10 levels, and level N takes exactly N lenses.
- **Xenofuse** (`/xenofuse`): defuse a captured alien bomb. Decipher its glyphs, number system and
  sequences panel by panel before a shared countdown runs out.
- **Lux Tenebris** (`/lux-tenebris`): every step dims your flashlight. Memorize each of 20 caves
  while it's lit, then cross the dark from memory before the air runs out.
- **Orbital Siege** (`/orbital-siege`): program an orbital platform's strike timeline to crack
  robot fortresses layer by layer, across 24 deterministic levels plus a daily puzzle.

### Space Arcade

- **Gravity Well** (`/gravity-well`): aim and launch your rocket home to Earth, bending its path
  around asteroids, planets and stars. The preview only shows the start of each shot, you get five
  launches per layout and one mid-flight boost per launch, and stardust along a daring route earns
  up to three stars a level. Levels are generated for each playthrough and get harder across 30
  tiers; the run is saved.
- **Starwarden** (`/starwarden`): a Defender-style side-scrolling shooter in a looping warzone.
  Last as long as your fuel and power crystals hold out.
- **Solar Ward** (`/solar-ward`): Missile Command meets Galaga. Swing an orbiting turret around a
  dying star to intercept photon beams and diving fighters before they hit the core.
- **Ion Perimeter** (`/ion-perimeter`): space tower defense. Build and upgrade weapon platforms
  along an enemy lane to protect your outpost core through 20 waves and two dreadnought bosses.
- **Invader Protocol** (`/invader-protocol`): break a marching alien lattice on the beat, with
  four weapons that run hot, ventable bunkers, and a tempo that climbs as the invaders fall.

### Physics Mayhem

- **Scrapyard Ballistics** (`/scrapyard-ballistics`): build a rocket from junk on a blueprint grid,
  wire its staging by hand, and fly it through Max-Q and flaky hardware toward orbit. Uses
  Matter.js.
- **Feline Ballistics** (`/feline-ballistics`): a 3 AM physics puzzler. Fling soft-body cats to
  knock precious things off shelves across 20 levels in 4 rooms. Uses Matter.js.

## Development

```bash
npm install
npm run dev          # start the dev server
npm run build        # type-check + production build
npm run lint         # oxlint; fails on any warning
npm test             # unit tests (Vitest): game logic, level solvers, shared helpers
npm run test:e2e     # build, then open every page in a browser (Playwright)
npm run lint:unused  # advisory: unused exports and files (Knip)
```

The first `npm run test:e2e` on a machine needs a browser: `npx playwright install chromium`.

GitHub Actions runs lint, build, unit tests and the browser smoke tests on every push and pull
request (`.github/workflows/ci.yml`).

## Layout

- `src/projects.ts`: the game registry (one entry per game).
- `src/projects/<slug>/`: each game's code, styles and `SPEC.md`.
- `src/shared/`: code every game can use instead of copying it: seeded RNG, canvas helpers,
  site-wide audio and mute, per-profile versioned saves, auto-pause, reduced-motion detection, the
  family-safe word filter, and shared UI pieces (`shared/ui/`).
- `src/site/`: site chrome (profile menu, loading screen, 404, error screen).
- `src/service-worker.js`: offline support; the build turns it into `/sw.js` with the list of
  every built file.

## Hosting

The site is deployed on Vercel. Because it uses client-side routing, every path has to serve
`index.html`; `vercel.json` sets that up, keeps `/sw.js` uncached so updates reach players, and
marks the hashed files under `/assets/` as cacheable forever.
