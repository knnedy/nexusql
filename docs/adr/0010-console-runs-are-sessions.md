# 10. Console runs are scanned, then run as one session

Date: 2026-11-21

## Status

Accepted

## Context

The console decided whether SQL was safe from its first keyword. `WITH d AS (...) DELETE`,
`SELECT 1; DROP TABLE t` and `/* x */ DELETE` all ran without confirmation, while `SHOW`,
`PRAGMA table_info` and `VALUES` were sent down the write path and showed no rows.
Multi-statement input behaved differently per driver: MySQL rejected it, pgx's prepared
path rejected it, and SQLite ran only the first statement.

Every statement also ran on whichever pooled connection was free. `BEGIN; ...; ROLLBACK`
could span three connections. Settings, temp tables and open transactions were left on
pooled connections that the explorer then used. On SQLite, which has one connection, a
console `PRAGMA foreign_keys = OFF` changed it for the whole app.

## Decision

- `internal/sqlscan` lexes console SQL (strings, quoted identifiers, comments, Postgres
  dollar quotes and nested comments, MySQL `#` comments and backslash escapes, trigger and
  procedure bodies). It splits the input into statements and classifies each one as a write
  and/or a result set. Statements it does not recognise count as writes.
- Each provider names its lexical rules (`Provider.Syntax`). Studio splits the input once and
  asks for confirmation if any statement may write. It passes the statements to
  `Provider.ExecuteScript`, so studio never knows the dialect.
- A run takes one connection, runs the statements in order and returns the last statement's
  result, as `psql -c` does. The rows-affected counts of all writes are added together.
- When the run did anything but plain reads, failed, or was cut off at the row cap, its
  connection is closed rather than returned to the pool. That ends any transaction, setting,
  lock or temp table it left. An in-memory SQLite database has a single connection that
  *is* the database, so it is kept and only gets a `ROLLBACK`.

## Consequences

- Session state does not carry over between runs: `SET search_path` or a temp table lasts
  for one run. Put the statements that need it in the same run.
- An unfinished `BEGIN` is rolled back when the run ends, never committed.
- SQLite connections enforce foreign keys (`_pragma=foreign_keys(1)` on every connection;
  the kept in-memory session is reset to it), so `PRAGMA foreign_keys = OFF` lasts one run.
- Statements that return rows but are not recognised (`CALL` with results, `FETCH`) run as
  writes and show a count, not rows.
- Side effects hidden in functions (`SELECT nextval(...)`, `set_config`) are not seen by
  the classifier. Step 12's read-only mode is enforced by the database for that reason.
