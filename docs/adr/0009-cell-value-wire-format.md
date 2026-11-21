# 9. Cell value wire format

Date: 2026-11-21

## Status

Accepted

## Context

Row values travel to the browser as JSON and are parsed by JavaScript, whose numbers
are doubles. Drivers returned whatever Go type they chose, and `encoding/json` took it
from there: bigints above 2^53 and Postgres numerics were rounded in the browser, a NaN
float made the whole response fail to encode, timestamps without a time zone gained a
false `Z`, dates became midnight UTC timestamps, and binary data turned into base64 that
looked like text.

## Decision

Every provider maps driver values to one dialect-neutral JSON form (`internal/db/wire.go`),
for both table rows and console results:

| Kind | JSON |
|---|---|
| integer within ±(2^53−1) | number |
| integer beyond that | decimal string |
| decimal / numeric | decimal string (exact digits) |
| float | number; `"NaN"`, `"Infinity"`, `"-Infinity"` as strings |
| timestamp without time zone | `"2026-01-02T03:04:05.5"` (no offset) |
| timestamp with time zone | UTC, `"2026-01-02T00:04:05Z"` |
| date | `"2026-01-02"` |
| JSON / JSONB | the JSON value itself |
| binary | `"\xdeadbeef"` (Postgres bytea hex form) |
| NULL | `null` |

Each provider decides the kind from what only it knows: Postgres type OIDs, MySQL
driver type names (with the session time zone pinned to UTC), SQLite declared types.
Expected JSON per dialect lives in each harness's `Values` fixture.

## Consequences

- The browser never rounds a value; a column may mix numbers and strings only for
  integers, by magnitude.
- Known dialect limits, asserted by the fixtures: MySQL `BOOLEAN` (TINYINT(1)) stays
  0/1 because the driver reports only TINYINT; SQLite `NUMERIC` is stored as REAL;
  SQLite datetimes stored without an offset are shown without one (the driver parses
  them as UTC, so an explicit `Z` is also shown without one).
