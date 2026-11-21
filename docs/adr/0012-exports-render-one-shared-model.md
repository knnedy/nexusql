# 12. Exports render one shared model

Date: 2026-11-21

## Status

Accepted. Amends 0004.

## Context

Each dialect had its own Prisma and Drizzle generator, three near-copies of about 300 lines.
They shared the same structural bugs, and `prisma validate` 7.10.1 and `tsc` with
drizzle-orm 0.45.4 rejected their output: several `@id` on composite keys, autoincrement on
text keys, model and constant names that were not identifiers (`model Order items`), relations
with no opposite side, a second key into the same table dropped, composite foreign keys left
out, enum values upper-cased without `@map`, and Prisma 7's removed datasource `url`. More
formats are planned (SQL DDL, Mermaid ER, DBML, Kysely, SQLAlchemy), which would multiply
the copies.

## Decision

- `internal/export` builds one model from the introspected schema: identifiers valid in every
  target language (database names kept where valid, mapped otherwise), primary keys,
  every foreign key seen from both tables with field names that do not collide, relation
  names where two tables are linked more than once, and the unique column sets that keys
  reference. Each format renders that model.
- `db.Exporter` holds only dialect facts: the Prisma provider, each field's Prisma type and
  native attribute (from `Field.NativeType`), and how to read a default (`db.ParseDefault`
  after the dialect strips its own syntax, such as Postgres casts).
- Each dialect's conformance harness has an export fixture covering every shape above.
  Its output is compared with `internal/db/<dialect>/testdata/export.*` (`go test -update`
  rewrites them), and `tools/exportcheck` validates those files with the real tools, pinned,
  in CI and in `make export-check`.

## Consequences

- A format is written once and is correct for every dialect; a dialect adds facts, not code paths.
- Prisma output follows `prisma db pull` naming, not PascalCase models.
- The golden files are the reviewable contract; a change to any export shows up as a diff.
- Defaults Prisma cannot express as values stay database expressions (`dbgenerated`).
