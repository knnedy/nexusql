import { expect, it } from "vitest";
import type { Relation } from "@/shared/types/schema";
import { needsLabel, planRows, seedBody, totals } from "./plan";

const rel = (sourceTable: string, targetTable: string) => ({ sourceTable, targetTable }) as Relation;
const RELATIONS = [rel("orders", "customers"), rel("orders", "addresses"), rel("addresses", "customers"), rel("orders", "customers"), rel("customers", "customers")];

it("keeps the server's order and names each table's parents once", () => {
  expect(planRows(["customers", "addresses", "orders"], RELATIONS)).toEqual([
    { table: "customers", needs: [] },
    { table: "addresses", needs: ["customers"] },
    { table: "orders", needs: ["addresses", "customers"] },
  ]);
});

it("says what a table's keys will point at", () => {
  expect(needsLabel([], new Set())).toBe("no keys to other tables");
  expect(needsLabel(["addresses", "customers"], new Set())).toBe("needs addresses, customers");
  expect(needsLabel(["addresses", "customers"], new Set(["customers"]))).toBe("needs addresses · existing customers rows");
  expect(needsLabel(["customers"], new Set(["customers"]))).toBe("existing customers rows");
});

it("asks for the tables switched on, with their counts", () => {
  const counts = { customers: 10, addresses: 20, orders: 0, refunds: 5 };
  expect(seedBody(counts, new Set(["refunds"]), 0.2)).toEqual({ rowsPerTable: 1, nullChance: 0.2, tables: { customers: 10, addresses: 20 } });
  expect(totals(counts, new Set(["refunds"]))).toEqual({ rows: 30, tables: 2 });
});
