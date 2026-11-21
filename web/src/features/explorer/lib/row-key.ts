import type { Field } from "@/shared/types/schema";

/** A row's identity: every primary-key column, as the server requires for edits. */
export type RowKey = Record<string, string>;

/** Builds the key of row from all primary-key fields; null when the table has none. */
export function rowKey(fields: Field[], row: Record<string, unknown>): RowKey | null {
  const pk = fields.filter((f) => f.isPrimaryKey);
  if (pk.length === 0) return null;
  return Object.fromEntries(pk.map((f) => [f.name, String(row[f.name] ?? "")]));
}

/** Identifies one cell across renders, unambiguous for any key values. */
export function editKey(key: RowKey, column: string): string {
  return JSON.stringify([Object.entries(key), column]);
}
