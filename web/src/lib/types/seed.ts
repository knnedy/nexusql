export interface SeedRequest {
  rowsPerTable: number;
  nullChance: number;
}

export interface SeedResponse {
  rowsInserted: Record<string, number>;
}
