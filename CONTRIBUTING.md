# Contributing to NexusQL

Thanks for your interest in contributing! This project is early (pre-1.0) and moving quickly, so please open an issue to discuss non-trivial changes before starting work.

---

## Getting Started

**Requirements**

- Go 1.26+
- Node.js 20.9+
- pnpm
- A local Postgres, MySQL, or SQLite instance to test against

```bash
git clone https://github.com/knnedy/nexusql.git
cd nexusql
```

### Full build

```bash
make build
./bin/nexusql
```

This builds the frontend as a static export, embeds it into `internal/ui/dist`, then compiles the Go binary.

### Development (hot reload)

```bash
make dev
```

Runs the Go backend via `air` on `:7080` and the Next.js dev server on `:3000` together.

### Other targets

```bash
make run       # build then run ./bin/nexusql
make go-build  # Go only, no Node needed (serves a "frontend not built" page)
make test      # go test ./...
make check     # everything CI runs
make clean     # remove build artifacts
```

---

## Project Structure

Standard Go layout for a single-binary app; decisions are recorded in [`docs/adr/`](docs/adr).

```
cmd/nexusql/          main: flags, config, wiring
internal/
  server/             http.Server, router, graceful shutdown
  api/                HTTP transport: parse request, call studio, write response
  studio/             application service: active connection, validation, projects
  db/                 Provider + Exporter interfaces, canonical types, registry
    postgres/ mysql/ sqlite/   one package per dialect, registered in init()
  seed/               dialect-agnostic fake-data seeding
  session/            active connection holder
  projects/           saved projects (~/.nexusql/projects.json)
  ui/                 go:embed of the built frontend (dist/)
web/src/
  app/                Next.js routes only; pages are thin wrappers over features
  components/         shared, feature-agnostic UI
  features/<name>/    connect, projects, studio, canvas, explorer, console, seed, export
                      each with index.ts (public entry), _components/, hooks/, lib/
  shared/             api client + query keys, types, store, cross-feature hooks, lib
  providers/          app-wide React providers
docs/                 ADRs, assets
```

Dependencies point one way: `server → api → studio → db ← dialects` (ADR 0003). Nothing
above `internal/db` imports a dialect package; a new engine implements `db.Provider` (and
`db.Exporter`) and calls `db.Register` / `db.RegisterExporter` from `init()`.

In `web/`, features import each other only through `@/features/<name>`, and component
folders are named `_components` everywhere except `src/components` (ADR 0006).

---

## Making Changes

1. Fork the repo and create a branch from `main`.
2. Keep changes focused — one feature or fix per PR.
3. Match existing conventions:
   - Go: handlers stay thin and call `internal/studio`; return classed errors (`studio.ErrInvalid`, ...) and let `api.writeServiceError` pick the status.
   - Frontend: TanStack Query for server state, Zustand for session-scoped UI state, URL query params for Explorer's browsing state.
4. Run `make check` before opening a PR (CI runs the same steps).
5. Write a clear PR description — what changed and why, not just what.

---

## Reporting Bugs

Open an issue with:

- What you expected vs. what happened
- Steps to reproduce
- Your database provider and version
- NexusQL version (`nexusql -version`)

---

## Feature Requests

Open an issue describing the use case before submitting a PR — this helps avoid wasted work on features that don't fit the project's direction (e.g. local-first, single-binary distribution where practical).

---

## License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
