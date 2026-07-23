# Contributing to NexusQL

Thanks for your interest in contributing! This project is early (pre-1.0) and moving quickly, so please open an issue to discuss non-trivial changes before starting work.

---

## Getting Started

**Requirements**

- Go 1.22+
- Node.js 18+
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

This builds the frontend as a static export, embeds it into `cmd/nexusql/out`, then compiles the Go binary.

### Development (hot reload)

```bash
make dev
```

Runs the Go backend via `air` on `:7080` and the Next.js dev server on `:3000` together.

### Other targets

```bash
make run    # build then run ./bin/nexusql
make clean  # remove build artifacts
```

---

## Project Structure

```
cmd/nexusql/       entrypoint, embeds the built frontend
internal/api/      HTTP handlers and router
internal/db/       provider-agnostic schema/query/seed logic
internal/db/postgres/  Postgres-specific provider implementation
internal/session/  active connection state
internal/projects/ saved project storage
web/                Next.js frontend (Canvas + Explorer)
```

Backend providers implement the `db.Provider` interface (`internal/db/provider.go`). If you're adding support for a new database engine, that interface — plus `db.Register` in an `init()` — is the integration point; avoid importing provider-specific packages from `internal/db` itself to prevent import cycles.

---

## Making Changes

1. Fork the repo and create a branch from `main`.
2. Keep changes focused — one feature or fix per PR.
3. Match existing conventions:
   - Go: follow the patterns in `internal/api/` and `internal/db/` (handler shape, error wrapping, `writeError`/`writeJSON` helpers).
   - Frontend: TanStack Query for server state, Zustand for session-scoped UI state, URL query params for Explorer's browsing state.
4. Run `go vet ./...` and `pnpm lint` (in `web/`) before opening a PR.
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
