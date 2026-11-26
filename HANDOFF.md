# HANDOFF

Working log. Stages 1–2 were on `refactor/architecture`, merged (fast-forward) into main
at `5a18329` and pushed 2026-11-21. Stage 3 (`feat/stage-3`) was fast-forwarded into main
at `f101328` and pushed 2026-11-25. The UI rebuild is on `feat/ui-rebuild` (from main,
2026-11-26; not pushed). Updated with every commit.

## UI rebuild (current work, `feat/ui-rebuild`)

User 2026-11-26: the UI is "mid tier, nothing eye catching"; wants a complete rebuild,
page by page, with Canvas vs Explorer reimagined and the export sidebar/drawer redone.
Branches are named after the work, not "stage N".

Critique (impeccable, single-context, screenshots in
~/.claude/projects/-home-kenny-code-projects-nexusql/d18-harness/ui/): 20/40. P1: canvas
and explorer are two apps (two shells; console/seed only on canvas; mode switcher always
highlights Explorer because trailingSlash makes the path /studio/canvas/); type below
11px and text-tertiary #606060 failing contrast in dark (2.5-3.0:1), coral text 4.3:1 on
dark panels; exports hidden behind an unlabelled sidebar icon, ~400px drawer clips code,
no grouping/scope/wrap. P2: console and seed are modals; permanent empty inspector,
crowded floating header, sparse projects page. Code: 166 arbitrary font sizes (12
values, 9-16px), raw red/indigo/amber/blue outside tokens.

Decisions (user): one workspace with views (left schema navigator; Diagram / Data /
Structure as views of the selected table; contextual inspector; SQL docked at the bottom
in every view; Ctrl/Cmd+K palette). Direction "Instrument" (calm precision, graphite and
paper neutrals, coral for action/selection only, teal for relationships only, dense,
readable type). Order: foundations, then layout, then screens. Comps approved by the user
before any screen is coded. Skills: impeccable (direction/critique/audit/polish),
emil-design-eng (motion), web-design-guidelines (review), hallmark only when named.

Plan:
- A. Foundations: 1 PRODUCT.md (done, user interview 2026-11-26); 2 direction comps
  (static mockups of the workspace on a real 16-table schema, both themes; user picks);
  3 DESIGN.md + tokens (11/12px type floor, contrast-checked text, semantic state colours,
  spacing/radius/motion); 4 component primitives (button, input, select, tabs, badge,
  panel, dialog, menu, tooltip, kbd, toast, skeleton, empty state).
- B. Workspace: 5 shell (top bar with project switcher + status, navigator, views,
  inspector, SQL dock; view and table in the URL); 6 command palette + keyboard map.
- C. Screens: 7 home (projects + connect); 8 diagram (absorbs the canvas rework:
  clusters, zoomed-out level of detail, pan speed, square packing, inspector overlap);
  9 data; 10 structure/inspector; 11 SQL dock; 12 export view (formats grouped, wide
  preview, wrap, scope, visible copy/download, per-table copy-as); 13 seed flow.
- D. Finish: 14 states + a11y + keyboard + 1024px; 15 motion/polish, re-run critique
  (target 32/40+).
