import type { Edge } from "@xyflow/react";
import type { RelationEdgeData } from "@/features/canvas/types";

/** How much a table card shows at a zoom level. */
export type Detail = "full" | "keys" | "blocks";

// Below 75% column text is too small to read; below 30% so are the keys.
const KEYS_BELOW = 0.75;
const BLOCKS_BELOW = 0.3;

export function detailAt(zoom: number): Detail {
  return zoom >= KEYS_BELOW ? "full" : zoom >= BLOCKS_BELOW ? "keys" : "blocks";
}

/** A connector between two groups standing in for the keys between them. */
export interface GroupLink {
  /** Group node ids, a before b. */
  a: string;
  b: string;
  count: number;
  /** The keys it stands for, one per line. */
  title: string;
}

export function groupLinks(edges: Edge<RelationEdgeData>[], groupOf: (table: string) => string): GroupLink[] {
  const pairs = new Map<string, { a: string; b: string; keys: string[] }>();
  for (const e of edges) {
    const r = e.data?.relation;
    if (!r || e.data?.hub) continue;
    const [ga, gb] = [groupOf(r.sourceTable), groupOf(r.targetTable)].sort();
    if (ga === gb) continue;
    const id = `${ga}\u0000${gb}`;
    if (!pairs.has(id)) pairs.set(id, { a: ga, b: gb, keys: [] });
    pairs.get(id)!.keys.push(`${r.sourceTable}.${r.sourceField} → ${r.targetTable}`);
  }
  return [...pairs.values()]
    .sort((x, y) => x.a.localeCompare(y.a) || x.b.localeCompare(y.b))
    .map(({ a, b, keys }) => ({ a, b, count: keys.length, title: keys.sort().join("\n") }));
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A straight or elbowed line between the facing sides of two regions, and where its chip sits. */
export function connector(a: Box, b: Box): { points: { x: number; y: number }[]; chip: { x: number; y: number } } {
  const [aR, aB, bR, bB] = [a.x + a.w, a.y + a.h, b.x + b.w, b.y + b.h];
  const mid = (p: { x: number; y: number }, q: { x: number; y: number }) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const [xLo, xHi, yLo, yHi] = [Math.max(a.x, b.x), Math.min(aR, bR), Math.max(a.y, b.y), Math.min(aB, bB)];
  if (xLo < xHi) {
    const x = (xLo + xHi) / 2;
    const points = aB <= b.y ? [{ x, y: aB }, { x, y: b.y }] : [{ x, y: a.y }, { x, y: bB }];
    return { points, chip: mid(points[0], points[1]) };
  }
  if (yLo < yHi) {
    const y = (yLo + yHi) / 2;
    const points = aR <= b.x ? [{ x: aR, y }, { x: b.x, y }] : [{ x: a.x, y }, { x: bR, y }];
    return { points, chip: mid(points[0], points[1]) };
  }
  // Leave a through its top or bottom, turn once, enter b through its facing side.
  const x = a.x + a.w / 2;
  const y = b.y + b.h / 2;
  const points = [{ x, y: aB <= b.y ? aB : a.y }, { x, y }, { x: aR <= b.x ? b.x : bR, y }];
  return { points, chip: mid(points[0], points[1]) };
}

/** Connectors to draw: each link's line, unless it would cut through another group. */
export function routeLinks(links: GroupLink[], boxes: Map<string, Box>): (GroupLink & ReturnType<typeof connector>)[] {
  return links.flatMap((l) => {
    const [a, b] = [boxes.get(l.a), boxes.get(l.b)];
    if (!a || !b) return [];
    const line = connector(a, b);
    const others = [...boxes].filter(([id]) => id !== l.a && id !== l.b).map(([, box]) => box);
    const crosses = line.points.slice(1).some((q, i) => others.some((r) => cuts(line.points[i], q, r)));
    return crosses ? [] : [{ ...l, ...line }];
  });
}

// Whether a horizontal or vertical segment passes through a box's interior.
function cuts(p: { x: number; y: number }, q: { x: number; y: number }, r: Box): boolean {
  const [x0, x1, y0, y1] = [Math.min(p.x, q.x), Math.max(p.x, q.x), Math.min(p.y, q.y), Math.max(p.y, q.y)];
  return x0 < r.x + r.w && x1 > r.x && y0 < r.y + r.h && y1 > r.y;
}

// Up to this many tables, the first view always shows a table's columns (the user's cap).
export const FIT_ALL_ABOVE = 50;
// Full cards, with every column, show from here (see detailAt).
const FULL_ZOOM = KEYS_BELOW;
// The margin around the schema, as a share of the pane on each side.
const PAD = 0.04;

/** Where the diagram opens: the whole schema if its columns read, else 100% on the given table. */
export function firstView(
  bounds: Box,
  pane: { w: number; h: number },
  tables: number,
  /** The table to open on: the most-linked of the largest group. */
  anchor?: Box,
  /** Pixels kept clear above, for controls floating there. */
  top = 0,
): { x: number; y: number; zoom: number } {
  const [padX, padY] = [pane.w * PAD, pane.h * PAD];
  const fit = Math.min(1, (pane.w - 2 * padX) / bounds.w, (pane.h - 2 * padY) / bounds.h);
  if (fit < FULL_ZOOM && tables <= FIT_ALL_ABOVE && anchor) {
    // Centred, unless that would tuck its header under the controls.
    const y = Math.max(pane.h / 2 - (anchor.y + anchor.h / 2), Math.max(padY, top) - anchor.y);
    return { zoom: 1, x: pane.w / 2 - (anchor.x + anchor.w / 2), y };
  }
  return {
    zoom: fit,
    x: (pane.w - bounds.w * fit) / 2 - bounds.x * fit,
    y: (pane.h - bounds.h * fit) / 2 - bounds.y * fit,
  };
}
