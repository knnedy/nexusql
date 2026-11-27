import type { Relation } from "@/shared/types/schema";

/** What an export covers: every table, the chosen one, or it and the tables it links to. */
export type Include = "all" | "table" | "linked";

/** Tables a key joins to this one, either direction, sorted, without itself. */
export function linkedTables(table: string, relations: Relation[]): string[] {
  const out = new Set<string>();
  for (const r of relations) {
    if (r.sourceTable === table) out.add(r.targetTable);
    if (r.targetTable === table) out.add(r.sourceTable);
  }
  out.delete(table);
  return [...out].sort();
}

export function parseInclude(value: string | null): Include {
  return value === "table" || value === "linked" ? value : "all";
}

/** The tables to ask the server for; empty means all of them. */
export function exportTables(include: Include, table: string | null, relations: Relation[]): string[] {
  if (!table || include === "all") return [];
  if (include === "table") return [table];
  return [table, ...linkedTables(table, relations)].sort();
}
