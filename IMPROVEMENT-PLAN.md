# Family Projects: site-wide improvement plan

Status: **Tiers 1–3 and 5 done (site v1.5.0, 2026-10-15); Tier 4 not started.** This plan comes
from a critical review of the whole repo at site v1.4.0. Tier 4 (game-by-game changes) is waiting
for a review before any of it is built. When the plan is done, delete this file.

Notes from implementing Tiers 1–3 and 5:
- Item 18: Gravity Well and Feline Ballistics were left without auto-pause on purpose. Nothing in
  them runs against the clock (a shot plays out on its own once launched), so there's nothing to
  lose by leaving.
- Item 24: `react/exhaustive-deps` and `no-unused-vars` turned out to be on already (as oxlint
  defaults); they're now explicit errors, and `npm run lint` fails on any warning. oxlint can't
  find unused exports, so that's `npm run lint:unused` (Knip), advisory only: it currently lists 7
  unused game exports (a cleanup candidate when those games get their Tier 4 pass).
- Item 12 found and fixed a feedback loop: a CSS-auto-sized canvas whose backing size followed its
  on-screen size kept resizing (and clearing) itself every frame on 2x screens. The smoke tests
  now run the desktop profile at 2x and check that every canvas holds its size.

At review time, lint passed, the build passed, and the TypeScript build also passed with
`--strict` turned on (0 errors). The newer games (Orbital Siege, Invader Protocol, Feline
Ballistics) are clean and well split up. Most problems are in the older games and in the site as
a whole: it grew one game at a time, and nothing ties the games together.

## Suggested order

1. Tier 1, all of it (about one session).
2. Items 9–13, so later work builds on the shared folder.
3. Items 21–22, so later changes have tests behind them.
4. Trigaword's rejected answers and word list (item 19 and Tier 4), and touch controls for Solar
   Ward.
5. Profiles and progress on the homepage (items 14–15), then the game-by-game polish.

Version bumps follow `CLAUDE.md`:
- Tiers 1, 2, 4 and 5 are **patch** bumps.
- Profiles and offline play (items 14 and 17) are **minor** bumps.
- This plan itself doesn't bump the version.

---

## Tier 1: Quick wins (low effort, high payoff)

- [x] **1. Delete the committed merge leftovers.**
  - These are in git: `package-lock_BACKUP_2884.json`, `package-lock_BASE_2884.json`,
    `package-lock_LOCAL_2884.json`, `package-lock_REMOTE_2884.json`.
  - Add these patterns to `.gitignore`: `*_BACKUP_*`, `*_BASE_*`, `*_LOCAL_*`, `*_REMOTE_*`,
    `*.orig`.
- [x] **2. Shrink the images.** `public/` holds about 33 MB of PNG/JPEG.
  - `drnec_project_icon.jpeg` is 2.8 MB but is shown at 32 px tall on every game page.
  - The word-game banners are 3.3–5.4 MB each.
  - Convert them to WebP or AVIF at the size they're actually shown, under about 150 KB each.
- [x] **3. Remove unused assets.** `drnec_projects_logo_old.png` (4.2 MB) and `icons.svg` aren't
  referenced anywhere.
- [x] **4. Turn on `"strict": true` in `tsconfig.app.json`.** It costs nothing today (0 errors)
  and stops type problems from creeping in later.
- [x] **5. Lazy-load every game route.**
  - Today 12 of the 16 games are loaded up front, so the main bundle is 652 KB. Someone opening
    the homepage downloads every arcade game.
  - Load them all with `lazy()` and wrap one `<Suspense>` around the `<Outlet>`.
  - Replace the plain `<p>Loading…</p>` with a nicer loading screen.
- [x] **6. Bring the README up to date.**
  - It's missing Lux Tenebris, Invader Protocol and Orbital Siege.
  - Its five categories don't match the four in `src/projects.ts`.
- [x] **7. Fix the stale SPEC status lines.** Xenofuse, Starwarden and Solar Ward still say
  "draft spec — not yet built", but all three are built.
- [x] **8. Add a 404 route and page titles.**
  - An unknown URL currently shows a blank page.
  - Set `document.title` for each game.

## Tier 2: Site structure

