export interface SeedRequest {
  rowsPerTable: number;
  nullChance: number;
}

export interface SeedResponse {
  rowsInserted: Record<string, number>;
  /** Rows the database rejected on every try (unique or check constraints). */
  skipped: Record<string, number>;
  /** Why each table's last rejected row failed. */
  problems: Record<string, string>;
}