- Progress: step 2 done 2026-11-26. Three comps in .impeccable/mocks/ (gitignored):
  workspace-instrument.html (7.5/10, sidebar disliked), workspace-v2.html (no sidebar,
  teal top bar; user: "i think i need a sidebar for tables"), workspace-v3.html = chosen:
  v2 plus a tables sidebar (filter, "Linked to <table>" with direction + key column,
  grouped tables with row-count bars, Ctrl+B collapse), top bar "neutral" (teal bar
  rejected: clashed). Use the user's own icon (web/src/app/icon.png, favicon.ico).
  Step 3 done: DESIGN.md (root), .impeccable/design.json, direction contract in
  .impeccable/surfaces/web-src-app-studio.md, new tokens in globals.css (own block,
  --nx-* raw vars; classes bg-panel, text-fg, text-body, rounded-card, shadow-float...).
  Legacy tokens untouched (27 bg-coral + text-white would fail contrast on the new dark
  coral); remove them when the last screen has moved over.
  Step 4 in progress: primitives in web/src/shared/ui (Button/IconButton, Tabs/TabPanel,
  FilterChip/Badge, Kbd, Input, FloatCard/Skeleton, EmptyState; cx in shared/lib).
  html is back to 16px (body keeps 14px so legacy text is unchanged; legacy rem spacing
  grew 14%, e2e green). Use canonical Tailwind classes (gap-2.5, h-7.5, origin-(--x)),
  arbitrary values only where no canonical class exists (user preference). Gallery at /dev/primitives under
  `pnpm dev` only (page.dev.tsx + pageExtensions; absent from the shipped build).
  Overlays on @base-ui/react 1.9 (user chose it 2026-11-26): Menu/MenuContent/MenuItem/
  MenuGroup/MenuSeparator, Select, Dialog/DialogContent, Tooltip(+Provider), Toast
  (ToastProvider + useToast). IconButton carries its own tooltip. Shared popup look and
  motion in shared/ui/popup.ts. Step 4 done; providers get mounted in the shell (step 5).
  Step 5 split (user: commit regularly): 5a workspace frame (done): /studio/ renders
  features/workspace (top bar with project menu, connection status, Read-only/Read-write,
  theme; tables sidebar with filter, "Linked to <table>" (direction + key columns), all
  tables A-Z, collapse; Diagram/Data tabs). URL holds view and table (plus the data
  params); the diagram follows ?table= and pans to it. /studio/canvas and /studio/explorer
  redirect. e2e: helpers reload after setup SQL (the workspace loads the schema first).
  5b (done): canvas sidebar and export drawer gone. Export is a workspace view
  (?view=export&format=id; formats grouped Diagrams / SQL / ORMs and types / Other);
  Auto-layout and Save as PNG sit on the diagram; SQL console and Seed data are in the
  tables sidebar footer (the console modal stays until 5c).
  5c (done): SQL console is a dock under the stage (features/console SqlDock; Ctrl+J
  toggles; collapsed bar keeps the last query and its summary; History is a Menu; the
  read-only toggle left the console since the top bar owns it). Prism colours in
  globals.css (.sql-code) on --nx tokens.
  5d-1 (done): relationship trail in the context bar (workspace/lib/trail.ts: back along
  it, onward by a link drops what came after, anything else starts over; follows ?table=).
  5d-2 (done): canvas InspectorPanel replaced by a floating DetailsCard (facts, links
  both ways that select, columns, keys and checks, Show DDL, Open data; relationships
  show both ends). Details toggle in the context bar on the diagram. linkedTables moved
  to shared/lib. Minimap moved bottom-left. Step 5 done.
  Step 6 (done): Ctrl+K search panel (workspace/lib/search.ts ranks exact, prefix, word
  start, substring, keywords; tables before columns; columns need a query), search box
  in the top bar, shortcuts in lib/shortcuts.ts (Ctrl/Cmd K, B, J; / unless typing).
  No open/close motion on the panel: keyboard-driven.
  Step 7 (done): shared AppBar (components/app-bar.tsx), ThemeButton and ProviderMark in
  shared/ui, LocalNotes (honest storage note). Connect: provider tiles, URI detection
  and validation in connect/lib/connection-form.ts, SQLite create-only-when-asked kept,
  recent projects, examples on first run. Projects: filter (/), provider counts, hover
  Diagram/Data, menu Rename/Delete (delete confirms in a Dialog), helpers in
  projects/lib/project-list.ts. DESIGN.md gained Display 24px for these page titles only.
  Top bar logo renders at 44px (icon.png has 17% padding).
  Step 9 (done): data view rebuilt on the comp. Toolbar holds search, filter chips, the
  Filter popover (Base UI Popover), row count, Columns (MenuCheckboxItem), refresh, CSV,
  and the save bar while edits are pending. Headers show type, PK and FK target; FK cells
  in relation colour with a go-to arrow; enums as dots; size= in the URL. No "+ Row":
  the backend has no insert yet. Column resize is mouse-only.
  Known: a table chosen from outside is centred in the whole stage, partly under the
  card; fix with the diagram work (step 8). Row counts in the sidebar need server
  estimates (pg reltuples, MySQL TABLE_ROWS, SQLite count): own commit. Groups wait for
  diagram clustering (step 8); the comp's group names were invented.
  Step 8 (comp .impeccable/mocks/diagram.html approved after one revision; split 8a-8c).
  8a done: canvas/lib/groups.ts groups tables by FK links (deterministic Louvain,
  CASCADE keys weigh 1.5, groups under 3 tables fold into the group they link to most,
  "Not linked" last), named after the most-linked table; hub links excluded. Each group is
  its own ELK layered graph (direction LEFT, FK ports west / targets east, so a table sits
  right of what it points to); groups pack with rectpacking (aspect 1.6) in an order that
  keeps linked groups adjacent; unlinked tables rectpack. Regions are groupNode nodes
  behind tables (pointer-events none). Lines between groups (cross) and into hubs hide
  behind chips until either end is in focus. Card per DESIGN.md (34px header, 26px rows,
  rounded-card); new --radius-region token; old React Flow handle/edge CSS overrides
  removed (they moved handles to the wrong side). e2e selects .react-flow__node-tableNode.
  Fit area vs the old layout: 400 tables 11.0k x 11.4k (was 14.5k x 18.2k).
  Next 8b: zoomed-out level of detail (keys cards counter-scaled below zoom 0.8, group
  labels readable, one "N links" connector per group pair). 8c: centre the selected table
  left of the details card, light neighbours and dim the rest, restyle minimap/controls
  (zoom %, Fit schema), then web-design-guidelines review of the diagram.
  fix(studio): migration-tool tables (db.IsUserTable: goose_db_version, schema_migrations,
  flyway, prisma, sqlx) are dropped at studio introspection (studio/schema.go introspect),
  so sidebar, diagram, data, search, seed and rows never see them; console SQL still can.
- Gate per step: screenshots both themes, impeccable detect on live pages,
  web-design-guidelines review, e2e updated in the same commit. Encrypted credentials
  move to their own branch after the rebuild.

## Current stage

Stage 3 (approved 2026-11-22), on `feat/stage-3`, pushed to origin at `ae94c59`
(2026-11-24). Groups A, B, C done and summarized. Group D done (D16-D18); summary given
2026-11-24. Group E done (E19-E20); summary given 2026-11-25. Group F done (F21: stay on eslint 9).
Stage 3 summary given 2026-11-25. User approved the close-out: two fixes (inspector keys,
same-named tables on the canvas), then fast-forward main, push, switch to main until Stage 4. STOP and summarize after each letter group before starting the next. Test seams: dbtest conformance, export goldens + real-tool
checks, studio.Service, HTTP API, vitest pure modules; Playwright for C14-15 and D17.

- A. Introspection (each fact also reaches Prisma/Drizzle):
  1 referential actions; 2 PG identity ALWAYS/BY DEFAULT + SQLite AUTOINCREMENT (parse
  sqlite_master SQL); 3 non-unique indexes (@@index, index()); 4 PG/MySQL CHECK IN ->
  Field.Allowed (MySQL 8.0.16+; medium confidence).
