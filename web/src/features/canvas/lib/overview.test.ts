import { describe, expect, it } from "vitest";
import type { Edge } from "@xyflow/react";
import type { Field } from "@/shared/types/schema";
import type { RelationEdgeData } from "@/features/canvas/types";
import { generateSchema } from "@/test/schema-gen";
import { buildCanvasGraph } from "./canvas-utils";
import { getNodeHeight, keyFields, keysCardHeight, NODE_WIDTH, tableBoxHeight } from "./card";
import { centreBeside, connector, detailAt, firstView, groupLinks, routeLinks } from "./overview";

const f = (name: string, key: "PK" | "FK" | "" = ""): Field =>
  ({ name, type: "integer", nullable: false, isPrimaryKey: key === "PK", isForeignKey: key === "FK" }) as Field;

describe("detail by zoom", () => {
  it("shows every column from 75%, keys from 30%, blocks below", () => {
    expect([1.5, 0.75, 0.74, 0.3, 0.29, 0.02].map(detailAt)).toEqual(["full", "full", "keys", "keys", "blocks", "blocks"]);
  });
});

describe("keys card", () => {
  it("keeps keys and referenced columns, in table order", () => {
    const fields = [f("id", "PK"), f("email"), f("code"), f("org_id", "FK")];
    expect(keyFields(fields, ["code"]).map((x) => x.name)).toEqual(["id", "code", "org_id"]);
  });

  it("is the comp's card scaled to the full card's width: 32 header, 22 per key row, one row for the rest", () => {
    // 2 keys + "+ 2 more" = (32 + 3 * 22 + 2 borders) * 240 / 168
    expect(keysCardHeight([f("id", "PK"), f("email"), f("name"), f("org_id", "FK")])).toBeCloseTo(100 * (240 / 168));
    // only keys: no "more" row
    expect(keysCardHeight([f("a_id", "FK"), f("b_id", "FK")])).toBeCloseTo(78 * (240 / 168));
  });

  it("gets room in the layout even when it is taller than the full card", () => {
    const join = ["a", "b", "c", "d", "e", "g"].map((x) => f(`${x}_id`, "FK"));
    expect(keysCardHeight(join)).toBeGreaterThan(getNodeHeight(6));
    expect(tableBoxHeight(join)).toBe(keysCardHeight(join));
    const wide = [f("id", "PK"), ...Array.from({ length: 9 }, (_, i) => f(`c${i}`))];
    expect(tableBoxHeight(wide)).toBe(getNodeHeight(10));
  });

  it("never overlaps another table's card when zoomed out", async () => {
    const { nodes } = await buildCanvasGraph(generateSchema(150), "postgres");
    const boxes = nodes.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y, b: n.position.y + keysCardHeight(n.data.table.fields, n.data.referenced) }));
    const hits = boxes.flatMap((a, i) =>
      boxes.slice(i + 1).filter((b) => a.x < b.x + NODE_WIDTH && b.x < a.x + NODE_WIDTH && a.y < b.b && b.y < a.b).map((b) => `${a.id}/${b.id}`),
    );
    expect(hits).toEqual([]);
  }, 30_000);
});

const edge = (source: string, target: string, sourceField = `${target}_id`): Edge<RelationEdgeData> => ({
  id: `${source}_${sourceField}`,
  source,
  target,
  data: { relation: { sourceTable: source, sourceField, targetTable: target, targetField: "id" } } as RelationEdgeData,
});

describe("group links", () => {
  const group: Record<string, string> = { orders: "g:o", items: "g:o", products: "g:p", reviews: "g:p", users: "g:u" };

  it("folds the keys between two groups into one link with a count, either direction", () => {
    const links = groupLinks(
      [edge("items", "products"), edge("reviews", "orders"), edge("items", "orders"), edge("reviews", "users"), edge("orders", "users")],
      (t) => group[t],
    );
    expect(links).toEqual([
      { a: "g:o", b: "g:p", count: 2, title: "items.products_id → products\nreviews.orders_id → orders" },
      { a: "g:o", b: "g:u", count: 1, title: "orders.users_id → users" },
      { a: "g:p", b: "g:u", count: 1, title: "reviews.users_id → users" },
    ]);
  });

  it("leaves out lines into hub tables", () => {
    const hub = { ...edge("items", "products"), data: { ...edge("items", "products").data!, hub: true } };
    expect(groupLinks([hub], (t) => group[t])).toEqual([]);
  });
});

