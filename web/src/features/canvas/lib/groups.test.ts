import { describe, expect, it } from "vitest";
import { CASCADE_WEIGHT, groupTables, type Link } from "./groups";

// [source, target, weight] foreign keys of the tour schema the diagram comp was agreed on.
const TOUR: Link[] = [
  ["users", "organizations"], ["teams", "organizations"], ["team_members", "teams"], ["team_members", "users"],
  ["products", "organizations"], ["categories", "categories"], ["product_categories", "products"],
  ["product_categories", "categories"], ["customers", "organizations"], ["addresses", "customers"],
  ["orders", "customers"], ["orders", "addresses"], ["order_items", "orders", CASCADE_WEIGHT], ["order_items", "products"],
  ["payments", "orders"], ["refunds", "payments"], ["invoices", "orders"], ["reviews", "products"],
  ["reviews", "customers"], ["audit_log", "users"],
];
const names = (links: Link[], extra: string[] = []) => [...new Set([...links.flatMap(([a, b]) => [a, b]), ...extra])];

describe("groupTables", () => {
  it("puts tables that reference each other in one group, named after its most-linked table", () => {
    const groups = groupTables(names(TOUR), TOUR);
    const view = groups.map((g) => [g.name, [...g.tables].sort()]);
    expect(view).toEqual([
      ["orders", ["addresses", "customers", "invoices", "order_items", "orders", "payments", "refunds"]],
      ["organizations", ["audit_log", "organizations", "team_members", "teams", "users"]],
      ["products", ["categories", "product_categories", "products", "reviews"]],
    ]);
  });

  it("keeps tables with no links in their own group, last", () => {
    const links: Link[] = [["b", "a"]];
    const groups = groupTables(names(links, ["settings", "logs"]), links);
    expect(groups.map((g) => [g.name, g.tables, g.unlinked ?? false])).toEqual([
      ["a", ["a", "b"], false],
      ["Not linked", ["logs", "settings"], true],
    ]);
  });

  it("keeps a table with its parent when its key cascades on delete", () => {
    // c has one key to each of a and b; only the one to b cascades.
    const links: Link[] = [["a1", "a"], ["a2", "a"], ["b1", "b"], ["b2", "b"], ["c", "a"], ["c", "b", CASCADE_WEIGHT]];
    const groups = groupTables(names(links), links);
    expect(groups.find((g) => g.tables.includes("c"))!.tables).toContain("b");
  });

  it("folds a group of fewer than three tables into the group it links to most", () => {
    // x and y form a pair hanging off a's group by one key.
    const links: Link[] = [["a1", "a"], ["a2", "a"], ["a3", "a"], ["a1", "a2"], ["a2", "a3"], ["a3", "a1"], ["x", "a3"], ["y", "x"], ["y", "x"]];
    const groups = groupTables(names(links), links);
    expect(groups.map((g) => [...g.tables].sort())).toEqual([["a", "a1", "a2", "a3", "x", "y"]]);
  });

  it("leaves a pair alone when it links to no other group", () => {
    const links: Link[] = [["a1", "a"], ["a2", "a"], ["a2", "a1"], ["q", "p"]];
    const groups = groupTables(names(links), links);
    expect(groups.map((g) => [...g.tables].sort())).toEqual([["a", "a1", "a2"], ["p", "q"]]);
  });

  it("gives the same groups whatever order the schema lists things in", () => {
    const shuffled = [...TOUR].reverse();
    const a = groupTables(names(TOUR), TOUR).map((g) => [...g.tables].sort());
    const b = groupTables(names(shuffled).reverse(), shuffled).map((g) => [...g.tables].sort());
    expect(b).toEqual(a);
  });
});