- B. Exports: 5 format registry + /api/export/{format}, UI lists formats; 6 SQL DDL
  (round-trip: run on a fresh DB, introspect, compare; replaces canvas lib/ddl.ts);
  7 DBML (@dbml/core); 8 Mermaid ER (parser in Node, medium confidence); 9 Kysely
  (Database interface, tsc; user: keep it, too popular to drop); 10 TypeORM (tsc);
  11 SQLAlchemy 2.0 (venv, configure_mappers, CreateTable); 12 GORM (compiled, AutoMigrate
  round trip). Order changed by the user: TypeORM round trip, then 12, then 11.
  JPA/EF Core later (JDK/.NET in CI); Django has inspectdb; Rails/Laravel models list no
  columns.
- C. Explorer: 13 react-table 9; 14 column filters (typed, validated, parameterized);
  15 keyset paging when sorted by a key, count in its own request.
- D. Canvas: 16 xyflow 13 (smart-edge is a dependency no code imports: drop it, not
  upgrade it); 17 large schemas (visible-only render, ELK in a worker). Also in 17: the export drawer warns when a
  Mermaid diagram exceeds mermaid's limits (50,000 characters or 500 relationships, per
  mermaid 12.3.0's maxTextSize/maxEdges), since GitHub and other viewers then show an
  error; it suggests the canvas PNG or DBML instead.
  18 (user 2026-11-23) readable layout for many tables: no table overlaps another, edges
  route around tables (never under one) with as few crossings as possible. Today ELK
  computes orthogonal routes but they are discarded; edges draw a handle-to-handle smooth
  step that ignores tables, and node heights are guessed constants. Plan: draw ELK's
  routed sections (fall back to smooth step only for edges of a table the user dragged,
  until re-layout); tune ELK (layer-sweep crossing minimisation at higher thoroughness,
  Brandes-Koepf/network-simplex placement, model order, edge spacing); pack disconnected
  groups and lone tables into a near-square area instead of one long strip; lay out with
  the real rendered node sizes. Gate: a vitest layout check on generated schemas (about
  30, 150 and 400 tables, real-world FK fan-in): zero node overlaps, zero edge segments
  through a table that is not an endpoint, crossing count recorded and lower than today's
  baseline, layout time bounded.
- E. 19 CALL/FETCH show rows; 20 explicit "create new SQLite database", else mode=rw.
- F. 21 eslint 10 if eslint-config-next supports it, else record why.

Stage 2 record follows.

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

### Stage 2 close-out (user approved: fix 4 backlog items, then merge to main and push)

- fix(sqlite): foreign keys enforced on every SQLite connection (`file:` URI with
  `_pragma=foreign_keys(1)`; the kept in-memory session gets `SQLSession.Reset`). Edits,
  console writes and seeding could orphan rows before. Existing violations are not
  re-checked; a console `PRAGMA foreign_keys = OFF` lasts one run (ADR 0010).
- fix(db): `Table.Unique` lists unique constraints and full unique indexes (not the
  primary key, partial, expression or INCLUDE parts): Postgres `pg_index`, MySQL
  `STATISTICS`, SQLite `index_list`/`index_info`. Exports used to mark a column unique
  only when a foreign key referenced it; `@@unique`/`unique().on` now come from the
  schema. Seeder left on retries: checking sets up front would insert and skip the same
  rows (only the message differs), so it was not added.
- fix(mysql): URI options reach the driver (`tls`, `charset`, `collation`, `timeout`,
  `readTimeout`, `writeTimeout`); before, every query option was dropped, so TLS-only
  servers could not connect. Other options are refused: the driver turns unknown ones
  into session variables, and `allowAllFiles` would let a server read local files.
  Credentials go onto `mysql.Config` (connector), never into a DSN string. The old
  backlog worry about special characters was unfounded (driver parses backwards);
  now pinned by a test. README lists the options.
- fix(sqlite): `-sqlite-dir` confines SQLite files to one directory (symlinks resolved;
  new files allowed inside it); exposed mode without it opens no files (in-memory only).
  While confined the console refuses `ATTACH` and `VACUUM INTO`, which reach other files.
  `db.Connect` takes `db.Options{FileRoot, NoFiles}` (dialects without local files ignore
  it). Changed plan: missing files are still created, because "connect to a new file and
  build it in the console" is a real flow (e2e and tests use it); an explicit "create new
  database" choice in the connect form is noted for Stage 3. ADR 0007 updated.

- feat(db): A1 referential actions. `Relation.OnDelete/OnUpdate` (`db.RefAction`, SQL
  keywords) from PG `confdeltype`/`confupdtype`, MySQL `REFERENTIAL_CONSTRAINTS`, SQLite
  `foreign_key_list`; unspecified reads NO ACTION on all three (MySQL too, verified).
  Prisma states actions that differ from its defaults (onDelete Restrict, or SetNull when
  optional; onUpdate Cascade), as `db pull` does, and never SetNull on a required
  relation (Prisma rejects it). Drizzle states non-NO ACTION ones. Fixtures gained
  CASCADE/SET NULL; goldens pass prisma validate and tsc (tsc rejects a bad action string).

- feat(db): A2 `Field.Identity` (ALWAYS / BY DEFAULT, PG `identity_generation`) and
  `Field.Monotonic` (SQLite AUTOINCREMENT, read from the CREATE TABLE words via sqlscan so
  strings, quoted names and comments don't count; sqlite_sequence lists a table only after
  an insert). Drizzle: generatedAlwaysAsIdentity vs ByDefault (ALWAYS used to export as
  BY DEFAULT), smallint identity no longer exported as integer, SQLite
  primaryKey({ autoIncrement: true }). Prisma unchanged (autoincrement() for all, as db pull).

