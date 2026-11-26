---
name: NexusQL
description: Local-first SQL data studio where the schema is the map you walk.
colors:
  ground: "#f7f6f2"
  panel: "#ffffff"
  sunk: "#efede7"
  raised: "#ffffff"
  line: "#e3e0d8"
  line-strong: "#cdc9bf"
  fg: "#17181a"
  fg-muted: "#4a4d52"
  fg-subtle: "#63676e"
  accent: "#b4411b"
  accent-fill: "#c24a22"
  on-accent: "#ffffff"
  accent-tint: "#f9e6dd"
  accent-line: "#e2a083"
  relation: "#0b7356"
  relation-line: "#1d9e75"
  relation-tint: "#dcf1e9"
  relation-faint: "#bcdccf"
  warn: "#8a5a00"
  warn-tint: "#fbefd4"
  danger: "#b42318"
  danger-tint: "#fdecea"
  grid-dot: "#dad6cc"
  dark-ground: "#0f1112"
  dark-panel: "#16191b"
  dark-sunk: "#121416"
  dark-raised: "#1c2023"
  dark-line: "#24282c"
  dark-line-strong: "#343a40"
  dark-fg: "#ecedee"
  dark-fg-muted: "#b0b4ba"
  dark-fg-subtle: "#959aa2"
  dark-accent: "#f0855f"
  dark-accent-fill: "#f0855f"
  dark-on-accent: "#1a0d08"
  dark-accent-tint: "#3a1f15"
  dark-accent-line: "#8d4a32"
  dark-relation: "#4ccfa3"
  dark-relation-line: "#3fbf93"
  dark-relation-tint: "#11312a"
  dark-relation-faint: "#23473d"
  dark-warn: "#f2c063"
  dark-warn-tint: "#3a2e12"
  dark-danger: "#f97066"
  dark-danger-tint: "#3b1715"
  dark-grid-dot: "#1f2327"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  heading:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  subheading:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.35
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.35
  code:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
  code-small:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.3
rounded:
  control: "7px"
  card: "11px"
  panel: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent-fill}"
    textColor: "{colors.on-accent}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "30px"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "30px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.fg-muted}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "30px"
  input:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.fg}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "32px"
  trail-chip:
    backgroundColor: "{colors.relation-tint}"
    textColor: "{colors.relation}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 11px"
    height: "28px"
  trail-chip-current:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.accent}"
    rounded: "{rounded.pill}"
    height: "28px"
  filter-chip:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.fg}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 6px 0 10px"
    height: "28px"
  table-card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg}"
    rounded: "{rounded.card}"
    width: "220px"
  nav-row-selected:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.fg}"
    rounded: "{rounded.control}"
    height: "30px"
---

# Design System: NexusQL

## Overview

**Creative North Star: "The schema is the map you walk"**

NexusQL is an instrument for understanding a database. Every screen answers two questions before any other: where am I in this schema, and how did I get here. The chrome is quiet and neutral so the two colours that carry meaning can be read at a glance: coral is *you are here* (the current table, the primary action), teal is *these are connected* (keys, links, the trail you followed).

Density is that of a working tool: 13px body, 30–36px rows, hairline rules instead of boxes, and tabular numbers wherever counts line up. Newcomers get plain labels ("Points to", "Pointed to by", "Linked to orders"); regulars get keyboard paths (Ctrl+K, Ctrl+B, Ctrl+J, `/`). Light and dark themes are equal citizens, built from the same token roles.

The user rejected: two separate apps for canvas and explorer, a coloured top bar (teal read as a third competing colour mass), and the old drawer-based export with clipped code.

**Key Characteristics:**
- One workspace; Diagram, Data, Structure and Export are views of the selected table.
- A tables sidebar that leads with what is linked to the current table.
- The relationship trail: chips in the context bar plus the same path drawn in teal on the diagram.
- Neutral chrome, two semantic colours, everything else greys.

