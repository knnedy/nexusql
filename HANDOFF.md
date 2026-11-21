# HANDOFF

Working log for the staged refactor on `refactor/architecture`. Updated with every commit.

## Current stage

Stage 2: reliability, correctness, security (approved). Plan: 17 steps A–F; decisions:
`-expose` + access token; read-only toggle enforced by the DB. Test seams confirmed:
db.Provider suite, studio.Service, HTTP API (httptest), pure Go modules.

## Done

- docs(adr): ADRs 0001-0006 recording the target layout, layering, exporter
  registry, embedded UI package and web feature split. HANDOFF.md created.
- chore(build): go.mod tidied (direct deps no longer `// indirect`); docs say
  Go 1.26+ and Node 20.9+.
- refactor(ui): frontend embed moved to `internal/ui` (`ui.Handler()`), with a committed
  `dist/.gitkeep`, so `go build ./...` works on a fresh clone; it serves a 503
  "frontend not built" page when no UI is embedded. The goreleaser `dist/` ignore is now
  root-anchored (it was hiding `internal/ui/dist`).
- chore(web): `pnpm typecheck` script (`tsc --noEmit`).
- chore(build): Makefile split: `go-build` is Go-only; new `test`, `vet`, `web-check`,
  `check`. Goreleaser calls `make web-build`; goreleaser pinned `~> v2`; pnpm pinned
  via `packageManager` (12.18.0).
- ci: PR/main workflow: gofmt, vet, test, Go-only build; pnpm typecheck, lint, build.
- chore(deps): Go modules bumped (lipgloss 2.1.1, gofakeit 7.18.10, chi 5.5.0, mysql
  1.10.2, pgx 5.13.0, modernc sqlite 1.62.0). SQLite API smoke test passed.
- ci: Actions moved to Node 24 majors (checkout/setup-go/setup-node v7,
  goreleaser-action v7, pnpm/action-setup v6); force-Node24 env removed.
- chore(deps): web minor/patch: next + eslint-config-next 16.4.6, react 19.3.1, TanStack
  Query 5.108, tailwind 4.3.5, zustand 5.1, shiki 4.6, lucide 1.77, react-icons 5.7.
  html-to-image kept at exact 1.11.11.
- chore(deps): elkjs 0.12.1; canvas layout options verified on a sample FK graph.
- chore(deps): @types/node ^22 to match the CI Node version.
- refactor(seed): seeding moved from `internal/db` to `internal/seed` (`seed.Run`,
  `seed.Options`, `seed.Result`); `db.SeedTx` stays in db. SQLite seed smoke test passed.
- refactor(db): `db.Exporter` registry (`RegisterExporter`/`ExporterFor`); each dialect
  registers in init(). `internal/api` imports no dialect package. Export output verified
  byte-identical to the previous commit on SQLite.
- refactor(server): `internal/server` builds the router/http.Server (`server.New`) and
  runs it with graceful shutdown (`server.Run`). main.go is flags + wiring only.
  `/api/health` reports the ldflags `Version` ("dev" locally) instead of "0.1.0".
- refactor(api): response helpers moved to `api/respond.go`; `h.activeConn(w)` replaces
  7 copies of the session lookup; all bodies decoded via `readJSON`. 401 path verified.
- refactor(studio): `internal/studio.Service` sits between api and db (ADR 0003). It owns
  the session and projects, sort-column validation and connect bookkeeping; errors carry
  a class (`ErrNoConnection/ErrInvalid/ErrNotFound/ErrConflict`) mapped once in
  `api.writeServiceError`. A 45-request battery matched the previous binary except one
  intended change: malformed body + no connection now returns 400 (was 401).
- refactor(web): `src/shared/` created: api client + query keys (`shared/api`), types,
  utils, `use-schema`/`use-debounced-value`, top-nav/provider-badge/theme-toggle.
  `app/icon.png` stays in app (Next metadata convention) and is imported as `@/app/icon.png`.
- refactor(web): component folders renamed to `_components`, except shared UI which moved
  from `shared/components` up to `src/components` (user decision). ADR 0006 updated.
- refactor(web): sessionStorage keys live only in `shared/lib/session-storage.ts`
  (`studioSession`); call-site fallbacks unchanged.
- refactor(web): `use-table-rows`/`use-row-lookup` moved to `shared/hooks`: console, seed
  and disconnect invalidate their caches, so they are shared data access, not Explorer
  internals (lint rule `prefer-query-options` requires keys from the factories).
- refactor(web): `features/console` (SQL console modal + use-run-query), `features/seed`
  (seed modal + use-seed), `features/export` (export preview drawer).
- refactor(web): `features/studio` (mode switcher, disconnect button, use-disconnect);
  studio store to `shared/store`, `use-projects` to `shared/hooks` (cross-feature).
- refactor(web): `features/canvas` (canvas-studio, components, canvas-utils, types);
  `app/studio/canvas/page.tsx` is a thin wrapper. Every feature has an `index.ts` entry
  point and cross-feature imports go through it (ADR 0006 amended).
- refactor(web): `features/explorer` (explorer-studio, grid/toolbar/table-list,
  use-update-row); `exportToCsv` split out of shared utils into `explorer/lib/csv.ts`.
