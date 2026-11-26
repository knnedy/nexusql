import type { Relation } from "@/shared/types/schema";

export interface LinkedTable {
  table: string;
  /** out: this table points to it; in: it points to this table. */
  direction: "out" | "in";
  /** The key columns, in the table that holds the key. */
  via: string;
  /** Unique per link, for React keys. */
  key: string;
}

/** Tables one foreign key away: those it points to, then those pointing to it, A to Z. */
export function linkedTables(table: string, relations: Relation[]): LinkedTable[] {
  const link = (r: Relation, direction: LinkedTable["direction"], other: string): LinkedTable => ({
    table: other,
    direction,
    via: r.sourceFields.join(", "),
    key: r.constraintName,
  });
  const byName = (a: LinkedTable, b: LinkedTable) => a.table.localeCompare(b.table) || a.via.localeCompare(b.via);
  const out = relations.filter((r) => r.sourceTable === table).map((r) => link(r, "out", r.targetTable));
  const inn = relations
    .filter((r) => r.targetTable === table && r.sourceTable !== table)
    .map((r) => link(r, "in", r.sourceTable));
  return [...out.sort(byName), ...inn.sort(byName)];
}