## Colors

Warm paper and graphite neutrals with two semantic accents; colour is information, never decoration.

### Primary
- **Coral** (accent `#b4411b` light / `#f0855f` dark; fill `#c24a22` / `#f0855f`): the current table (selected row, selected card border, current trail chip, active tab underline) and primary actions (Run, Row, Download). Never used for relationships.

### Secondary
- **Teal** (relation `#0b7356` / `#4ccfa3`; line `#1d9e75` / `#3fbf93`): foreign keys, linked tables, the trail, FK cells, relationship lines on the diagram, the "connected" dot.

### Tertiary
- **Amber** (warn `#8a5a00` / `#f2c063`): pending states, read-write warnings.
- **Red** (danger `#b42318` / `#f97066`): destructive actions and errors only.

### Neutral
- **Ground** (`#f7f6f2` / `#0f1112`): the app background and the diagram canvas.
- **Panel** (`#ffffff` / `#16191b`): top bar, sidebar, context bar, toolbars, cards, dock.
- **Sunk** (`#efede7` / `#121416`): hover rows, pressed segments, footers inside floating panels.
- **Raised** (`#ffffff` / `#1c2023`): popovers and the search panel.
- **Line / Line strong** (`#e3e0d8`, `#cdc9bf` / `#24282c`, `#343a40`): hairlines between rows; control and card borders.
- **Fg / Fg muted / Fg subtle** (`#17181a`, `#4a4d52`, `#63676e` / `#ecedee`, `#b0b4ba`, `#959aa2`): primary text, secondary text and labels, metadata. Every text token clears 4.5:1 on ground, panel, sunk and its tints.

### Named Rules
**The Two Meanings Rule.** Coral means "you are here", teal means "connected". A third hue appears only as a status (warn, danger) or inside a brand mark.

**The Quiet Chrome Rule.** The top bar, sidebar and toolbars are panel-coloured. No chrome surface is ever tinted.

## Typography

**Body Font:** Geist (with ui-sans-serif, system-ui)
**Mono Font:** Geist Mono (with ui-monospace)

**Character:** Geist carries every label and heading; Geist Mono is reserved for things that are literally code: identifiers, types, SQL, generated files, timestamps in grids.

### Hierarchy
- **Display** (600, 24px, 1.2, -0.015em): the one page title on the connect and projects pages, outside the workspace. Never inside it.
- **Heading** (600, 18px, 1.3, -0.01em): the details card title (the table name).
- **Subheading** (600, 16px, 1.35): stat values in the details card.
- **Title** (600, 14px, 1.4): project name, section titles, cluster labels on the diagram.
- **Body** (400 or 500, 13px, 1.45): the default for rows, buttons, tabs, cells.
- **Label** (500, 12px, 1.4): group headers, column headers' second line, counts, toolbar meta.
- **Caption** (400, 11px, 1.35): keyboard hints and key column names under sidebar rows. Nothing smaller exists.
- **Code** (Mono 13px, 1.6) and **Code small** (Mono 11px): SQL, generated files, column names and types.

### Named Rules
**The Six Sizes Rule.** Inside the workspace, text uses 11, 12, 13, 14, 16 or 18px. Display (24px) is the single exception, for page titles outside it. No arbitrary sizes.

**The Honest Mono Rule.** Monospace only for code, identifiers and data. Never for labels or decoration.

## Layout

A fixed application frame at 100vh: 52px top bar spanning the width; a 264px tables sidebar (52px when collapsed with Ctrl+B) running from below the top bar to the bottom; to its right a 48px context bar, the view stage, and the SQL dock (38px collapsed, about 210px open). The details card floats inside the stage (14px inset, 304px wide) rather than taking a permanent column.

Spacing steps are 4, 8, 12, 16 and 24px. Controls are 28–32px tall, rows 30–36px. The sidebar header and the context bar share a 48px height so their rules line up.

## Elevation & Depth