- refactor(web): `features/connect` (connect-view, recent-projects, use-connect) and
  `features/projects` (projects-view). All routes are thin wrappers; `src/hooks` and
  `src/lib` are gone. `app/page.tsx` stays "use client" (connect entry exports a hook).
- docs: CONTRIBUTING project structure rewritten for the new layout; README lists the
  new make targets; preview images moved to `docs/assets/` (README + goreleaser updated).

### Stage 2

- test(db): `internal/db/dbtest` conformance suite (introspection, rows, lookup, update,
  query, seed, export) run on SQLite; `studio.Service` tests on real SQLite (no mocks).
  Mutation check: breaking DESC sort fails the suite.
- test(db): same suite on Postgres 17 and MySQL 8.4 via testcontainers-go
  (`//go:build integration`, `make test-integration`, CI `integration` job). All pass;
  warm run ~20s. One container per package, fresh database per test.
- test(web): vitest 5 + jsdom; tests colocated as `*.test.ts`. Covers studioSession,
  normalizeFieldType, formatRelativeTime, exportToCsv (27 tests). `pnpm test` runs in
  `make web-check` and CI. Web seams confirmed: pure modules, hooks + query cache,
  components (Testing Library), e2e (Playwright, lands with step 13).
- fix(server): loopback by default; non-loopback `-host` refused without `-expose`;
  exposed mode requires a per-run token (`?token=` → HttpOnly cookie, cookie, or Bearer).
  Host allowlist blocks DNS rebinding; Origin check blocks cross-site writes. ADR 0007.
  README usage block was stale (claimed default 0.0.0.0:8080); now the real `-h` output.
- fix(projects): API never returns connection URIs; projects carry a server-redacted
  `displayUri` (`db.RedactURI`). Saved projects reconnect with `{"projectId"}`
  (`studio.OpenProject`, also touches lastOpenedAt). Connect errors are redacted at the
  source plus a studio scrub. JSON bodies capped at 1 MiB (413). Credentials remain
  plaintext at rest in ~/.nexusql/projects.json (0600) until Stage 4.
- test(db): container setup shared as `dbtest.PostgresDB(t)` / `dbtest.MySQLDB(t)`
  (integration tag; one lazily started container per binary, reaped on exit), so
  studio can run on real Postgres/MySQL too.
- fix(studio): providers take resolved `db.Table`/`db.Field` (`db.RowsRequest`); studio
  resolves every client name against a per-connection schema cache (ADR 0008). Fixes the
  Postgres `%q` table quoting and all hardcoded `"public"`; that hardcode made MySQL
  sorting, seeding and the schema view see zero tables. Studio scenario now runs on all
  three dialects (`TestSQLite`, integration `TestPostgres`/`TestMySQL`).

## Next 3 steps

1. fix(db): composite-key updates, explicit NULL, PK-less tables read-only; MySQL
   UpdateRow reports "no row found" when the value is unchanged (driver counts changed
   rows, not matched; high confidence): use clientFoundRows or a match check.
2. fix(db): value fidelity (bigint/numeric as strings, JSON, timestamps, bytea).
3. fix(db): introspection (SQLite INTEGER PK, Postgres composite FKs, relation column pairs).

## Half-done files

None.

## Planned dependency updates (after CI step)

- Go: minor/patch only (lipgloss, gofakeit, chi, mysql, pgx, modernc sqlite).
- Web: minor/patch incl. next + eslint-config-next 16.4.6 together; elkjs 0.12 alone;
  @types/node pinned to ^22 (CI Node), not 26.
- html-to-image stays exact 1.11.11: 1.11.12+ regressed image export with React Flow.
- Decided 2026-11-21: adopt @tanstack/react-table 9, @xyflow/react 13,
  react-flow-smart-edge 5 and eslint 10, but only where they fit our code. TypeScript 7
  is NOT adopted; stay on TypeScript 5.
  - Timing: each major lands with the work on the surface it touches. react-table 9 goes
    with the Stage 3 Explorer grid; xyflow 13 + smart-edge 5 go together with Stage 3
    Canvas (smart-edge peers on xyflow); eslint 10 is a tooling step once
    eslint-config-next supports it.
  - Gate: check changelogs and peer ranges first, then one major per commit with a smoke
    test of the affected surface. If a major conflicts with our code (breaking API we
    rely on, peer mismatch, regression like html-to-image 1.11.12+), don't force it:
    stay on the current major and record why here.


## Stage 2 backlog (found during Stage 1, not yet fixed)

- `sqlite://` can open any file path (acceptable locally; revisit with -expose).
- Destructive-query detection is first-keyword only; LIMIT detection/appending is regex-based.
- `UpdateRow` cannot set NULL; single-column PKs only.
- Connect has no timeout (bodies now capped; URIs redacted in errors).
- SQLite introspection reports `INTEGER PRIMARY KEY` as nullable with default "AUTOINCREMENT".
- Active DB connection is not closed on server shutdown (pool lifecycle).
- `use-disconnect` removes `QUERY_KEYS.lookup`/`.export` (`["lookup"]`), but cache keys
  are `[["lookup"], ...]`, so the prefix never matches: lookup/export caches survive
  disconnect (high confidence).
- CSV export: header cells not escaped; no formula-injection guard (`=`,`+`,`-`,`@`).
- React Query keys not scoped by project/connection.
