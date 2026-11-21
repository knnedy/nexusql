# 3. Layering and dependency rule

Date: 2026-11-21

## Status

Accepted

## Context

HTTP handlers currently look up the session, validate input, introspect the schema
and call providers directly. Validation logic is duplicated and inconsistent, and
dialect details (the `"public"` schema, imports of dialect packages for export)
have leaked into `internal/api`.

## Decision

Dependencies point one way only:

```
cmd/nexusql → server → api → studio → db (interfaces + types) ← db/{postgres,mysql,sqlite}
                                    → seed → db
                                    → session, projects
```

- `api` handles transport only: parse, call `studio`, map errors to status codes.
- `studio` is the application service. It owns the active connection, validates
  every client-supplied identifier against introspected schema, and applies
  timeouts, limits and read-only rules.
- `db` defines interfaces and canonical types. Nothing above `db` imports a
  dialect package; dialects register themselves via `init()` (blank-imported in
  `cmd/nexusql`).
- `seed` depends only on `db` interfaces.

## Consequences

- Identifier validation and safety rules have exactly one home, which Stage 2 fills.
- Handlers become thin and uniform; the service is testable with the SQLite provider
  and no HTTP.
- Introducing `studio` touches every handler once. It starts as a pass-through so
  the move itself changes no behaviour.
