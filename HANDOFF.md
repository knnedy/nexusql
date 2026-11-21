# HANDOFF

Working log for the staged refactor on `refactor/architecture`. Updated with every commit.

## Current stage

Stage 1: architecture and file tree (approved; standard Go project layout required).

## Done

- docs(adr): ADRs 0001-0006 recording the target layout, layering, exporter
  registry, embedded UI package and web feature split. HANDOFF.md created.

## Next 3 steps

1. chore(build): `go mod tidy`; align documented Go/Node versions with go.mod and Next 16.
2. refactor(ui): move the embed to `internal/ui` with a committed `dist/.gitkeep` (ADR 0005).
3. chore(build): split Makefile targets (Go-only build, test, vet, check); goreleaser reuses them.

## Half-done files

None.

## Stage 2 backlog (found during Stage 1, not yet fixed)

- Postgres `FetchRows` interpolates an unvalidated table name with Go `%q` (SQL injection).
- `"public"` schema hardcoded in `api/rows.go`, `api/seed.go`, postgres column lookups.
- `GET /api/projects` returns full URIs including passwords.
- No Origin/Host checks (DNS rebinding); `sqlite://` can open any file path.
- Destructive-query detection is first-keyword only; LIMIT detection/appending is regex-based.
- `UpdateRow` cannot set NULL; single-column PKs only.
- Connect has no timeout; request bodies are unbounded; raw driver errors reach the client.
- React Query keys not scoped by project/connection.
