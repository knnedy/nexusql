import type { Include } from "@/shared/lib/image-name";
import type { Relation, SchemaResponse } from "@/shared/types/schema";

export type { Include };

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

/** The schema with only these tables and the keys between them; no names keeps it whole. */
export function pickTables(schema: SchemaResponse, names: string[]): SchemaResponse {
  if (!names.length) return schema;
  const keep = new Set(names);
  return {
    ...schema,
    tables: schema.tables.filter((t) => keep.has(t.name)),
    relations: schema.relations.filter((r) => keep.has(r.sourceTable) && keep.has(r.targetTable)),
  };
}
