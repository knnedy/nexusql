export interface RowsResponse {
  tableName: string;
  columns: string[];
  rows: Record<string, unknown>[];
  /** More rows follow this page. */
  hasMore: boolean;
  /** Send back as `after` for the next page; null when the order cannot use one. */
  cursor: string[] | null;
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