- feat(db): A3 `Table.Indexes` (`db.Index{Name, Columns}`, by name): plain column
  indexes, read with the unique sets in one pass (`*/indexes.go`, was `unique.go`).
  Partial, expression and mixed expression indexes are left out (tested with
  `(c, (a + 1))`). MySQL lists its automatic foreign key indexes, as prisma db pull does.
  Prisma `@@index([...])` with `map:` unless the name is Prisma's default
  `{table}_{cols}_idx`; Drizzle `index('name').on(...)`.

- feat(db): A4 `Field.Allowed` on Postgres and MySQL. SQLite's CHECK tokenizer moved to
  `db.Tokenize`/`db.AllowedIn` (standard shapes: `col IN ('a', ...)`, `col = 'a'`; SQLite
  gained the `=` form). Each dialect strips its own syntax first (as with ParseDefault):
  Postgres prints IN as `= ANY (ARRAY[...])` with casts (`(v)::text`, `::character
  varying`, `::text[]`); MySQL 8.4 stores CHECK_CLAUSE with backslash-escaped quotes and
  charset introducers (`_utf8mb4\'x\'`), un-escaped only when no bare quote exists.
  Verified against Postgres 17 and MySQL 8.4 output; servers before MySQL 8.0.16 have no
  CHECK_CONSTRAINTS (error 1109) and report none.

- feat(export): B5 format registry. `export.Formats()`/`Lookup` (id, label, description,
  language, filename, renderer); studio `ExportFormats()` and `Export(ctx, id)` (unknown id
  is ErrNotFound, checked before the connection); `GET /api/export` and
  `GET /api/export/{format}` replace `/api/export/prisma|drizzle` (response field `target`
  renamed `format`). `api` reaches the type as `studio.ExportFormat` (ADR 0003). Web
  sidebar and preview drawer are built from the list (brand icon by id, file icon
  otherwise; unknown highlight language falls back to plain text). First export e2e test.
  ADR 0012 updated. Group A summarized to the user 2026-11-22; CHECK text for DDL approved.

- feat(db): B6a `Table.Checks` (`db.Check{Name, Expr}`), every CHECK constraint with the
  database's own expression text: Postgres `pg_get_expr(conbin)` (same query now also
  feeds Allowed), MySQL CHECK_CLAUSE un-escaped (`unescapeClause`), SQLite the source text
  between CHECK's parentheses (`db.Token` gained Pos/End offsets), named when written
  `CONSTRAINT name CHECK`. Input for the B6b DDL.

