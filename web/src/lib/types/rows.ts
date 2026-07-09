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

export interface LookupResponse {
  tableName: string;
  field: string;
  value: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface UpdateRowRequest {
  pkField: string;
  pkValue: string;
  targetField: string;
  newValue: string;
}

export interface UpdateRowResponse {
  ok: boolean;
}
