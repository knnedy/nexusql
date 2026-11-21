# 4. Exporter registry for schema export

Date: 2026-11-21

## Status

Accepted

## Context

`internal/api/export.go` imports the postgres, mysql and sqlite packages and
switches on provider kind to call their Prisma/Drizzle generators. This breaks the
rule that no dialect-specific code leaks above the Provider interface, and every
new dialect would need an edit in the HTTP layer.

## Decision

Add an `Exporter` interface to `internal/db`:

```go
type Exporter interface {
    Prisma(*Schema) string
    Drizzle(*Schema) string
}
```

Each dialect registers its exporter alongside its provider constructor in
`init()`. Callers use `db.ExporterFor(kind)`. Export stays a separate interface
rather than more Provider methods because it is a pure function of the schema and
needs no live connection.

## Consequences

- `internal/api` no longer imports any dialect package.
- Exporters can be unit-tested from a hand-built `Schema` with no database.
