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

If a change doesn't clearly fit one of these, ask the user before bumping.
