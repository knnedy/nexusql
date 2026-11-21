# 7. Local-only by default; explicit, token-protected exposure

Date: 2026-11-21

## Status

Accepted

## Context

NexusQL has no user accounts, and whoever reaches its port can read and change the
connected database. Binding beyond loopback used to need only `-host 0.0.0.0`, with no
warning. Even on loopback, a malicious web page could reach the API through DNS
rebinding (attacker hostname resolving to 127.0.0.1) or by sending cross-site POSTs.

## Decision

- Bind `127.0.0.1` by default. A non-loopback `-host` is refused unless `-expose` is
  also given.
- With `-expose`, a random 256-bit token is generated per run and printed in the
  banner URL. Every request (UI and API) needs it, as `?token=` (swapped for an
  HttpOnly, SameSite=Strict cookie plus a redirect), a cookie, or `Authorization: Bearer`.
- Without `-expose`, requests whose `Host` is not a loopback name are rejected (DNS
  rebinding).
- State-changing requests (anything but GET/HEAD/OPTIONS) with an `Origin` header
  must come from the server's own origin, or the Next dev server in dev mode.

## Consequences

- A stray page in the user's browser cannot drive the API.
- Exposed use needs the printed URL once per browser; the token rotates on restart.
- No TLS: on untrusted networks, exposed mode should sit behind an SSH tunnel or a
  TLS proxy. The token travels in clear text over plain HTTP.