- [x] **9. Keep each game's details in one place.**
  - Adding a game currently means editing all of these:
    - `src/projects.ts`
    - `src/App.tsx` (import and route)
    - the `:has()` list in `src/App.css`
    - sometimes `src/Layout.tsx` (header logo)
    - the README
  - Instead, give each entry in `projects.ts` its lazy component, a `fullscreen` flag and an
    optional `headerLogo`.
  - Have the routes, the layout and the fullscreen CSS read from that list.
- [x] **10. Replace the hard-coded header height.** The fullscreen layout uses
  `calc(100svh - 65px)`, which breaks if the header's height changes. Use flex layout or a CSS
  variable instead.
- [x] **11. Create a shared `src/shared/` folder.** A lot of code is copied between games:
  - **`rng.ts`:** 9 copies, all slightly different.
  - **`useCanvas.ts`:** 3 identical copies (Feline Ballistics, Orbital Siege, Scrapyard
    Ballistics).
  - **`audio.ts`:** 9 copies. Each one creates its own `AudioContext` and never closes it, so a
    long session leaves up to 9 open. Browsers limit how many are allowed. One shared context
    should serve every game.
  - **Save/load code:** 7 copies of the same `localStorage` pattern. Replace them with one
    storage helper that has a schema version, a migration step and safe parsing.
  - **Repeated UI:** the same `.sr-only`, banner, results card and "win" banner styles appear in
    every word game. `Confetti` is only used by LexiCon. Make these shared components.
- [x] **12. Make one shared canvas hook that handles screen sharpness and resizing.**
  - Gravity Well, Starwarden, Solar Ward, Ion Perimeter and Lux Tenebris draw a fixed-size canvas
    and stretch it with CSS.
  - They look blurry on high-resolution phones and tablets, and when fullscreen.
- [x] **13. Use one shared mute setting that's remembered.** Today each game has its own mute
  toggle, and only some of them save it.

## Tier 3: Features that suit a family site

- [x] **14. Player profiles.**
  - All saves use fixed `localStorage` keys, so two kids on the same tablet overwrite each
    other's progress.
  - Add a simple "Who's playing?" picker at the top of the site, and store saves per profile.
  - *(Minor bump.)*
- [x] **15. Show progress on the homepage tiles.**
  - Show stars, levels cleared or best score from each game's save.
  - Add a "Continue" row for recently played games.
- [x] **16. Add a category filter and a "recently played" view to the homepage.** With 16 games,
  the bento grid is getting hard to scan.
- [x] **17. Install the site as an app with offline play.**
  - Add a web app manifest and a service worker.
  - This lets the site be added to a home screen and played offline, for example on car trips.
    None of the games need a server.
  - *(Minor bump.)*
- [x] **18. Pause games automatically when the tab is hidden.** Only Invader Protocol does this
  today. Every real-time game should pause when the tab or app loses focus.
- [x] **19. Use one shared family-safe word filter.**
  - Letter Ladder's denylist misses words: CRAP, PISS and HELL are still in its list.
  - Trigaword has no filter at all. It includes FETISH, SEXUAL, NAKED and CASINO, and can pick
    them for a puzzle.
  - Write one filter and apply it to every word list.
- [x] **20. Respect the "reduce motion" setting** (`prefers-reduced-motion`): screen shake,
  confetti, flashes. Only Feline Ballistics and Lux Tenebris check it today.

## Tier 4: Game-by-game

### Trigaword

- [ ] **Correct answers can be rejected.**
  - `check()` compares each tile to one hidden target word, but tiles come from a pool shared by
    all rows.
  - A player who builds a different valid word (an anagram, or a letter swapped with another
    row) is marked wrong.
  - Fix: accept any dictionary word built from the pool.
- [ ] **Clean up the word list.** It's unfiltered web-crawl data and includes:
  - names and places: DEREK, DIANA, DETROIT, JOHN, PARIS
  - brands: YAHOO
  - abbreviations: FAQ, USA, DIR
  - junk: DEUTSCHE, DEVEL

  It needs the same cleanup Letter Ladder got, plus the filter from item 19.
- [ ] **Add letter typing from the keyboard**, and an optional hint or clue for each row.

### Letter Ladder

- [ ] **Pick puzzles from common words.** Start and end words come from ENABLE, the full
  Scrabble-style word list, so a puzzle can start or end on words like AAL, CWM or AIS. Use a
  common-word list to pick start and end words, and keep ENABLE for checking the player's steps.
