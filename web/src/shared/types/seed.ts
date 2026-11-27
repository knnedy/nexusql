export interface SeedRequest {
  rowsPerTable: number;
  nullChance: number;
  /** When set, only these tables, each with its own row count. */
  tables?: Record<string, number>;
}

/** Rows made the way a seed makes them, nothing written. */
export interface SeedSample {
  /** Column to value, null is NULL; key and automatic columns are left out. */
  rows: Record<string, string | null>[];
  /** Key column to the table it points at; the row is picked at insert. */
  refs: Record<string, string>;
  /** Columns the database fills. */
  auto: string[];
}

export interface SeedResponse {
  rowsInserted: Record<string, number>;
  /** Rows the database rejected on every try (unique or check constraints). */
  skipped: Record<string, number>;
  /** Why each table's last rejected row failed. */
  problems: Record<string, string>;
}
