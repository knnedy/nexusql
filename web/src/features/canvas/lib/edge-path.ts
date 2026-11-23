type Point = { x: number; y: number };

// React Flow's handle point sits on the 8px dot's outer edge, a few px off ELK's port.
const SLACK_X = 6;
const SLACK_Y = 2;

const fmt = (n: number) => String(Math.round(n * 10) / 10);
const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/** Moves a route's end to the live handle, keeping its first leg straight. */
function snap(points: Point[], at: number, next: number, to: Point): void {
  const end = points[at];
  const neighbour = points[next];
  if (neighbour.y === end.y) neighbour.y = to.y;
  else if (neighbour.x === end.x) neighbour.x = to.x;
  points[at] = { ...to };
}

/**
 * The SVG path along an ELK route, with each bend rounded, and its midpoint for
 * the label. Null when the handles no longer sit at the route's ends (a dragged table).
 */
export function routedPath(
  route: Point[] | undefined,
  source: Point,
  target: Point,
  radius: number,
): { path: string; label: Point } | null {
  if (!route || route.length < 2) return null;
  const first = route[0];
  const last = route[route.length - 1];
  const off = (a: Point, b: Point) => Math.abs(a.x - b.x) > SLACK_X || Math.abs(a.y - b.y) > SLACK_Y;
  if (off(first, source) || off(last, target)) return null;

  const pts = route.map((p) => ({ ...p }));
  snap(pts, 0, 1, source);
  snap(pts, pts.length - 1, pts.length - 2, target);

  let path = `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]];
    const r = Math.min(radius, dist(a, b) / 2, dist(b, c) / 2);
    const inT = r / (dist(a, b) || 1);
    const outT = r / (dist(b, c) || 1);
    const before = { x: b.x + (a.x - b.x) * inT, y: b.y + (a.y - b.y) * inT };
    const after = { x: b.x + (c.x - b.x) * outT, y: b.y + (c.y - b.y) * outT };
    path += ` L ${fmt(before.x)} ${fmt(before.y)} Q ${fmt(b.x)} ${fmt(b.y)} ${fmt(after.x)} ${fmt(after.y)}`;
  }
  const end = pts[pts.length - 1];
  path += ` L ${fmt(end.x)} ${fmt(end.y)}`;

  let half = pts.slice(1).reduce((sum, p, i) => sum + dist(pts[i], p), 0) / 2;
  let label = pts[0];
  for (let i = 1; i < pts.length; i++) {
    const len = dist(pts[i - 1], pts[i]);
    if (half <= len) {
      const t = half / (len || 1);
      label = { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t };
      break;
    }
    half -= len;
  }
  return { path, label };
}