- [ ] **Show "par" after a win:** the shortest possible ladder next to the player's step count.
- [ ] **Add a daily puzzle.**
- [ ] **Small code fixes.**
  - Rename `useHint`. Its `use…` name makes the hooks lint rule treat it as a React hook, though
    it isn't one.
  - Simplify the odd `useMemo`-wrapped `undo`.

### Sentence Spin

- [ ] **Shrink the dictionary download.**
  - The 370k-word dictionary is a 4.6 MB TypeScript array that becomes a 1.1 MB gzipped chunk.
  - Ship it as a compressed newline-separated text file and `fetch` it instead. That's smaller,
    and faster to parse than a JS array.
- [ ] **Clean the dictionary.** It accepts names and abbreviations (AARON, ABBY, ABBR, ABC). Swap
  it for a cleaner list, or filter it.

### Flashigana

- [ ] **Remember accuracy for each kana**, and show the missed ones more often (spaced
  repetition).
- [ ] **Add more character sets:** dakuten/handakuten, combination kana and katakana. Today it
  only has the basic 46 hiragana.
- [ ] **Add pronunciation** using the browser's built-in `ja-JP` speech voice
  (`speechSynthesis`).

### LexiCon

- [ ] **Fact-check the questions.**
  - The "Gammacism" question is wrong. Gammacism is trouble with hard g/k sounds, not soft G.
  - Some questions have more than one defensible answer, such as Aquaphobia vs Hydrophobia and
    Aviophobia vs Aerophobia.
- [ ] **Tag questions by category and difficulty**, so players can pick a topic or a kid-level
  round.
- [ ] **Show a one-line explanation after each answer.**
- [ ] **Avoid repeating questions across rounds** by remembering which ones were already seen.

### Rainglow

- [ ] **Add more to play.** With only 10 fixed levels, it's finished in a few minutes. Add
  generated levels or an endless mode, a par or move counter, and saved progress.

### Xenofuse, Gravity Well, Solar Ward

- [ ] **Save best scores and progress.** None of them keep anything between visits.
- [ ] **Add touch controls to Solar Ward.** It can only be played with a keyboard (no touch or
  pointer controls), so it can't be played on a phone or tablet.

### Starwarden, Ion Perimeter, Gravity Well, Solar Ward

- [ ] **Split up the huge components.**
  - Each is one big file: Starwarden 1,619 lines, Ion Perimeter 1,298, Gravity Well 883, Solar
    Ward 723.
  - Split the simulation from the drawing code, the way Invader Protocol and Orbital Siege
    already do. That makes changes, AI-assisted ones included, safer and cheaper.

### Lux Tenebris

- [ ] **Do the existing plan first.** `src/projects/lux-tenebris/IMPROVEMENT-PLAN.md` is detailed
  and hasn't been started. Finish it before planning anything new for this game.

## Tier 5: Quality and process

- [x] **21. Add Vitest tests for the pure game logic.**
  - Good first targets: the word graph and BFS, Rainglow's color mixing, and Trigaword
    validation.
  - Turn the existing checks into tests:
    - Orbital Siege's `selfcheck.ts`, which only runs in DEV and sends errors to the console.
    - The recorded solutions in Feline Ballistics' `solutions.ts`.
    - The Lux Tenebris solver.
- [x] **22. Add a GitHub Actions workflow** that runs lint, type-check, tests and build on every
  push. There's no CI today.
- [x] **23. Add a Playwright smoke test.** It opens every route and fails if a page renders blank
  or logs a console error. That's cheap protection against one broken game.
- [x] **24. Turn on more lint rules:** oxlint's `react-hooks/exhaustive-deps`, and the rules for
  unused imports and exports.
- [x] **25. Check the hosting setup.**
  - `BrowserRouter` needs the host to send every path to `index.html`, or deep links return a
    404.
  - There's no hosting config in the repo. If the host needs one, check it in.
- [x] **26. Add a "new game checklist" to `CLAUDE.md`.** New games are AI-built, so writing the
  rules down keeps the next one consistent. The checklist covers:
  - registering the game in one place (item 9)
  - lazy loading
  - using the shared folder
  - touch controls
  - pause when hidden
  - saved progress and best scores
  - sharp canvas on high-resolution screens
  - family-safe content
  - updating the README and the SPEC status line
