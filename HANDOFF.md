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
- fix(db): row edits name the full primary key (`PATCH /rows/{t}` body
  `{key:{col:val}, column, value: string|null}`); partial/extra keys and PK-less tables
  are 400, no matching row is 404, `null` writes NULL. Fixes composite-PK edits that
  updated every row sharing a key prefix. MySQL DSN adds `clientFoundRows=true`, so
  unchanged-value edits no longer fail and console UPDATE counts matched rows like
  PG/SQLite. Web sends the full key (`features/explorer/lib/row-key.ts`); Set NULL UI and
  read-only PK-less tables in the grid land with step 13.
- fix(db): cell values use one JSON form on every dialect (ADR 0009, `db/wire.go`):
  unsafe ints and decimals as strings, NaN/Inf as strings (NaN used to break the whole
  response), naive timestamps without `Z`, dates as dates, JSON as JSON, binary as `\x`
  hex. `Values` fixture per harness. MySQL session `time_zone` pinned to UTC.
- test(api): TestUpdateRowBody ranged over a map, so case order was random and the
  final NULL check flaked; cases are now ordered. (2f5efc3 was committed while it failed.)
- fix(db): edits are coerced per column type: `\x` hex to binary, true/false to the
  dialect's boolean, MySQL TIMESTAMP from RFC 3339 (it rejects `Z`). Conformance test:
  saving every cell with its shown text round-trips to the same JSON; SQLite also
  asserts storage classes (`Values.Stored`), which exposed hex saved as text.
- chore(web): `vitest.config.mts` (Vite warned that ESM in a .ts config will break).
- fix(db): introspection. `Field.AutoGenerated` replaces the fake "AUTOINCREMENT" /
  "AUTO_INCREMENT" defaults (SQLite: only a lone `INTEGER PRIMARY KEY` aliases the rowid,
  and it is NOT NULL; Postgres: serial or identity). `Relation.SourceFields/TargetFields`
  hold every column pair; composite FKs are now reported on all dialects (MySQL/SQLite
  skipped them, Postgres returned a cross product). Postgres key flags read pg_constraint
  by table, so same-named constraints no longer cross-flag columns. Seeder and exporters
  skip composite relations until steps 16/17. Export diff vs before: only the invalid
  Drizzle `.default(AUTOINCREMENT)` (SQLite) and `.default(nextval(...)` (Postgres) gone.
  Canvas DDL preview moved to `features/canvas/lib/ddl.ts` (composite PK/FK lines).
- fix(studio): `studio.Config` bounds every statement (`-query-timeout`, default 30s;
  504 `ErrTimeout`), console rows capped at 1000 with `truncated` (no more appended
  `LIMIT 500`; providers stop scanning and cancel, so Postgres/MySQL do not drain the
  rest), connect timeout 10s (Postgres dial now honours the deadline; pgxpool dials in
  the background), DB pool closed after `Shutdown` drains requests (`server.Server`;
  `RegisterOnShutdown` hooks are async and raced), HTTP write
  timeout = query timeout + 15s. Console shows "first N rows · more not shown".
- fix(console): `internal/sqlscan` lexes console SQL per dialect (`Provider.Syntax`) and
  classifies each statement (unknown = write); confirmation if any statement may write
  (`WITH ... DELETE`, `SELECT 1; DROP`, `PRAGMA x = y` now caught; `SHOW`/`PRAGMA`/`VALUES`
  return rows). `Provider.ExecuteScript` runs a run's statements on one connection and
  closes it unless the run was plain reads (ADR 0010): transactions span statements,
  unfinished ones roll back, settings/temp tables no longer leak into the pool. In-memory
  SQLite keeps its connection (ROLLBACK only). `db.IsDestructiveQuery`/`IsSelectQuery`
  removed. Console shows RETURNING rows and "last of N statements"; API query results
  always carry `columns`/`rows` arrays.
