# 1. Record architecture decisions

Date: 2026-11-21

## Status

Accepted

## Context

NexusQL is growing (three SQL dialects, two studio modes, an embedded frontend) and
contributors need to know why the code is shaped the way it is, not just how.

## Decision

We record significant architectural decisions as Architecture Decision Records in
`docs/adr/`, using Michael Nygard's format (Title, Status, Context, Decision,
Consequences). Files are numbered sequentially: `NNNN-short-title.md`. A superseded
ADR is kept and marked `Superseded by NNNN`.

## Consequences

- Structural changes (new packages, moved boundaries, new dependencies with wide
  reach) come with an ADR in the same commit or the commit before.
- Reviewers can point to an ADR instead of re-arguing a settled decision.
