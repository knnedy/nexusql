import { describe, expect, it } from "vitest";
import type { Relation } from "@/shared/types/schema";
import { linkedTables } from "./linked-tables";

const rel = (source: string, sourceFields: string[], target: string, name = `fk_${source}_${target}`): Relation => ({
  constraintName: name,
  sourceTable: source,
  sourceField: sourceFields[0],
  sourceFields,
  targetTable: target,
  targetField: "id",
  targetFields: sourceFields.map(() => "id"),
  onDelete: "NO ACTION",
  onUpdate: "NO ACTION",
});

const RELATIONS = [
  rel("orders", ["customer_id"], "customers"),
  rel("order_items", ["order_id"], "orders"),
  rel("payments", ["order_id"], "orders"),
  rel("orders", ["billing_address_id"], "addresses", "fk_bill"),
  rel("orders", ["shipping_address_id"], "addresses", "fk_ship"),
  rel("customers", ["org_id"], "organizations"),
];

describe("linkedTables", () => {
  it("lists what the table points to, then what points to it, each with its key columns", () => {
    expect(linkedTables("orders", RELATIONS)).toEqual([
      { table: "addresses", direction: "out", via: "billing_address_id", key: "fk_bill" },
      { table: "addresses", direction: "out", via: "shipping_address_id", key: "fk_ship" },
      { table: "customers", direction: "out", via: "customer_id", key: "fk_orders_customers" },
      { table: "order_items", direction: "in", via: "order_id", key: "fk_order_items_orders" },
      { table: "payments", direction: "in", via: "order_id", key: "fk_payments_orders" },
    ]);
  });

  it("joins composite keys and shows a self-reference once", () => {
    const rels = [rel("lines", ["order_id", "line_no"], "orders"), rel("staff", ["manager_id"], "staff")];
    expect(linkedTables("lines", rels)).toEqual([{ table: "orders", direction: "out", via: "order_id, line_no", key: "fk_lines_orders" }]);
    expect(linkedTables("staff", rels)).toEqual([{ table: "staff", direction: "out", via: "manager_id", key: "fk_staff_staff" }]);
  });

  it("is empty for a table nothing links to", () => {
    expect(linkedTables("audit_log", RELATIONS)).toEqual([]);
  });
});