- feat(console): read-only switch per connection (ADR 0011; `GET`/`PUT
  /api/connection/read-only`, console toolbar toggle). Enforced by the database inside the
  run's session: Postgres `BEGIN READ ONLY` + snapshot + tx-status check before each
  statement (console statements now use the extended protocol: one statement per
  message); MySQL session-level `SET SESSION TRANSACTION READ ONLY` (transaction-level
  let DDL through, verified); SQLite `query_only`. Studio refuses statements naming
  READ WRITE/`*_read_only`/`query_only`; edits and seeding return 409. Not persisted.
- test(web): Testing Library (component seam; `src/test/setup.ts`) and Playwright e2e
  (`web/e2e`, `make e2e`, CI job) driving the built binary on a temp SQLite file with
  a throwaway HOME. New dev deps pinned to releases at least two weeks old (jest-dom
  7.0.1 not 8.0.0, user-event 14.6.8, Playwright 1.65.0). First run locally:
  `cd web && pnpm exec playwright install chromium`.
- fix(explorer): Set NULL button (nullable columns) and NULL in enum/boolean pickers
  (enum "null" used to send ''); NULL vs '' shown apart (`null` / `empty`); unchanged
  commits record nothing (JSON cells were always "changed" via `[object Object]`); a
  failed save keeps its edit with the server's message on the cell and "N failed" in the
  toolbar (was silent); saved values stay until the batch refetch lands (no flash back),
  one invalidation per batch incl. lookups; grid says why it is read-only (no primary
  key / read-only connection). Boolean picker, tabular numerals, pretty JSON tooltip.
  API client errors show the server's message, not the JSON envelope (connect page too).
  `useReadOnly` moved to `shared/hooks`. Component tests + 4 Playwright explorer flows.
- fix(web): every query read from the connection is keyed `["connection", projectId, …]`
  (`shared/api/query-keys.ts`: `queryKeys`, `forgetConnection`). Connect and disconnect
  drop the whole scope: before, disconnect missed lookups/exports/read-only (prefix
  `["lookup"]` never matched `[["lookup"], …]`) and connect kept everything, so another
  project could show the old one's rows and Prisma/Drizzle export. A console write now
  invalidates the whole scope (DDL left the canvas and exports stale). No `.slice()` key
  prefixes left; export query moved to `shared/hooks/use-export.ts`; `useReadOnly` no
  longer needs always-refetch.
