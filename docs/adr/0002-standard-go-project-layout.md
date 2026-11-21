# 2. Standard Go project layout

Date: 2026-11-21

## Status

Accepted

## Context

NexusQL ships as one Go binary with an embedded Next.js frontend. The repo should
feel familiar to any Go developer so they can contribute without a tour. Today the
embedded frontend is copied into `cmd/nexusql/out`, `main.go` owns HTTP server setup,
and root-level files mix release assets with source.

## Decision

Follow the widely used Go layout for a single-binary application:

```
cmd/nexusql/        main package only: flags, config, wiring, lifecycle
internal/           all private Go code (nothing is importable from outside)
  api/              HTTP transport: decode request, call service, encode response
  config/           runtime configuration (flags + env)
  db/               Provider/Exporter interfaces, canonical types, registry
    postgres/ mysql/ sqlite/   one package per dialect
  projects/         persisted project list
  seed/             dialect-agnostic fake-data seeding
  server/           http.Server, middleware stack, static file handler
  session/          active connection holder
  studio/           application service layer (see ADR 0003)
  ui/               go:embed of the built frontend (see ADR 0005)
web/                frontend source (Next.js), built into internal/ui/dist
docs/               ADRs, design system, assets
.github/            CI and release workflows
Makefile .goreleaser.yaml .air.toml install.sh   tooling at the root
```

- No `pkg/`: NexusQL is an application, not a library.
- No `src/` at the Go level; one module at the repo root.
- `install.sh` stays at the root because its raw GitHub URL is published.

## Consequences

- `cmd/nexusql` shrinks to wiring; behaviour lives in `internal/` and is testable.
- Moves are done with `git mv` so history follows the files.
- The Go compiler enforces `internal/` privacy; no accidental public API.
