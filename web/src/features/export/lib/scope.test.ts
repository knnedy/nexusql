import { expect, it } from "vitest";
import type { Relation, SchemaResponse } from "@/shared/types/schema";
import { exportTables, linkedTables, parseInclude, pickTables } from "./scope";

const rel = (sourceTable: string, targetTable: string) => ({ sourceTable, targetTable }) as Relation;
const RELATIONS = [rel("pets", "owners"), rel("visits", "pets"), rel("pets", "owners"), rel("pets", "pets"), rel("vets", "clinics")];

it("links a table to those it points at and those pointing at it, once each", () => {
  expect(linkedTables("pets", RELATIONS)).toEqual(["owners", "visits"]);
  expect(linkedTables("clinics", RELATIONS)).toEqual(["vets"]);
  expect(linkedTables("lonely", RELATIONS)).toEqual([]);
});

it("reads only the include values it knows", () => {
  expect(parseInclude("table")).toBe("table");
  expect(parseInclude("linked")).toBe("linked");
  expect(parseInclude("everything")).toBe("all");
  expect(parseInclude(null)).toBe("all");
});

it("exports every table unless one is chosen and the scope narrows to it", () => {
  expect(exportTables("all", "pets", RELATIONS)).toEqual([]);
  expect(exportTables("linked", null, RELATIONS)).toEqual([]);
  expect(exportTables("table", "pets", RELATIONS)).toEqual(["pets"]);
  expect(exportTables("linked", "pets", RELATIONS)).toEqual(["owners", "pets", "visits"]);
});

it("cuts the schema down to the chosen tables and the keys between them", () => {
  const schema = {
    tables: ["owners", "pets", "visits"].map((name) => ({ name })),
    relations: RELATIONS,
    enums: [],
  } as unknown as SchemaResponse;
  const cut = pickTables(schema, ["pets", "owners"]);
  expect(cut.tables.map((t) => t.name)).toEqual(["owners", "pets"]);
  expect(cut.relations.map((r) => `${r.sourceTable}>${r.targetTable}`)).toEqual(["pets>owners", "pets>owners", "pets>pets"]);
  expect(pickTables(schema, [])).toBe(schema);
});
