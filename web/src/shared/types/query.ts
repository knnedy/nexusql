export interface QueryRequest {
  sql: string;
  confirmed?: boolean;
}

export interface QueryResponse {
  columns: string[];
  rows: Record<string, unknown>[];
  rowsAffected: number;
  isWrite: boolean;
  /** The server stopped at its row cap; more rows matched than are listed. */
  truncated: boolean;
  requiresConfirmation: boolean;
}
