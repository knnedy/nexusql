# 11. Read-only mode is enforced by the database

Date: 2026-11-21

## Status

Accepted

## Context

Users need a safe mode for looking around a database they care about. The console's
statement classifier (ADR 0010) cannot be that guard. It cannot see side effects inside
functions, and it treats unknown statements as writes, which is only good for asking for
confirmation. The guard has to be something the database itself refuses to break.

## Decision

Read-only is a per-connection switch held by studio (`GET`/`PUT /api/connection/read-only`).
Every new connection starts read-write. While it is on:

- Console runs use the database's own read-only mode inside the run's session:
  - Postgres: `BEGIN READ ONLY`, then a `SELECT 1`. After a transaction's first query,
    Postgres refuses `SET TRANSACTION READ WRITE`. Before each statement the provider
    checks that the transaction is still open, so a `COMMIT` ends the run instead of
    letting the rest autocommit. Statements go over the extended protocol, which
    accepts one statement per message.
  - MySQL: `SET SESSION TRANSACTION READ ONLY`. Session level is required: in tests,
    `START TRANSACTION READ ONLY` let `CREATE TABLE` through via DDL's implicit commit.
  - SQLite: `PRAGMA query_only = ON`, undone on the kept in-memory connection.
- Studio refuses statements that name a way out of this mode (`READ WRITE`,
  `*_read_only`, `query_only`), so it cannot be switched off from inside a run.
- No confirmation is asked, since nothing can change. Row edits and seeding return 409.

## Consequences

- Writes fail with the database's own error, such as "cannot execute CREATE TABLE in a
  read-only transaction" or "attempt to write a readonly database".
- This is a safety net against accidental writes, not access control. Anyone with the
  URI's credentials can write by switching the mode off. Real protection is a database
  role without write grants.
- Writes outside the database are not covered, such as `COPY ... TO PROGRAM` for a
  superuser or `SELECT ... INTO OUTFILE`.
- The mode is not saved with the project. Reconnecting starts read-write.
