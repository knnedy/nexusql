import type { Relation } from "@/shared/types/schema";
import { linkedTables } from "@/shared/lib/linked-tables";

/** The tables reached by following links, and which of them is current. */
export interface Trail {
  tables: string[];
  at: number;
}

export const EMPTY_TRAIL: Trail = { tables: [], at: -1 };

function hop(from: string, to: string, relations: Relation[]): string | undefined {
  return linkedTables(from, relations).find((l) => l.table === to)?.via;
}

/** The trail after selecting table: back along it, onward by a link, or a fresh start. */
export function stepTrail(trail: Trail, table: string | null, relations: Relation[]): Trail {
  if (!table) return EMPTY_TRAIL;
  const seen = trail.tables.indexOf(table);
  if (seen >= 0) return { tables: trail.tables, at: seen };
  const current = trail.tables[trail.at];
  if (current && hop(current, table, relations) !== undefined) {
    const tables = [...trail.tables.slice(0, trail.at + 1), table];
    return { tables, at: tables.length - 1 };
  }
  return { tables: [table], at: 0 };
}

/** The key columns between each pair of neighbours on the trail. */
export function trailHops(trail: Trail, relations: Relation[]): string[] {
  return trail.tables.slice(1).map((to, i) => hop(trail.tables[i], to, relations) ?? "");
}
