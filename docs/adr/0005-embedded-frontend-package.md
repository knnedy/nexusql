# 5. Embedded frontend lives in internal/ui

Date: 2026-11-21

## Status

Accepted

## Context

The static frontend export was copied into `cmd/nexusql/out` and embedded from
`main`. That directory is gitignored, so `go build ./...`, `go test ./...` and
`go vet ./...` fail on a fresh clone or in Go-only CI until the frontend is built.

## Decision

- Move the embed into its own package, `internal/ui`, exposing `ui.FS() fs.FS`.
- Embed `all:dist`; commit `internal/ui/dist/.gitkeep` and gitignore the rest of
  `dist/`, so the package always compiles.
- The build copies `web/out/.` into `internal/ui/dist/` without deleting `.gitkeep`.
- When `dist/index.html` is missing, the server serves a short page explaining how
  to build the frontend instead of an opaque 404.

## Consequences

- Backend contributors can build and test without Node installed.
- `cmd/nexusql` contains only `main.go`.
- The Makefile and goreleaser share one `web-build` target that knows the path.
