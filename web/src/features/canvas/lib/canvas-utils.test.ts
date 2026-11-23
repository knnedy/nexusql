import { describe, expect, it } from "vitest";
import { buildCanvasGraph } from "./canvas-utils";
import { generateSchema } from "@/test/schema-gen";
import { measureLayout } from "@/test/layout-metrics";

it("lays out a key that references a unique, non-primary column", async () => {
  const s = generateSchema(3);
  s.tables[0].fields.push({ ...s.tables[0].fields[1], name: "code" });
  s.tables[2].fields.push({ ...s.tables[2].fields[1], name: "t0_code", isForeignKey: true });
  s.relations.push({
    ...s.relations[0],
    constraintName: "t2_code_fkey",
    sourceTable: "t2",
    sourceField: "t0_code",
    sourceFields: ["t0_code"],
    targetTable: "t0",
    targetField: "code",
    targetFields: ["code"],
  });
  const { nodes, edges } = await buildCanvasGraph(s, "postgres");
  expect(nodes.map((n) => n.id).sort()).toEqual(["t0", "t1", "t2"]);
  expect(edges.find((e) => e.id === "t2_code_fkey")?.targetHandle).toBe("t0__code__target");
  expect(nodes.find((n) => n.id === "t0")?.data.referenced).toEqual(["code", "id"]);
});

// Crossings before hub edges left the layout (D18a), on the same generated schemas.
const CROSSINGS_BEFORE: Record<number, number> = { 30: 79, 150: 2085, 400: 18992 };

describe.each([30, 150, 400])("a %i-table schema", (n) => {
  it("keeps tables apart and every drawn edge out from under them", async () => {
    const { nodes, edges } = await buildCanvasGraph(generateSchema(n), "postgres");
    expect(nodes).toHaveLength(n);
    const routed = edges.filter((e) => !e.data?.hub);
    expect(routed.every((e) => (e.data?.points?.length ?? 0) >= 2)).toBe(true);
    const m = measureLayout(nodes, routed);
    expect(m.overlaps).toBe(0);
    expect(m.through).toBe(0);
  }, 30_000);
});

describe("hub tables", () => {
  it("in a large schema, lines into the most referenced tables become chips", async () => {
    const { nodes, edges } = await buildCanvasGraph(generateSchema(400), "postgres");
    const hubTargets = new Set(edges.filter((e) => e.data?.hub).map((e) => e.target));
    expect([...hubTargets].sort()).toEqual(["t0", "t1", "t2"]);
    expect(edges.filter((e) => e.data?.hub).every((e) => !e.data?.points)).toBe(true);

    const hubEdge = edges.find((e) => e.data?.hub)!;
    const source = nodes.find((n) => n.id === hubEdge.source)!;
    expect(source.data.hubRefs?.[hubEdge.data!.relation.sourceField]).toBe(hubEdge.target);
  }, 30_000);

  it.each([150, 400])("at %i tables, crossings drop to under a quarter", async (n) => {
    const { nodes, edges } = await buildCanvasGraph(generateSchema(n), "postgres");
    const m = measureLayout(nodes, edges.filter((e) => !e.data?.hub));
    expect(m.crossings).toBeLessThan(CROSSINGS_BEFORE[n] / 4);
  }, 30_000);

  // users is referenced by `refs` of the other tables in a schema of `n`.
  function star(n: number, refs: number) {
    const s = generateSchema(n);
    s.relations = s.relations.filter((r) => r.targetTable !== "t0");
    for (let i = 1; i <= refs; i++) {
      const table = s.tables[i];
      table.fields = table.fields.filter((f) => f.name !== "t0_id");
      table.fields.push({ ...table.fields[1], name: "t0_id", isForeignKey: true });
      s.relations.push({
        ...s.relations[0],
        constraintName: `star_${i}`,
        sourceTable: table.name,
        sourceField: "t0_id",
        sourceFields: ["t0_id"],
        targetTable: "t0",
        targetField: "id",
        targetFields: ["id"],
      });
    }
    return s;
  }

  it.each([
    ["39 tables, 30 references", 39, 30, false],
    ["40 tables, 10 references", 40, 10, true],
    ["40 tables, 9 references", 40, 9, false],
    ["400 tables, 20 references", 400, 20, true],
    ["400 tables, 19 references", 400, 19, false],
    ["40 tables, 9 references and one from itself", 40, 9, false, true],
  ])("%s: t0 is a hub: %s", async (_, n, refs, hub, selfRef = false) => {
    const schema = star(n as number, refs as number);
    if (selfRef) {
      schema.tables[0].fields.push({ ...schema.tables[0].fields[1], name: "parent_id", isForeignKey: true });
      schema.relations.push({ ...schema.relations.at(-1)!, constraintName: "t0_parent", sourceTable: "t0", sourceField: "parent_id", sourceFields: ["parent_id"] });
    }
    const { nodes, edges } = await buildCanvasGraph(schema, "postgres");
    expect(nodes).toHaveLength(n as number);
    expect(edges.filter((e) => e.target === "t0")).toHaveLength((refs as number) + (selfRef ? 1 : 0));
    expect(edges.some((e) => e.target === "t0" && e.data?.hub)).toBe(hub);
  }, 30_000);
});
