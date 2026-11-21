export interface QueryRequest {
  sql: string;
  confirmed?: boolean;
}

/** The active connection's access mode; read-only is enforced by the database. */
export interface ReadOnlyState {
  readOnly: boolean;
}

export interface QueryResponse {
  columns: string[];
  rows: Record<string, unknown>[];
  rowsAffected: number;
  isWrite: boolean;
  /** The server stopped at its row cap; more rows matched than are listed. */
  truncated: boolean;
  /** Statements run; rows and columns come from the last one. */
  statements: number;
  requiresConfirmation: boolean;
}
