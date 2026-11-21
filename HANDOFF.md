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

## Next 3 steps

1. chore(build): split Makefile targets (Go-only build, test, vet, check); goreleaser reuses them.
2. ci: add PR workflow (go vet/build/test, pnpm typecheck/lint/build).
3. chore(deps): update Go modules (minor/patch).

## Half-done files

- Makefile: target split written, uncommitted (lands in step 1 above).

## Planned dependency updates (after CI step)

- Go: minor/patch only (lipgloss, gofakeit, chi, mysql, pgx, modernc sqlite).
- Web: minor/patch incl. next + eslint-config-next 16.4.6 together; elkjs 0.12 alone;
  @types/node pinned to ^22 (CI Node), not 26.
- html-to-image stays exact 1.11.11: 1.11.12+ regressed image export with React Flow.
- Deferred to Stage 3 (with tests): @tanstack/react-table 9, react-flow-smart-edge 5.


## Stage 2 backlog (found during Stage 1, not yet fixed)

- Postgres `FetchRows` interpolates an unvalidated table name with Go `%q` (SQL injection).
- `"public"` schema hardcoded in `api/rows.go`, `api/seed.go`, postgres column lookups.
- `GET /api/projects` returns full URIs including passwords.
- No Origin/Host checks (DNS rebinding); `sqlite://` can open any file path.
- Destructive-query detection is first-keyword only; LIMIT detection/appending is regex-based.
- `UpdateRow` cannot set NULL; single-column PKs only.
- Connect has no timeout; request bodies are unbounded; raw driver errors reach the client.
- React Query keys not scoped by project/connection.
