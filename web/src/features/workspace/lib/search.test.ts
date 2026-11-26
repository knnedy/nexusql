import { describe, expect, it } from "vitest";
import { rankItems, type SearchItem } from "./search";

const table = (label: string): SearchItem => ({ id: `table:${label}`, kind: "table", label });
const column = (label: string, detail: string): SearchItem => ({ id: `column:${detail}.${label}`, kind: "column", label, detail });
const action = (label: string, keywords = ""): SearchItem => ({ id: `action:${label}`, kind: "action", label, keywords });

describe("rankItems", () => {
  it("lists everything but columns when there is no query", () => {
    const items = [table("orders"), column("id", "orders"), action("Toggle SQL")];
    expect(rankItems("  ", items).map((i) => i.label)).toEqual(["orders", "Toggle SQL"]);
  });

  it("puts the exact name first, then names that start with it, then words that do, then the rest", () => {
    const items = ["reorders", "users", "customer_orders", "orders_archive", "orders"].map(table);
    expect(rankItems("Orders", items).map((i) => i.label)).toEqual(["orders", "orders_archive", "customer_orders", "reorders"]);
  });

  it("finds columns by name, after tables that match as well, and actions by their keywords", () => {
    const items = [column("customer_id", "orders"), table("customers"), action("Switch theme", "dark light")];
    expect(rankItems("customer", items).map((i) => i.id)).toEqual(["table:customers", "column:orders.customer_id"]);
    expect(rankItems("dark", items).map((i) => i.id)).toEqual(["action:Switch theme"]);
  });
});
