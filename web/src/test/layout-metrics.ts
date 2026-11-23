import { getSmoothStepPath, Position, type Edge, type Node } from "@xyflow/react";
import { getNodeHeight, NODE_WIDTH } from "@/features/canvas/lib/canvas-utils";
import type { RelationEdgeData, TableNodeData } from "@/features/canvas/types";

type Point = { x: number; y: number };
type Rect = { id: string; x: number; y: number; w: number; h: number };

export interface LayoutQuality {
  overlaps: number; // table pairs that overlap
  through: number; // edge segments crossing a table's interior
  crossings: number; // edge pairs' segments that cross
  width: number;
  height: number;
}

function rects(nodes: Node<TableNodeData>[]): Map<string, Rect> {
  return new Map(
    nodes.map((n) => [
      n.id,
      { id: n.id, x: n.position.x, y: n.position.y, w: NODE_WIDTH, h: getNodeHeight(n.data.table.fields.length) },
    ]),
  );
}

// The polyline an edge is drawn along: its routed points, else the smooth step the
// edge component draws between the handles (curve corners reduced to their ends).
export function edgePolyline(edge: Edge<RelationEdgeData>, boxes: Map<string, Rect>): Point[] {
  const points = (edge.data as { points?: Point[] } | undefined)?.points;
  if (points?.length) return points;
  const s = boxes.get(edge.source)!;
  const t = boxes.get(edge.target)!;
  const [d] = getSmoothStepPath({
    sourceX: s.x + s.w,
    sourceY: edge.data?.sourceY ?? s.y + s.h / 2,
    sourcePosition: Position.Right,
    targetX: t.x,
    targetY: edge.data?.targetY ?? t.y + t.h / 2,
    targetPosition: Position.Left,
    borderRadius: 16,
    offset: 40,
  });
  const out: Point[] = [];
  for (const [, cmd, args] of d.matchAll(/([MLQ])([^MLQ]*)/g)) {
    const nums = args.trim().split(/[\s,]+/).map(Number);
    const at = cmd === "Q" ? 2 : 0;
    out.push({ x: nums[at], y: nums[at + 1] });
  }
  return out;
}

// Liang-Barsky: does segment a-b enter the rect shrunk by 1px on every side?
function entersRect(a: Point, b: Point, r: Rect): boolean {
  const x0 = r.x + 1, x1 = r.x + r.w - 1, y0 = r.y + 1, y1 = r.y + r.h - 1;
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  for (const [p, q] of [[-dx, a.x - x0], [dx, x1 - a.x], [-dy, a.y - y0], [dy, y1 - a.y]]) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
      if (t0 > t1) return false;
    }
  }
  return t1 - t0 > 1e-9;
}

function cross(o: Point, a: Point, b: Point) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

// Proper crossing only: touching ends and collinear overlaps (shared trunks) don't count.
function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  const e = 1e-6;
  return ((d1 > e && d2 < -e) || (d1 < -e && d2 > e)) && ((d3 > e && d4 < -e) || (d3 < -e && d4 > e));
}

export function measureLayout(nodes: Node<TableNodeData>[], edges: Edge<RelationEdgeData>[]): LayoutQuality {
  const boxes = rects(nodes);
  const list = [...boxes.values()];
  let overlaps = 0;
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlaps++;
    }

  const segs: { edge: number; a: Point; b: Point }[] = [];
  edges.forEach((edge, i) => {
    const line = edgePolyline(edge, boxes);
    for (let k = 1; k < line.length; k++) segs.push({ edge: i, a: line[k - 1], b: line[k] });
  });

  let through = 0;
  for (const s of segs) for (const r of list) if (entersRect(s.a, s.b, r)) through++;

  let crossings = 0;
  const box = (s: (typeof segs)[number]) => ({
    x0: Math.min(s.a.x, s.b.x), x1: Math.max(s.a.x, s.b.x), y0: Math.min(s.a.y, s.b.y), y1: Math.max(s.a.y, s.b.y),
  });
  const bb = segs.map(box);
  for (let i = 0; i < segs.length; i++)
    for (let j = i + 1; j < segs.length; j++) {
      if (segs[i].edge === segs[j].edge) continue;
      const p = bb[i], q = bb[j];
      if (p.x1 < q.x0 || q.x1 < p.x0 || p.y1 < q.y0 || q.y1 < p.y0) continue;
      if (crosses(segs[i].a, segs[i].b, segs[j].a, segs[j].b)) crossings++;
    }

  const xs = list.flatMap((r) => [r.x, r.x + r.w]);
  const ys = list.flatMap((r) => [r.y, r.y + r.h]);
  return {
    overlaps,
    through,
    crossings,
    width: Math.round(Math.max(...xs) - Math.min(...xs)),
    height: Math.round(Math.max(...ys) - Math.min(...ys)),
  };
}
