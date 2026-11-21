# HANDOFF

Working log for the staged refactor on `refactor/architecture`. Updated with every commit.

## Current stage

Stage 1: architecture and file tree (approved; standard Go project layout required).

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

## Next 3 steps

1. refactor(db): Exporter registry; drop dialect imports from api.
2. refactor(server): extract HTTP server setup from main.go; health reports real Version.
3. refactor(api): extract respond helpers and session guard.

Remaining Stage 1 after that: studio service layer, web shared/ + features/ moves (one feature per commit), README structure docs.

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

- Postgres `FetchRows` interpolates an unvalidated table name with Go `%q` (SQL injection).
- `"public"` schema hardcoded in `api/rows.go`, `api/seed.go`, postgres column lookups.
- `GET /api/projects` returns full URIs including passwords.
- No Origin/Host checks (DNS rebinding); `sqlite://` can open any file path.
- Destructive-query detection is first-keyword only; LIMIT detection/appending is regex-based.
- `UpdateRow` cannot set NULL; single-column PKs only.
- Connect has no timeout; request bodies are unbounded; raw driver errors reach the client.
- SQLite introspection reports `INTEGER PRIMARY KEY` as nullable with default "AUTOINCREMENT".
- React Query keys not scoped by project/connection.