describe("connector", () => {
  it("drops straight down between regions stacked over a shared span, chip halfway", () => {
    const c = connector({ x: 0, y: 0, w: 400, h: 200 }, { x: 200, y: 300, w: 400, h: 100 });
    expect(c.points).toEqual([{ x: 300, y: 200 }, { x: 300, y: 300 }]);
    expect(c.chip).toEqual({ x: 300, y: 250 });
  });

  it("runs straight across between regions side by side", () => {
    const c = connector({ x: 500, y: 100, w: 100, h: 100 }, { x: 0, y: 0, w: 300, h: 160 });
    expect(c.points).toEqual([{ x: 500, y: 130 }, { x: 300, y: 130 }]);
  });

  it("bends once between regions that share no span", () => {
    const c = connector({ x: 0, y: 0, w: 100, h: 100 }, { x: 300, y: 300, w: 100, h: 100 });
    expect(c.points).toEqual([{ x: 50, y: 100 }, { x: 50, y: 350 }, { x: 300, y: 350 }]);
  });
});

describe("routed group links", () => {
  const boxes = new Map([
    ["top", { x: 0, y: 0, w: 300, h: 100 }],
    ["mid", { x: 0, y: 200, w: 300, h: 100 }],
    ["low", { x: 0, y: 400, w: 300, h: 100 }],
  ]);
  const link = (a: string, b: string) => ({ a, b, count: 1, title: "" });

  it("draws links between neighbours and drops one that would cross a third group", () => {
    const lines = routeLinks([link("top", "mid"), link("mid", "low"), link("low", "top")], boxes);
    expect(lines.map((l) => `${l.a}-${l.b}`)).toEqual(["top-mid", "mid-low"]);
  });
});

describe("first view", () => {
  const pane = { w: 1000, h: 800 };

  it("fits the whole schema when it reads at that zoom", () => {
    // 920 x 736 of room: a 1000 x 600 schema fits at 0.92, centred.
    const v = firstView({ x: 0, y: 0, w: 1000, h: 600 }, pane, 12);
    expect(v.zoom).toBeCloseTo(0.92);
    expect(v.x).toBeCloseTo(40);
    expect(v.y).toBeCloseTo(124);
  });

  // The most-linked table of the largest group, 240 wide.
  const hub = { x: 500, y: 300, w: 240, h: 400 };

  it("opens a schema of up to 50 tables at 100% on its most-linked table when it does not fit with full cards", () => {
    // Fits only at 0.6: keys cards, not columns. Centre the hub at 100% instead.
    const v = firstView({ x: 0, y: 0, w: 1530, h: 1000 }, pane, 22, hub);
    expect(v).toEqual({ zoom: 1, x: 500 - 620, y: 400 - 500 });
  });

  it("keeps a tall table's header below the canvas toolbar", () => {
    const tall = { ...hub, h: 900 };
    expect(firstView({ x: 0, y: 0, w: 4000, h: 3000 }, pane, 22, tall, 64).y).toBe(64 - 300);
  });

  it("fits the whole schema when there is no table to start on", () => {
    expect(firstView({ x: 0, y: 0, w: 4000, h: 3000 }, pane, 22).zoom).toBeCloseTo(0.23);
  });

  it("fits a larger schema whole, however small", () => {
    expect(firstView({ x: 0, y: 0, w: 9200, h: 7360 }, pane, 51, hub).zoom).toBeCloseTo(0.1);
  });

  it("does not blow a tiny schema up past 100%", () => {
    expect(firstView({ x: 0, y: 0, w: 200, h: 100 }, pane, 2).zoom).toBe(1);
  });
});

describe("centring a chosen table", () => {
  const pane = { w: 1200, h: 800 };
  const t = { x: 1000, y: 500, w: 240, h: 300 };

  it("puts the table in the middle of the space left of the details card", () => {
    // 1200 - 328 of card = 872 free: the table's centre lands at x 436.
    const v = centreBeside(t, pane, 328, 1);
    expect(v).toEqual({ zoom: 1, x: 436 - 1120, y: 400 - 650 });
  });

  it("uses the whole pane when the card is closed", () => {
    expect(centreBeside(t, pane, 0, 1).x).toBe(600 - 1120);
  });

  it("zooms in to full cards, never out", () => {
    expect(centreBeside(t, pane, 0, 0.3).zoom).toBe(1);
    expect(centreBeside(t, pane, 0, 1.5).zoom).toBe(1.5);
  });

  it("keeps a tall table's header in view", () => {
    expect(centreBeside({ ...t, h: 1200 }, pane, 0, 1).y).toBe(32 - 500);
  });
});