- feat(export): B6b SQL DDL (`export.SQL`, format `sql`, listed first). Enum types (PG),
  CREATE TABLE with column type clause from `Exporter.SQLColumnType` (PG serial/identity,
  MySQL AUTO_INCREMENT, SQLite declared type), NOT NULL, DEFAULT, inline single PK
  (+ AUTOINCREMENT), composite PK, the schema's own unique sets (`Table.DeclaredUnique`,
  not the ones added for Prisma), CHECKs, indexes, then foreign keys: inline on SQLite,
  ALTER TABLE ADD CONSTRAINT elsewhere (order and cycles never matter). Round-trip
  conformance test: run the DDL on a fresh database, introspect, compare whole schemas
  (only the database name and SQLite's positional FK names may differ). Fixtures gained
  CHECKs with a quoted literal (MySQL escaping round-trips).

- feat(canvas): B6c inspector DDL from the server. `export.TableSQL` (one table's CREATE
  TABLE, indexes, foreign keys; `sql.go` split into a `sqlWriter`, full export unchanged),
  studio `TableDDL` (table name validated against the schema; migration tables are
  ErrNotFound), `GET /api/tables/{table}/ddl`. Inspector uses `tableDdlQueryOptions`
  (key under schema, so console changes refresh it). Removed the client approximation
  `canvas/lib/ddl.ts` (+ its test: wrong types, invented identity, unknown references).
  e2e: inspector DDL tab.

- feat(export): B7 DBML (`export.DBML`, format `dbml`, highlighted as text: Shiki has no
  DBML grammar). Enums, tables with column settings (pk, increment, not null, unique,
  default), Indexes (composite pk/unique, named plain indexes), Checks, then Refs with
  delete/update actions (`-` for one-to-one). Names quoted unless bare and not a DBML
  keyword; types with spaces quoted. DBML backtick expressions have no escapes, so
  MySQL's backtick-quoted names in CHECKs/defaults become bare or double-quoted. Numeric
  string defaults ('-1'::integer) render as numbers. `tools/exportcheck` parses every
  export.dbml with @dbml/core 11.1.0 (exact; 12.x was under two weeks old).

- feat(export): B8 Mermaid ER (`export.Mermaid`, format `mermaid`, schema.mmd). Tables
  with columns and PK/FK/UK, one line per foreign key: `|o` when a key column is
  nullable, `o|` when the referencing columns are unique, `--` when they are part of its
  primary key (identifying), `..` otherwise. Rules confirmed against mermaid 12.3.0:
  attribute names allow no spaces or quotes (made safe, real name kept as the comment),
  types allow commas but not spaces (underscored), entity names may be quoted.
  `mermaid.parse` runs in Node without a DOM, so `tools/exportcheck` parses every
  export.mmd with it (mermaid 12.3.0, exact).

- feat(export): B9 Kysely (`export.Kysely`, format `kysely`, db.ts): kysely-codegen
  style. One interface per table (PascalCase, unique against helper and enum names),
  `DB` naming them; `Generated<>` for auto or defaulted columns, `GeneratedAlways<>` for
  identity ALWAYS; enums as string unions. `Exporter.KyselyType` gives the usual Node
  driver's types (medium confidence on driver defaults): node-postgres int8/numeric as
  strings (Int8, Numeric helpers), dates as Date (Timestamp), json as Json; mysql2
  decimal as string, bigint as number; better-sqlite3 by storage (dates text, booleans
  numbers). tsc checks it against kysely 0.29.8 and @types/node 22.20.5 (exact).
  README lists all formats.

- feat(export): B10 TypeORM (`export.TypeORM`, format `typeorm`, entities.ts). One class
  per table: Primary(Generated)Column (identity with generatedIdentity), Column with
  type/length/precision/scale/unsigned/enum/nullable/unique/default, @Unique/@Index/@Check,
  ManyToOne/OneToOne with JoinColumn (constraint names except on SQLite) and the inverse
  OneToMany; `Relation<>` avoids ESM decorator-metadata cycles. `Exporter.TypeORM` gives the
  hydrated TS type per dialect (probed on sql.js: SQLite numbers for bigint/decimal,
  datetime as Date; servers strings) and, on SQLite, an affinity-equivalent type when
  TypeORM rejects the declared one (char -> character). Found with the real tools:
  - keyless tables are skipped with a comment (TypeORM needs a primary column);
  - TypeORM 1 has no width/zerofill (dropped);
  - TypeORM writes string defaults as '${v}' unescaped on all drivers (read in source), so
    defaults containing a quote are emitted as raw SQL functions.
  Check: tsc with decorators,
  DataSource.buildMetadatas on pg/mysql2 (no connection), full sync into sql.js for SQLite
  (typeorm 1.1.2, reflect-metadata 0.2.2, pg 8.23.1, mysql2 3.24.6, sql.js 1.15.2, exact).

- refactor(export): SQL, DBML and Kysely writers append to their strings.Builder piece by
  piece instead of concatenating first (user's change; goldens unchanged).

- fix(export): TypeORM round trip. `make export-check` now also runs
  `TestConformance/Export` with `-exportcheck`: `tools/exportcheck/typeorm-sync.mjs`
  compiles the entities and runs TypeORM's synchronize on a fresh database (Postgres and
  MySQL containers, SQLite file via sql.js), which is introspected and compared with the
  original (keyless tables dropped). Harness gained `URI`/`Connect`; `lineDiff` is now an
  LCS diff. Fixed: MySQL tinyint(1) exports as TypeORM boolean (hydrates booleans);
  defaults a JS number would reformat (1.50) are raw SQL; SQLite expression defaults go
  without the outer parentheses (TypeORM writes DEFAULT (x)). Postgres recreates exactly
  bar spelling. Each harness's `Export.TypeORMLimits` lists what TypeORM cannot create,
  all confirmed in TypeORM 1.1.2's source:
  - MySQL: no CHECK constraints ("MySql does not support check constraints"); booleans
    as tinyint without (1) (no display widths, length rejected on boolean/tinyint).
  - SQLite: AUTOINCREMENT on every generated key; int key becomes INTEGER (rowid);
    key columns NOT NULL; lower-case types; char written as character; CHECK names.
  - Postgres: CURRENT_TIMESTAMP spelled now(), smallint default cast.
  CI export job now sets up Go.

- feat(export): B12 GORM (`export.GORM`, format `gorm`, models.go, gofmt'd via go/format).
  One struct per table with column tags (column, verbatim type, primaryKey, autoIncrement,
  not null, default, unique/uniqueIndex/index with priority, one check per field since
  GORM keeps one), belongs-to pointers and has-many slices, TableName methods, enums as
  string types with constants, and `Models()` in parents-first order for AutoMigrate.
  Checked by `tools/gormcheck` (own module: gorm v1.31.2, driver/postgres v1.6.3,
  driver/mysql v1.6.0, driver/sqlite v1.6.0 cgo; never in the root module or binary):
  the export test writes out/<dialect>/ and runs AutoMigrate on a fresh database, then
  compares. All three dialects recreate the schema. `Exporter.GORM` per dialect: PG and
  SQLite defaults in parentheses (GORM trims and requotes others), PG identity via the
  driver's `generated:identity [always]` (autoIncrement means serial; a type would be
  copied onto foreign keys), SQLite AUTOINCREMENT as the full column type, MySQL literal
  defaults as values (parentheses make expression defaults). Found with the round trip:
  GORM tries has-one before belongs-to, so a belongs-to whose key fields are named like
  the target's fields is left out (comment points to the has-many side); type names GORM
  treats as its own (int, time, ...) get a trailing space; tags with backticks use an
  interpreted string literal. GORM limits: foreign key names are GORM's own; CHECK names
  other than [\w-]+ become chk_<table>_<field>; Postgres enum types must exist first (the
  file header lists the CREATE TYPE statements); on MySQL a string default with a quote
  at either end becomes an expression default.

- feat(export): B11 SQLAlchemy (`export.SQLAlchemy`, format `sqlalchemy`, models.py):
  SQLAlchemy 2.0 declarative (`Mapped[...]`, `mapped_column`), a `Table` for keyless
  tables, `__table_args__` with UniqueConstraint/ForeignKeyConstraint (names except on
  SQLite, actions)/Index/CheckConstraint, Identity, server_default=text() with :name colons
  escaped, sqlite_autoincrement, relationships both ways (foreign_keys, remote_side for
  self-references, uselist=False for one-to-one), enums as shared Enum(..., name=).
  `Exporter.SQLAlchemy` per dialect gives the type that renders the native one exactly
  (MySQL tinyint(1) -> BOOLEAN, timestamps with precision/fsp), else a `Raw`
  UserDefinedType writes it verbatim; MySQL number defaults go as quoted literals, since
  SQLAlchemy parenthesises any default with a non-word character (read in its MySQL
  compiler). Checked by `tools/sqlacheck` (venv in tools/sqlacheck/.venv, made by
  `make export-check`; SQLAlchemy 2.0.57, psycopg 3.3.8, PyMySQL 1.2.3): import,
  configure_mappers, create_all on a fresh database, compare. All three dialects
  recreate the schema with no limits.

- test(export): the export fixture's `order items` gains `tag DEFAULT 'at :noon'` and
  `CHECK (tag <> ':x')` on every dialect, so all goldens cover a colon text() reads as a
  parameter. Without escaping, SQLAlchemy silently writes 'at NULL' (mutation-checked).

- docs(readme): what test-integration, e2e and export-check need beyond Go/Node/pnpm
  (Docker, Playwright Chromium, cgo compiler, python3-venv); none of it ships.

- feat(explorer): C13 @tanstack/react-table 9.3.1 (exact). `useTable` with explicit
  features registered once at module scope (visibility, sizing, then resizing, which needs
  sizing); `getCoreRowModel` gone; `ColumnDef`/`Row` take the feature type; no casts. The
  grid uses no row models (sorting/paging are server-side), so nothing else moved.
  Playwright gains hide-a-column and drag-to-resize tests (both fail with visibility
  state dropped or resizing off). All 10 e2e tests pass.

- fix(explorer): search escapes LIKE wildcards (`\`, `%`, `_`) on every dialect; before,
  searching `50%` or `a_b` matched unrelated rows. `db.LikeContains` builds the pattern
  with backslash as escape (Postgres/MySQL default, high confidence); SQLite has no
  default escape, so it adds `ESCAPE '\'` (high confidence). Conformance test on all
  three dialects; mutation-checked (unescaped backslash, missing ESCAPE). C14's
  `contains` / `starts with` reuse the escaping.

- feat(explorer): C14 column filters (user 2026-11-23: toolbar "Filters" popover +
  removable chips; typed core set). `db.RowsRequest.Filters`; one shared `db.Where`
  builder renders search (OR group, parenthesised) AND every filter, with each dialect
  giving only quoting, placeholders, its case-insensitive LIKE and its `editArg` (MySQL
  booleans as 1/0). studio resolves columns against the schema and allows ops per kind:
  text = != contains startsWith null; number/temporal = != < <= > >= null; boolean and
  choice (enum or CHECK IN) = != in null; JSON null only; other = != null. Numbers must
  parse, booleans be true/false, choices be allowed values; <= 20 filters, <= 100 in-values.
  API: `filters` query param, JSON [{column, op, values}]. UI: filters live in the URL;
  lib/filters.ts mirrors the server's kind rules (vitest). FK navigation is now an `=`
  filter (paged, sortable), replacing the frontend lookup hook; empty and error states
  say why. Tests: conformance on all three dialects (incl. PG enum, MySQL tinyint
  boolean, quote-laden value), studio validation, API parsing, Playwright (filter +
  reload + chip, is one of, FK). Mutation-checked at each seam.
  Open question for the group C stop: GET /api/rows/{t}/lookup and
  `Provider.FetchRowWhere` now have no caller; removing them is a structural cut.

- feat(explorer): C15 keyset paging, count in its own request. Every page order now ends
  with the primary key (same direction), fixing rows that tie on the sort column
  repeating or vanishing between pages (seen on SQLite). `RowsRequest.After` continues
  after the previous page's last (sort, pk...) values, expanded as a > ? OR (a = ? AND
  b > ?) so no dialect needs row values; Offset is ignored then. studio allows keyset
  only with a primary key, NOT NULL order columns, and types whose text compares exactly
  (integers, text, uuid, date); otherwise OFFSET (now deterministic). A malformed cursor
  is ErrInvalid; one the order cannot use is ignored. Rows fetches Limit+1 for HasMore
  and returns a Cursor only when another page follows. `Provider.FetchRows` no longer
  counts; `CountRows` and GET /api/rows/{t}/count (search + filters) do. Web: the cursor
  for page p is the cached page p-1's (TanStack cache), so a reload onto page 5 uses
  OFFSET; the count query is keyed without page/sort, so paging never recounts; Next
  follows hasMore. Tests: conformance on all three dialects (ties, cursors asc/desc,
  composite key, count), studio (cursor walk, eligibility, bad cursors, count), API,
  Playwright (cursor sent, reload offset, back). Mutation-checked at each seam.

- Group C summarized 2026-11-23. User: remove the lookup endpoint; fix canvas PNG export
  in dev; give each export format its official icon (before group D).
- refactor(rows): drop GET /api/rows/{t}/lookup, Service.LookupRows and
  Provider.FetchRowWhere, unused since FK navigation became an `=` filter (C14). Tests
  that read rows through it now use FetchRows/Rows with an `=` filter.

- fix(canvas): the PNG snapshot preview used next/image on a data: URL with no
  width/height, which Next rejects outside production ("missing required width"), so the
  export broke in `make dev` only. A plain <img> shows it (nothing to optimise). The
  bounds now come from useReactFlow().getNodesBounds, silencing React Flow's sub-flow
  warning. vitest component test (red on the old code); checked in a real `next dev` +
  binary run: snapshot renders, no console errors or warnings.

- feat(export): each export format shows its brand mark (sidebar and drawer header) from
  one FormatIcon. Simple Icons (react-icons/si) for Prisma, Drizzle, TypeORM, SQLAlchemy,
  Mermaid; SQL DDL takes the connected database's logo. Kysely (kysely-org/kysely, MIT)
  and DBML (holistics/dbml, Apache-2.0) redrawn one-colour from their repos' SVGs. GORM
  has no icon of its own (only an unlicensed wordmark favicon), so Go's logo stands in
  (user choice). vitest: every server format has a mark; screenshots checked both themes.
- chore: gitignore web/AGENTS.md, which `next dev` 16.4 writes on every run (user choice).

- D16 feat(canvas): @xyflow/react 13.0.2 (exact). Typecheck was clean as-is; behaviour
  changes handled: fitView padding numbers are pixels now, so 0.38 became "14%"; v13
  follows the OS colour scheme by default, so forceColorMode follows the app theme.
  Dropped @tisoap/react-flow-smart-edge (no code imported it). Screenshots v12 vs v13
  match in both themes with the OS set opposite to the app.

- D17a feat(export): the Mermaid drawer warns when the diagram passes Mermaid's default
  limits (maxTextSize 50,000 chars, maxEdges 500; high confidence these are Mermaid's
  defaults) and points to the canvas PNG or DBML. Counts -- and .. relationship lines.
  vitest at the drawer seam; five mutants all killed.

- D17b perf(canvas): ELK runs in a Web Worker (elk-api + lib/elk.worker.ts; no Worker,
  as in vitest, falls back to the lazy in-thread bundle); onlyRenderVisibleElements;
  table nodes drop their three backdrop blurs (backgrounds were 90-95% opaque already)
  and transition-all. Measured on generated SQLite schemas (scratch Playwright perf spec,
  CDP metrics + trace; headless rAF timing proved meaningless here, so frame rate is
  not measured): longest main-thread block at 400 tables 4-5 s -> 0.6-1.0 s, at 150
  1.4-4 s -> 0.3 s; pan main-thread per step at 400 tables ~81 -> ~45 ms; paint +
  composite per pan step ~15-25% lower without the blurs. Remaining pan cost is edges.

- fix(canvas): a foreign key that references a UNIQUE non-primary column left the whole
  canvas empty (ELK "Referenced shape does not exist": target ports existed only for
  PKs). Ports and target handles now exist for every referenced column. Found while
  starting D18. vitest (buildCanvasGraph) + e2e/canvas.spec.ts; both halves mutation-checked.

- D18a feat(canvas): edges follow ELK's orthogonal routes (lib/edge-path.ts: rounded
  bends, label at half length; falls back to smooth step when a dragged table's handles
  leave the route). Ports are FIXED_POS, zero-size, at the handle centres; table nodes
  render at exactly getNodeHeight (border always 1px, header 44, rows 34, pad 4; select
  no longer scales or drops the border). Auto-layout now also replaces the edges.
  Measured (vitest, src/test/layout-metrics.ts on the modular generator): edge segments
  under a table 70/667/1547 -> 0 at 30/150/400 tables, overlaps 0. Crossings 79/2085/
  18992 (modular fixture), about 90% from hub edges (next step). Relayout-edges mutant is
  equivalent (deterministic layout restores the same routes); others killed.
