# Drnec Family A.I. Projects

## Versioning

The site has a version number (`major.minor.patch`), shown at the top right of the homepage. Its
single source of truth is `"version"` in `package.json`; `vite.config.ts` injects it as
`__APP_VERSION__`.

**Every change to the repo bumps the version** — once per task/request, not once per file edit.
Bump it with:

```
npm version <patch|minor|major> --no-git-tag-version
```

(this updates both `package.json` and `package-lock.json`; never edit only one of them).

Choose the bump level using these defaults, and say which one you picked and why when reporting
the change:

- **patch** — bug fixes, balance/tuning, visual polish, copy changes, refactors, docs, config, and
  improvements to an existing game or tool.
- **minor** — a new game/project added to the site, or a substantial new feature set that changes
  how an existing game plays (e.g. new modes, a new progression system).
- **major** — only when the user explicitly asks for one (e.g. a site-wide redesign).

**Plans don't bump the version.** Saving or editing a plan document (e.g. an
`IMPROVEMENT-PLAN.md` for later work) is not a change to the site; the bump happens when the plan
is implemented.

If a change doesn't clearly fit one of these, ask the user before bumping.

## Git: never commit or push

Never run `git commit` or `git push` (or anything else that creates commits or updates a remote,
such as `git merge`, `git rebase`, `git tag` or `gh pr create`), even when it looks like the obvious
next step. The user commits and pushes everything themselves. Leave changes in the working tree.

When reporting a change, list any **new files** the change added, since they need a `git add`
before committing. A missed new file once broke the Vercel build.

## Checks before reporting a change

Run `npm run lint`, `npm test` and `npm run build`; for anything that touches a page's layout,
rendering or startup, also run `npm run test:e2e` (it opens every page on a desktop and a phone
profile). CI runs all of these on every push.

## New game checklist

Every new game (and every major rework of one) should tick all of these:

1. **Register it once** in `src/projects.ts`: slug, title, description, category, icon, accent,
   `component: lazyGame(() => import(...))`, plus `fullscreen: true` for canvas games that should
   fill the viewport, and `headerLogo` if it has one. Nothing else needs editing to add a route;
   the homepage, routes, layout and smoke tests read from that list. Newest goes last (it becomes
   the homepage's featured card).
2. **Use `src/shared/` instead of copying code**: `rng.ts` (seeded RNG), `useCanvasLoop.ts`
   (fill-the-parent canvas) or `hiDpiCanvas.ts` (fixed logical-size canvas), `audio.ts`
   (`getAudioContext()` + `createChannel()` for sound, `useMuted()` for the mute button),
   `storage.ts` (`createStore()` for saves), `usePauseOnHide.ts`, `motion.ts`,
   `familySafe.ts`, and `shared/ui/` (banner, win banner, results card, confetti).
3. **Phones and tablets**: playable by touch, not only keyboard; check it at phone width.
4. **Sharp canvas**: use `useCanvasLoop` or `useHiDpiCanvas` + `scaledContext`, never a bare
   fixed-size canvas stretched by CSS.
5. **Pause when hidden**: real-time games pause (with a visible pause screen) when the player
   leaves, via `usePauseOnHide`, and offer a pause button and key.
6. **Saves and bests** go through `createStore()` (per profile, versioned), with a `summary` so
   the homepage tile shows progress.
7. **Family-safe**: any word list goes through `isFamilySafe`; no gore or adult content.
8. **Reduced motion**: skip or soften screen shake and full-screen flashes when
   `prefersReducedMotion()` / `useReducedMotion()` is true.
9. **Tests**: put unit tests next to the logic (`*.test.ts`), especially level solvability.
10. **Docs**: add it to the README's game list, and keep the `Status:` line in its `SPEC.md`
    current.
