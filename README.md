# Family Projects

A small React + Vite + TypeScript web app that hosts a growing collection of
mini projects/games. Each project lives under `src/projects/<slug>/` and is
registered in `src/projects.ts` for the home page grid and in `src/App.tsx`
for routing. Larger games keep their design doc in a `SPEC.md` next to the code.

## Projects

### Word games

- **Letter Ladder** (`/letter-ladder`): the classic word-ladder puzzle. Get
  from the start word to the end word by changing one letter at a time, and
  every step in between has to be a real word.
- **Trigaword** (`/trigaword`): fill in a letter pyramid where every row is a
  word, growing from 2 letters up to 8.
- **Sentence Spin** (`/sentence-spin`): spin a wheel for a letter, then write a
  sentence of 7 or more words that fits a theme (Animals and others). Any real
  word counts, and each theme offers "Need ideas?" word lists for the letter
  you spun.

### Learning and trivia

- **Flashigana** (`/flashigana`): hiragana flashcards. Pick the right romaji
  reading for each character, or spell basic Japanese words from a list of 500
  in Words mode.
- **LexiCon** (`/lexicon`): multiple-choice trivia from a bank of about 200
  questions covering word origins and phobias, science, history, geography,
  arts and pop culture, and math. Pick a round length and see how many you get
  right.

### Logic puzzles

- **Rainglow** (`/rainglow`): mix red, yellow and blue lenses to match a target
  color. There are 10 levels, and level N takes exactly N lenses.
- **Xenofuse** (`/xenofuse`): defuse a captured alien bomb. Decipher its
  glyphs, number system and sequences panel by panel before a shared countdown
  runs out.

### Space arcade

- **Gravity Well** (`/gravity-well`): aim and launch your rocket home to Earth,
  bending its path around asteroids, planets and stars. Levels are generated
  for each playthrough and get harder by tier, adding moving bodies and
  tractor-beam aliens.
- **Starwarden** (`/starwarden`): a Defender-style side-scrolling shooter in a
  looping warzone. Blast endless waves of aliens and last as long as your fuel
  and power crystals hold out.
- **Solar Ward** (`/solar-ward`): Missile Command meets Galaga. Swing an
  orbiting turret around a dying star to intercept photon beams and diving
  fighters before they hit the core's five sectors.
- **Ion Perimeter** (`/ion-perimeter`): space tower defense. Build and upgrade
  weapon platforms along an enemy lane to protect your outpost core through 20
  waves and two dreadnought bosses.

### Physics sandboxes

- **Scrapyard Ballistics** (`/scrapyard-ballistics`): build a rocket from junk
  (lawn mower engines, soda kegs, fireworks) on a blueprint grid, wire its
  staging by hand, and fly it through Max-Q and flaky hardware toward orbit.
  Parts that survive the landing are salvaged for the next run. Uses Matter.js
  for the rocket's internal physics.
- **Feline Ballistics** (`/feline-ballistics`): a 3 AM physics puzzler. Fling
  soft-body "liquid" cats (Tabby, Maine Coon, Siamese, Calico) to knock
  precious things off shelves across 20 levels in 4 rooms. Uses Matter.js
  soft bodies.

## Development

```bash
npm install
npm run dev      # start dev server
npm run build    # type-check + production build
```