- D18 decision (user 2026-11-24): relations into heavily referenced tables become a chip
  on the FK row ("-> users"); their line shows on hover/select of either table; clicking
  the chip jumps to the hub; layout ignores those edges. Plus focus: hover/select dims
  unrelated edges. Only for larger schemas (threshold scales with size).

- D18b feat(canvas): hub relations as chips + focus. findHubs: schema >= 40 tables and
  >= max(10, 5% of tables) distinct referrers (self-references ignored). Hub edges leave
  the ELK graph (data.hub, no route); the FK row shows "-> users" (HubChip: centres the
  hub, keeps it in focus). lib/focus-store.ts (zustand): hovered ?? selected; edges in
  focus full opacity/2px, others 0.12; hub lines only while either end is in focus
  (smooth-step, no route). Crossings 2085 -> under 521 at 150, 18992 -> under 4748 at
  400 (asserted < 1/4); measured ~306 / ~1890. Six layout mutants and four UI mutants
  killed (e2e/canvas.spec.ts hub test).

- D18c feat(canvas): min zoom 0.2 -> 0.02 so the first view fits a 400-table schema
  (needs ~0.028; e2e red at 0.2 and 0.05, 353/400 on screen). Declaring node
  width/height was tried and not needed. Trade-off: panning the fitted 400-table
  overview renders everything (~75-130 ms main thread per step, noisy); hiding row text
  below 0.35 zoom gave no measurable gain and was reverted. The random hub-heavy harness
  schema still lays out as a tall strip; the modular fixture is near-square.

