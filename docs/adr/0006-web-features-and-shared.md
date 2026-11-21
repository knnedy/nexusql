# 6. Frontend organised by feature, with a shared layer

Date: 2026-11-21

## Status

Accepted

## Context

Feature components live inside Next.js route folders (`app/studio/canvas/components`).
Shared code is split between `src/hooks` and `src/lib`. Cross-feature pieces such as
the SQL console sit under one mode, and sessionStorage keys are spread across six
files.

## Decision

```
web/src/
  app/         routes, layouts, global CSS only; pages compose features
               route-local UI goes in _components/ (Next private folders)
  components/  shared, feature-agnostic UI (the only plain "components" folder)
  features/    connect, projects, studio, canvas, explorer, console, seed, export
               each with _components/, hooks/, lib/ as needed
  shared/      api/ (client, query keys), types/, store/ (cross-mode Zustand state),
               hooks/ (data access whose cache several features read or invalidate),
               lib/ (utils, session-storage)
  providers/   app-wide React providers
```

Import rules:
- `app` may import `features`, `components`, `shared` and `providers`.
- Each feature exposes a public entry point, `features/<name>/index.ts`. Other features
  and `app` import only `@/features/<name>`; deep paths are private to the feature.
  Composition (Canvas hosting the console, seed and export UIs) goes through these.
- If two features need the same data access or state, it moves to `shared`.
- `shared` and `components` never import `features` or `app`. Exception: static
  assets that Next.js file conventions pin to `app/` (e.g. `app/icon.png`).
- Component folders are named `_components` everywhere except `src/components`.
- Use the `@/` alias for cross-folder imports; relative imports only within a folder.

## Consequences

- Each feature can be read, tested and restyled on its own.
- The SQL console, seed and export become reusable from both Canvas and Explorer.
- Moves happen one feature per commit, with typecheck, lint and build green after each.
