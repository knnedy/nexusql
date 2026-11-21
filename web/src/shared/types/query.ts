export interface QueryRequest {
  sql: string;
  confirmed?: boolean;
}

export interface QueryResponse {
  columns: string[];
  rows: Record<string, unknown>[];
  rowsAffected: number;
  isWrite: boolean;
  requiresConfirmation: boolean;
}