## Resume here (D18)

- Goal (user 2026-11-23): many tables laid out so nothing overlaps, edges route around
  tables, few crossings. Today: canvas-utils.ts runs ELK layered + ORTHOGONAL, but only
  node positions are used; relation-edge.tsx draws getSmoothStepPath handle to handle, so
  routes ignore tables. Node heights are constants (NODE_HEIGHT_BASE 44 + 34/row).
- First: a vitest layout metric on generated schemas (30/150/400 tables). ELK runs
  in-thread under vitest (no Worker), so buildCanvasGraph is the seam. Record baseline.
- Perf/visual harness (outside the repo, survives reboots):
  ~/.claude/projects/-home-kenny-code-projects-nexusql/d18-harness/. Build with
  `make build`, then from web/: `pnpm exec playwright test --config <harness>/shots.config.ts
  perf.spec.ts` (SIZES=150,400 SHOT_TAG=name; prints RESULT lines, writes screenshots).
  schema-gen.ts is the deterministic hub-heavy schema generator to reuse in vitest.
- Measuring caveats: headless rAF/frame timing is meaningless here (3 tables "50 ms");
  use CDP Performance metrics and trace Paint/RasterTask sums. Runs are noisy: repeat 3x.

- E19 fix(console): CALL, FETCH and EXECUTE are classified write + rows, so as the last
  statement they show their result set (PG INOUT/OUT parameters, cursor rows, prepared
  SELECTs; MySQL procedure result sets) instead of a count; they still need confirmation
  and close the connection. Executors unchanged. sqlscan unit + PG/MySQL integration
  tests (red first: FETCH 2 used to show "2 rows affected"); 3 mutants killed. ADR 0010
  updated.

