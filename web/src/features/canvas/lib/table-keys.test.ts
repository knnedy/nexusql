import { describe, expect, it } from "vitest";
import type { Field, Relation, Table } from "@/shared/types/schema";
import { tableKeys } from "./table-keys";

const field = (name: string, extra: Partial<Field> = {}): Field =>
  ({ name, type: "integer", nullable: false, isPrimaryKey: false, isForeignKey: false, ...extra }) as Field;

const fk = (name: string, table: string, from: string[], to: string, cols: string[]): Relation => ({
  constraintName: name,
  sourceTable: table,
  sourceField: from[0],
  targetTable: to,
  targetField: cols[0],
  sourceFields: from,
  targetFields: cols,
  onDelete: "CASCADE",
  onUpdate: "NO ACTION",
});

const orders: Table = {
  name: "orders",
  schema: "public",
  fields: [
    field("id", { isPrimaryKey: true }),
    field("shop_id", { isForeignKey: true }),
    field("shop_region", { isForeignKey: true }),
    field("code"),
    field("total"),
  ],
  unique: [["shop_id", "code"]],
  indexes: [{ name: "orders_total_idx", columns: ["total"] }],
  checks: [{ name: "orders_total_check", expr: "(total >= 0)" }],
};

describe("tableKeys", () => {
  it("lists the keys, indexes and checks the server introspected, with their real names", () => {
    const relations = [
      fk("orders_shop_fk", "orders", ["shop_id", "shop_region"], "shops", ["id", "region"]),
      fk("other_fk", "lines", ["order_id"], "orders", ["id"]),
    ];
    expect(tableKeys(orders, relations)).toEqual([
      { kind: "PRIMARY KEY", name: "", detail: "(id)" },
      { kind: "FOREIGN KEY", name: "orders_shop_fk", detail: "(shop_id, shop_region) → shops (id, region) · ON DELETE CASCADE" },
      { kind: "UNIQUE", name: "", detail: "(shop_id, code)" },
      { kind: "INDEX", name: "orders_total_idx", detail: "(total)" },
      { kind: "CHECK", name: "orders_total_check", detail: "(total >= 0)" },
    ]);
  });

  it("shows nothing it cannot name or source: no primary key, no extras", () => {
    const bare: Table = { name: "log", schema: "public", fields: [field("msg")] };
    expect(tableKeys(bare, [])).toEqual([]);
  });
});
