import type { Relation } from "@/shared/types/schema";
import type { SeedRequest } from "@/shared/types/seed";

/** Tables in the order the server seeds them, each with the tables its keys point at. */
export function planRows(order: string[], relations: Relation[]): { table: string; needs: string[] }[] {
  return order.map((table) => {
    const needs = new Set(relations.filter((r) => r.sourceTable === table && r.targetTable !== table).map((r) => r.targetTable));
    return { table, needs: [...needs].sort() };
  });
}

/** Parents seeded in this run are "needed"; keys to ones switched off use their existing rows. */
export function needsLabel(needs: string[], off: Set<string>): string {
  if (!needs.length) return "no keys to other tables";
  const seeded = needs.filter((n) => !off.has(n));
  const existing = needs.filter((n) => off.has(n));
  return [seeded.length ? `needs ${seeded.join(", ")}` : "", existing.length ? `existing ${existing.join(", ")} rows` : ""].filter(Boolean).join(" · ");
}

const on = (counts: Record<string, number>, off: Set<string>) => Object.entries(counts).filter(([t, n]) => n > 0 && !off.has(t));

export function seedBody(counts: Record<string, number>, off: Set<string>, nullChance: number): SeedRequest {
  // rowsPerTable is ignored when tables is set; the server still wants it positive.
  return { rowsPerTable: 1, nullChance, tables: Object.fromEntries(on(counts, off)) };
}

export function totals(counts: Record<string, number>, off: Set<string>): { rows: number; tables: number } {
  const picked = on(counts, off);
  return { rows: picked.reduce((n, [, c]) => n + c, 0), tables: picked.length };
}