- style: gofmt the E19 integration tests (a one-line struct type gofmt expands).

- E20 feat(connect): SQLite opens only existing files (mode=rw, plus a stat check with a
  clear "no SQLite database at ..." error); a "Create a new database file" checkbox (SQLite
  only) sends create:true -> Service.ConnectNew -> db.Options.CreateFile (mode=rwc, refuses
  an existing file). Postgres/MySQL return db.ErrCannotCreate. Saved projects never
  recreate a deleted file. Tests: sqlite (open/create/reopen-after-delete), studio
  ConnectNew, API create flag, e2e connect.spec; dbtest.SQLiteFile makes empty files for
  older tests. 7 mutants killed (incl. rw->rwc via the reopen test, UI create flag).

- F21 decision (2026-11-25, no code change): stay on eslint 9. eslint-config-next 16.4.6
  allows eslint >=9, but its eslint-plugin-react 7.37.5, -import 2.32.0 and -jsx-a11y
  6.10.2 (all latest) cap their eslint peer at ^9; typescript-eslint, react-hooks and the
  TanStack plugin allow ^10. A trial with eslint 10.15.0 linted clean and fired the same
  react/import/hooks/a11y rules as 9, but on unmet peers for no new checks. Revisit when
  those three plugins declare ^10 (check: pnpm view eslint-plugin-react peerDependencies).

- Close-out 1 fix(canvas): the inspector's Indexes tab lists what the server introspected
  (lib/table-keys.ts: PK, FKs with real constraint names, column pairs and non-default
  actions, unique sets, named indexes, CHECKs) instead of client-made pk_/fk_ names.
  SQLite FKs still show the server's placeholder name fk_<table>_<n>. vitest (6 mutants
  killed) + e2e in export.spec.ts (red on the old inspector).

- Close-out 2 fix(db): the "same-named tables collide on the canvas" item could not
  happen (only the default schema is introspected), but its real form did: PG keys into
  another schema and MySQL keys into another database came back as relations to a
  same-named local table (wrong line, wrong export reference, seeder picking wrong ids)
  or to a table not loaded. Relations now only target the introspected schema; the
  column keeps IsForeignKey. PG/MySQL integration tests (red first; 3 mutants killed).
  Also replaced MySQL introspectForeignKeys' stale comment (composites are supported).

## Canvas rework (user feedback 2026-11-25, do after group E/F or when the user asks)

The user checked the D18 canvas and was disappointed:
1. Table placement doesn't follow relationships: related tables are not near each other.
2. Zoomed out, tables lose legibility (min zoom 0.02 shows unreadable boxes).
D18's metrics (overlaps, edges under tables, crossings) passed but don't measure what
the user cares about. Next time: agree the target look with screenshots first. Ideas:
cluster related tables (modules) and lay out per cluster, then place clusters; a
zoomed-out level of detail with large table names (and cluster labels) instead of
shrunken full tables; judge on realistic schemas side by side with the user.

## Next 3 steps

1. Step 8b: diagram level of detail when zoomed out, plus group-to-group connectors.
2. Step 8c: selection centring beside the details card, neighbour highlight, minimap and
   controls restyle; web-design-guidelines review of the diagram.
3. Group C steps 10-13 (structure, SQL dock, export, seed), each comp first. Pending:
   row-count estimates (own commit), guidelines review of the workspace screens.

## Stage 3 export formats (user decision 2026-11-21, revised 2026-11-22)

Renderers on the step 17 export model, each with goldens per dialect and a real tool check:
SQL DDL, Mermaid ER, DBML, and ORMs/builders across languages: Kysely (kept at the user's
request), TypeORM, SQLAlchemy, GORM. See plan group B above.

Considered and deferred (user, 2026-11-22: "no group G for now"): Java/JPA, PHP/Laravel
(migration + Eloquent models), Rust (Diesel/SeaORM/SQLx), .NET EF Core. Each needs a new
toolchain in the export check, and the SQL DDL export already feeds their usual paths
(Flyway/Liquibase take SQL files; Laravel loads database/schema/*.sql); Rust and EF Core
tools generate from a live database themselves. Revisit only on user demand, JPA first.

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

- SQL DDL leaves out what is not introspected: MySQL charset/collation and ON UPDATE
  CURRENT_TIMESTAMP, generated columns, comments, views, triggers, non-serial sequences;
  composite primary keys follow column order, not key order; tables are unqualified.
- Partial and expression indexes are not introspected, so exports (and the B6 DDL) leave
  them out; index sort order (DESC) and collations are not kept either.
- Console statements other than CALL/FETCH/EXECUTE that return rows but are not
  recognised run as writes and show a count; a MySQL CALL shows only its first result
  set (ADR 0010).
- Keys into other schemas/databases are left out of relations (close-out 2); showing
  tables from several schemas would need schema-qualified table ids end to end.
- CHECK constraints other than single-column string lists (ranges, multi-column,
  `IN (...) OR x IS NULL`) only reach `Table.Checks`, not `Field.Allowed`: the seeder
  retries then skips rows they reject.
