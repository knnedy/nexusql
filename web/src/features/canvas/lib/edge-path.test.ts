import { describe, expect, it } from "vitest";
import { routedPath } from "./edge-path";

// An L-shaped route as ELK returns it: right, down, right.
const ROUTE = [
  { x: 260, y: 61 },
  { x: 300, y: 61 },
  { x: 300, y: 161 },
  { x: 400, y: 161 },
];

describe("routedPath", () => {
  it("follows the route from the live handles, rounding each bend", () => {
    // React Flow puts handles at the 8px dot's outer edge: 4px outside the node.
    const r = routedPath(ROUTE, { x: 264, y: 61 }, { x: 396, y: 161 }, 8)!;
    expect(r.path).toBe("M 264 61 L 292 61 Q 300 61 300 69 L 300 153 Q 300 161 308 161 L 396 161");
  });

  it("keeps a bend's radius within half of the shorter neighbouring segment", () => {
    const tight = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 100 }, { x: 50, y: 100 }];
    const r = routedPath(tight, { x: 0, y: 0 }, { x: 50, y: 100 }, 16)!;
    expect(r.path).toBe("M 0 0 L 5 0 Q 10 0 10 5 L 10 84 Q 10 100 26 100 L 50 100");
  });

  it("puts the label halfway along the route", () => {
    const r = routedPath(ROUTE, { x: 260, y: 61 }, { x: 400, y: 161 }, 0)!;
    // Lengths 40 + 100 + 100: halfway (120) is 80 down the vertical leg.
    expect(r.label).toEqual({ x: 300, y: 141 });
  });

  it.each([
    ["a dragged source", { x: 300, y: 90 }, { x: 396, y: 161 }],
    ["a dragged target", { x: 264, y: 61 }, { x: 396, y: 200 }],
    ["a target nudged sideways", { x: 264, y: 61 }, { x: 420, y: 161 }],
  ])("gives up on the route after %s", (_, source, target) => {
    expect(routedPath(ROUTE, source, target, 8)).toBeNull();
  });

  it("needs at least two points", () => {
    expect(routedPath([], { x: 0, y: 0 }, { x: 1, y: 1 }, 8)).toBeNull();
    expect(routedPath(undefined, { x: 0, y: 0 }, { x: 1, y: 1 }, 8)).toBeNull();
  });
});