Flat by default; hairlines separate regions. Shadows exist only for things that float above the work.

### Shadow Vocabulary
- **Card** (`0 1px 2px rgba(23,24,26,.06), 0 10px 30px rgba(23,24,26,.08)`; dark `0 1px 2px rgba(0,0,0,.4), 0 10px 28px rgba(0,0,0,.35)`): table cards on the diagram, floating canvas controls.
- **Float** (`0 2px 6px rgba(23,24,26,.08), 0 24px 60px rgba(23,24,26,.16)`; dark uses .5/.55 black): the details card, the search panel, popovers.

### Named Rules
**The Float-Only Shadow Rule.** Anything docked to the frame (bars, sidebar, dock, toolbars) has no shadow.

## Shapes

Controls 7px, table cards 11px, floating panels 12px, chips and trail links fully round. Borders are 1px; selection on a card is a coral border plus a 3px coral-tint ring, never a one-sided bar.

## Components

### Buttons
- **Shape:** 7px radius, 30px tall, 0 12px padding, 13px/500 text with an optional 15px icon.
- **Primary:** accent fill with on-accent text. One per region.
- **Secondary:** panel background, line-strong border. Ghost: no border, fg-muted text.
- **States:** border darkens on hover; `scale(0.97)` on press (160ms ease-out); 2px accent focus ring offset 2px.

### Chips
- **Trail chip:** relation-tint pill with relation text and relation-faint border; the current table's chip uses accent tint, accent-line border and accent text. Between chips, the key column in Code small above a 2px teal arrow.
- **Filter chip:** accent-tint pill, "column is value" with the column and value in 500, and a remove ×.

### Cards / Containers
- **Table card (diagram):** panel, line-strong border, 11px radius, Card shadow. Header 34px with name and row count; column rows 26px with PK (coral) / FK (teal) markers and Mono types. Linked cards take a relation-line border; the selected card a coral border and ring; unrelated cards drop to 50% opacity.
- **Details card:** floating, Float shadow, 12px radius: heading, three stat cells, Relationships ("Points to", "Pointed to by"), Keys and checks, actions.

### Inputs / Fields
- **Style:** 32px, ground background, line-strong border, 7px radius, fg-subtle placeholder.
- **Focus:** accent border plus a 3px accent-tint ring.

### Navigation
- **Top bar:** panel background with a bottom hairline. Icon, project switcher, centred search (560px) that opens the search panel, connection status, Read-only/Read-write segment, theme.
- **Tables sidebar:** header "Tables 16" with collapse; filter (`/`); "Linked to <table>" rows with a → or ← direction glyph and the key column underneath; collapsible groups; rows of 30px with a row-count bar. Selected row: accent tint, 600 weight, coral count bar.
- **View tabs:** 13px, 2px coral underline on the active tab.

### Relationship Trail (signature)
The path of foreign keys the user followed, shown as chips in the context bar and drawn as the strong teal path on the diagram, while other relationship lines stay line-strong grey. Clicking a chip goes back to that table. The connecting lines draw in once when the trail changes (500ms ease-out); never on keyboard navigation.

## Do's and Don'ts

### Do:
- **Do** use coral only for the current table and primary actions, teal only for relationships.
- **Do** show what a key points to wherever a key appears (column headers, cells, sidebar, details).
- **Do** keep every text pairing at 4.5:1 or better in both themes.
- **Do** use tabular numbers for counts and right-align numeric columns.
- **Do** use the real brand marks for export formats.

### Don't:
- **Don't** tint the top bar or any other chrome.
- **Don't** split the diagram and the data browser into separate apps or routes with a mode switch.
- **Don't** put exports in a narrow drawer or clip generated code; the preview wraps and takes the stage.
- **Don't** use text below 11px or sizes outside the six.
- **Don't** use monospace for labels, or a side bar as a selection marker.
- **Don't** open a modal where a view, dock or popover will do.
