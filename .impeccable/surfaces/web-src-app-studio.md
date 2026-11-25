---
version: 1
slug: "web-src-app-studio"
primary_target: "web/src/app/studio"
related_targets: ["web/src/features"]
---

# Studio workspace

Mode: Operate. One workspace for a connected database: diagram, data, structure and export as views of the selected table, with SQL docked.

## Direction contract

THESIS: The schema is the map you walk. Every view shows where you are and how you got there; it refuses the category default of separate canvas and table-browser apps behind a mode switch.

OWN-WORLD: Neutral warm-paper surfaces (light) and graphite (dark), hairline rules, Geist and Geist Mono. Coral marks only the current table and primary actions; teal marks only relationships. Cards 11px radius, controls 7px, chips pill-round. No coloured chrome.

STORY: A developer or newcomer opens a database, sees its tables grouped by how they link, follows a key from table to table, and reads, edits, queries or exports from wherever they stand.

FIRST VIEWPORT: Neutral top bar (icon, project, centred Ctrl+K search, connection, access, theme). Left tables sidebar: filter, "Linked to <table>" with direction and key column, then grouped tables with row-count bars. Context bar: relationship trail chips, view tabs, Details. Diagram fills the rest with a floating details card; SQL dock collapsed at the bottom.

FORM: seed: none (pinned). User chose "One workspace, views", "Instrument", "Foundations, then layout, then screens", then from comps: "i think i need a sidebar for tables", top bar "neutral".

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
