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

describe.each([30, 150, 400])("a %i-table schema", (n) => {
  it("keeps tables apart and every edge out from under them", async () => {
    const { nodes, edges } = await buildCanvasGraph(generateSchema(n), "postgres");
    expect(nodes).toHaveLength(n);
    expect(edges.every((e) => (e.data?.points?.length ?? 0) >= 2)).toBe(true);
    const m = measureLayout(nodes, edges);
    expect(m.overlaps).toBe(0);
    expect(m.through).toBe(0);
  }, 30_000);
});
