# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Developers working on their own database.** They run NexusQL locally against the dev or staging database of an app they are building, while they build it.
- **Learners and explorers in unfamiliar databases.** They open a database they didn't design (an inherited project, a course, an open dataset) to understand how it fits together.

## Product Purpose

NexusQL is a local-first SQL data studio for Postgres, MySQL and SQLite. It shows a database's schema as a diagram and as structure, lets you browse and edit rows, run SQL, seed fake data, and generate schema and ORM files from the live database.

When the design must favour one job, **understanding the schema** wins: how tables relate, and what their columns, keys, indexes and constraints are. Working with data and generating code build on that understanding.

## Positioning

What NexusQL should be known for, compared with TablePlus, DBeaver, Prisma Studio or Drizzle Studio:

- **One binary, local-first.** No install, no account. A single file serves the app to your browser, and it stays on your machine.
- **Exports from a live database.** Nine formats (SQL DDL, Prisma, Drizzle, Kysely, TypeORM, SQLAlchemy, GORM, DBML, Mermaid ER) are generated from any supported database, not from one ORM's own schema.
- **Diagram, data and SQL together.** One workspace where the schema picture, the rows and the queries stay connected.
- **Safe by default.** Read-only mode is enforced by the database, writes ask for confirmation, and the server listens only on localhost unless explicitly exposed.

## Operating Context

- Runs as `nexusql` on the developer's machine and opens in a browser at `http://127.0.0.1:7080`. Exposing it on a network needs `-expose` and an access token (ADR 0007).
- Projects are saved connections stored locally (`~/.nexusql/projects.json`); passwords are not yet encrypted at rest.
- One active connection at a time. Only the database's default schema is loaded.
- Schemas range from a handful of tables to several hundred.

## Capabilities and Constraints

- Providers: Postgres, MySQL, SQLite, behind one provider interface. SQLite files are only created when the user asks.
- Data: server-side sort, search, typed column filters and keyset paging; inline cell edits by full primary key; foreign-key navigation; CSV export.
- SQL console: multi-statement runs, history, read-only toggle, confirmation before writes, results for `SELECT`, `RETURNING`, `CALL`, `FETCH`, `EXECUTE`.
- Seed: fills every table in dependency order, respecting foreign keys, enums and simple CHECK lists.
- Exports: the nine formats above, each checked against the real tool, plus the diagram as PNG.
- Frontend: Next.js static export embedded in the Go binary, Tailwind v4, React Flow for the diagram, TanStack Query and Table.
- Undecided: showing several schemas at once; encrypting saved passwords.

## Brand Commitments

- The name is NexusQL.
- The existing theme tokens (coral accent, teal for relationships, light and dark themes) are the starting point: reuse them, improve them, and add new ones when needed (CLAUDE.md).

## Evidence on Hand

- Real screenshots of the current UI: `docs/assets/preview-canvas.png`, `docs/assets/preview-explorer.png`.
- No user counts, testimonials, case studies or benchmarks exist. Do not invent any.

## Product Principles

1. **The schema is the map.** Every view should make it easier to see where you are in the database and how this table relates to others.
2. **One workspace, connected views.** Selecting a table anywhere selects it everywhere; diagram, data, structure and SQL never feel like separate apps.
3. **Safe by default, fast when trusted.** Destructive actions are explicit and confirmed; everyday reading needs no ceremony.
4. **Local and honest.** Nothing leaves the machine unless the user exposes it, and the UI never claims more than the database says.
5. **Readable for newcomers, efficient for regulars.** Clear labels and empty states for someone exploring an unfamiliar database; keyboard paths for someone who lives in it.
