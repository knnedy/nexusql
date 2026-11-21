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
  features/    connect, projects, studio, canvas, explorer, console, seed, export
               each with components/, hooks/, lib/ as needed
  shared/      api/ (client, endpoints, query keys), types/, hooks/,
               components/, lib/ (utils, session-storage)
  providers/   app-wide React providers
```

Import rules:
- `app` may import `features`, `shared` and `providers`.
- A feature may import `shared`, never another feature's internals. If two features
  need something, it moves to `shared`.
- `shared` never imports `features` or `app`.
- Use the `@/` alias for cross-folder imports; relative imports only within a folder.

## Consequences

- Each feature can be read, tested and restyled on its own.
- The SQL console, seed and export become reusable from both Canvas and Explorer.
- Moves happen one feature per commit, with typecheck, lint and build green after each.
