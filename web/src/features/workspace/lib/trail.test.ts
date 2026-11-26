import { describe, expect, it } from "vitest";
import type { Relation } from "@/shared/types/schema";
import { EMPTY_TRAIL, stepTrail, trailHops } from "./trail";

const rel = (source: string, field: string, target: string): Relation => ({
  constraintName: `fk_${source}_${field}`,
  sourceTable: source,
  sourceField: field,
  sourceFields: [field],
  targetTable: target,
  targetField: "id",
  targetFields: ["id"],
  onDelete: "NO ACTION",
  onUpdate: "NO ACTION",
});

const RELATIONS = [
  rel("orders", "customer_id", "customers"),
  rel("order_items", "order_id", "orders"),
  rel("payments", "order_id", "orders"),
  rel("customers", "org_id", "organizations"),
];

const walk = (...tables: (string | null)[]) => tables.reduce((t, name) => stepTrail(t, name, RELATIONS), EMPTY_TRAIL);

describe("stepTrail", () => {
  it("grows while each table is linked to the last, either way round", () => {
    const t = walk("customers", "orders", "order_items");
    expect(t).toEqual({ tables: ["customers", "orders", "order_items"], at: 2 });
    expect(trailHops(t, RELATIONS)).toEqual(["customer_id", "order_id"]);
  });

  it("going back keeps the trail, and a new link from there drops what came after", () => {
    const back = walk("customers", "orders", "order_items", "orders");
    expect(back).toEqual({ tables: ["customers", "orders", "order_items"], at: 1 });
    expect(stepTrail(back, "payments", RELATIONS)).toEqual({ tables: ["customers", "orders", "payments"], at: 2 });
  });

  it("starts over on a table with no link to the current one, and empties on none", () => {
    expect(walk("customers", "orders", "organizations")).toEqual({ tables: ["organizations"], at: 0 });
    expect(walk("customers", "orders", null)).toEqual(EMPTY_TRAIL);
  });
});
