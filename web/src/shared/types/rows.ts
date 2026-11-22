export interface RowsResponse {
  tableName: string;
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  sortCol: string;
  sortDir: "asc" | "desc";
  search: string;
}

/** Edits one cell. key holds every primary-key column; value null writes NULL. */
export interface UpdateRowRequest {
  key: Record<string, string>;
  column: string;
  value: string | null;
}

export interface UpdateRowResponse {
  ok: boolean;
}
