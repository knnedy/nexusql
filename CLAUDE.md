# NexusQL

Local-first SQL data studio. Go backend (chi, pgx, Postgres/MySQL/SQLite behind a
common provider interface) + Next.js static export (React Flow, TanStack Query/Table,
Zustand) embedded via go:embed (internal/ui/dist). Ships as one binary.

## Commands

- `make dev`: Go via air on :7080 + Next dev on :3000
- `make build`: export frontend, embed, compile to bin/nexusql
- `make run`, `make clean`; Go 1.26+, Node 20.9+, pnpm

## Rules

- Strict bottom-up dependency order; ask before big structural changes.
- All SQL identifiers from the client are validated against introspected schema; never interpolate raw.
- Providers share one interface; no dialect-specific code leaks above it.
- Comments max 2 lines. Conventional commits, one per feature.

## UI

- The existing theme tokens are the starting point: reuse them, improve them, and add new ones when needed.
- emil-design-eng for UI/UX design and polish.
- Tailwind v4 canonical classes if the project uses v4.

## Git

- Commit messages must not include Co-Authored-By, "Generated with Claude Code", Claude-Session, or any AI attribution trailer.
