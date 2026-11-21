# 8. Providers take resolved identifiers

Date: 2026-11-21

## Status

Accepted

## Context

Table and column names arrive from the browser. Each provider validated them its own
way: Postgres quoted the table with Go's `%q` (not SQL quoting, so names containing
quotes broke and validation was incomplete), and several lookups hardcoded the
`public` schema, which MySQL read as a database name, so sorting, seeding and the
schema view found no tables on MySQL.

## Decision

- `db.Provider` row methods take `db.Table` / `db.Field` values from introspection
  (`FetchRows(ctx, db.RowsRequest)`, `FetchRowWhere`, `UpdateRow`), never raw strings.
- `studio` resolves every client name against a per-connection cache of the dialect's
  default schema (`DefaultSchema()`); unknown names are `ErrInvalid` before any SQL runs.
- The cache refreshes on a miss, on `GET /schema`, before seed/export, and after console
  SQL that writes or fails.
- Providers quote resolved names with their own `QuoteTable` / `QuoteIdentifier`.

## Consequences

- No client string reaches SQL text; quoting is per dialect and covered by a
  conformance test with a name containing spaces, `"` and `` ` ``.
- Providers no longer validate names themselves; that contract lives in studio and is
  tested there on every dialect.
- A table dropped outside NexusQL stays cached until the next refresh, and its queries
  then fail with the database's own error.
