# Family Projects

A small React + Vite + TypeScript web app that hosts a growing collection of
mini projects/games. Each project lives under `src/projects/<slug>/` and is
registered in `src/projects.ts` for the home page grid and in `src/App.tsx`
for routing.

## Projects

- **Letter Ladder** (`/letter-ladder`) — classic word-ladder puzzle: get from
  the start word to the end word, changing one letter at a time, with every
  intermediate step a real word.
- **Scrapyard Ballistics** (`/scrapyard-ballistics`) — build a rocket from junk
  on a blueprint grid, wire its staging, and fly it by hand through Max-Q and
  flaky hardware toward orbit. Uses Matter.js for the rig's internal physics.
- **Feline Ballistics** (`/feline-ballistics`) — a 3 AM physics puzzler: fling
  soft-body "liquid" cats (Tabby, Maine Coon, Siamese, Calico) to knock precious
  things off shelves across 20 levels in 4 rooms. Matter.js soft bodies.

## Development

```bash
npm install
npm run dev      # start dev server
npm run build    # type-check + production build
```