- fix(explorer): one RFC 4180 CSV builder (`shared/lib/csv.ts`) for the explorer download
  and the console copy (the console's own copy wrote JSON as `[object Object]`). Headers
  and cells quoted on comma/quote/CR/LF; text starting `= + - @ TAB CR` gets a `'` prefix
  (OWASP), except plain numbers so `-5` and bigint strings survive. Download has a UTF-8
  BOM for Excel.
- fix(seed): inserts are parameterized and converted like cell edits (`db.SeedTx.Insert`;
  `db.SQLSeedTx` serves SQLite/MySQL, pgx for Postgres): binary was stored as `\x` text
  and SQLite booleans as text. Each row runs in a savepoint; a row the database rejects
  (unique/check) is regenerated up to 5 times, then skipped and reported (`skipped`,
  `problems` in the API and seed modal) instead of aborting the whole seed.
  `Provider.EmptyInsertSQL` removed. Decimal fallback fits NUMERIC(5,2).
- fix(seed): foreign keys. Tables are ordered by `seed/plan.go`: a nullable self-reference,
  and one nullable key on each cycle, are inserted NULL and filled afterwards by
  `SeedTx.Update` (by primary key); a cycle with no nullable key fails naming its tables
  (was "cyclic foreign key dependency" for any cycle, self-loops aside). A required
  self-reference points at an earlier row, or the row itself. Composite keys take every
  column of one parent row. Keys are filled before primary keys are generated, so join
  tables (PK made of FKs) no longer get random ids that match no parent.
- fix(seed): SQLite `CHECK (col IN ('a', ...))` values are introspected as `Field.Allowed`
  (`sqlite/checks.go`; only that exact shape, column names case-insensitive) and the
  seeder picks from them; those columns were rejected on every row before. Postgres enum
  types and MySQL ENUM columns already seeded valid members; now pinned by the suite.
  Unique columns rely on the 5 retries (decided: no up-front dedupe). Grid and export do
  not use `allowed` yet (Stage 3 candidate: enum picker for SQLite).
- fix(db): fields carry `nativeType`, the declared type (`format_type` on Postgres,
  `COLUMN_TYPE` on MySQL, the declared type on SQLite), and `defaultValue` is a SQL
  expression on every dialect: MySQL reported string literals unquoted (`it's`) and
  expressions without their parentheses (`uuid()`), so the canvas DDL preview and the
  Drizzle export printed invalid defaults. Pinned by a `Columns` fixture per dialect.
- fix(export): `internal/export` builds one model (identifiers, keys, both sides of every
  relation, relation names, referenced unique sets) and renders Prisma 7 from it (ADR
  0012; amends 0004). `db.Exporter` now holds dialect facts only: provider, Prisma type +
  native attribute from `nativeType`, default classification (`db.ParseDefault`). Fixed:
  several `@id` → `@@id`, autoincrement only on auto ints, `@@map`/`@map` for names that
  are not identifiers, back-relations and named relations, second key into a table kept,
  composite FKs, `@unique` on referenced columns, enum values kept with `@map`, defaults
  (`now()`, literals, `dbgenerated`), `Unsupported(...)`, keyless tables `@@ignore`d,
  no datasource `url`. SQLite defaults regain the parentheses PRAGMA drops
  (`(datetime('now'))`). Goldens in `internal/db/<dialect>/testdata/` (`go test -update`);
  `tools/exportcheck` (pnpm, prisma 7.10.1, install scripts off) validates them:
  `make export-check`, CI `export` job.
- fix(export): Drizzle renders from the same model; dialects give module/builder facts
  and one builder call per column (`Exporter.Drizzle`, `DrizzleColumn`). Fixed: invalid
  const names (`order items`; consts never shadow imports or JS keywords), `sql` imported
  from `drizzle-orm`, typed `.references((): AnyPgColumn => ...)` so self-references and
  cycles type-check, composite keys and FKs in the table's extra config, `.unique()` on
  referenced columns, real lengths/precision/fsp/unsigned from `nativeType` (no invented
  varchar(255)), serial vs identity, enums (pgEnum declared once, mysqlEnum inline, SQLite
  `text({ enum })` from CHECK lists), JS defaults by column type else `sql\`...\``, bigint
  as JS bigint on PG/MySQL, SQLite dates kept as text (their storage), types with no
  builder (bytea, blob) as `customType` of the declared type. Non-rowid SQLite INT keys no
  longer autoincrement. `export.ts` goldens checked by tsc 5.9.3 + drizzle-orm 0.45.4.

## Next 3 steps

1. End of Stage 2: summarize commits, ask before Stage 3.
2. Stage 3 planning (after approval), incl. the export formats below.
3. Push when the user asks.

## Stage 3 export formats (user decision 2026-11-21)

Add, as renderers on the step 17 export model, each with goldens per dialect and a real
tool check: SQL DDL (round-trip: run on a fresh database, introspect, compare; replaces the
client-side canvas DDL), Mermaid ER, DBML, Kysely, SQLAlchemy. API becomes
`/api/export/{format}` with the UI listing registered formats.

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
- Console statements that return rows but are not recognised (`CALL`, `FETCH`) run as
  writes and show a count (ADR 0010).
- MySQL DSN drops URI query params (e.g. `tls=`); passwords are spliced raw into the
  DSN (special characters untested). Revisit with connection options (medium confidence).
- Postgres identity columns export as GENERATED BY DEFAULT: ALWAYS vs BY DEFAULT is not
  introspected. SQLite's AUTOINCREMENT keyword is not detected (rowid keys export plain).
- Prisma/Drizzle exports keep no referential actions (ON DELETE/UPDATE): not introspected.
- SQLite connections never set `PRAGMA foreign_keys = ON`, so edits, console writes and
  the seeder are not FK-checked on SQLite (SQLite's default; most apps turn it on).
  Turning it on changes console behaviour: decide before changing (high confidence).
- Postgres/MySQL `CHECK (col IN (...))` on non-enum columns is not read into `Allowed`
  (catalog text differs per dialect); those rows are retried, then skipped and reported.
