import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const DEFAULT_PAGE_SIZE = 50;

export function tableRowsQueryOptions(
  tableName: string,
  enabled: boolean,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
  sortCol: string = "",
  sortDir: "asc" | "desc" = "asc",
  search: string = "",
) {
  return queryOptions({
    queryKey: ["rows", tableName, page, pageSize, sortCol, sortDir, search],
    queryFn: () =>
      api.rows(tableName, page, pageSize, sortCol, sortDir, search),
    enabled: enabled && !!tableName,
    staleTime: Infinity,
  });
}

export function useTableRows(
  tableName: string,
  enabled: boolean,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
  sortCol: string = "",
  sortDir: "asc" | "desc" = "asc",
  search: string = "",
) {
  return useQuery(
    tableRowsQueryOptions(
      tableName,
      enabled,
      page,
      pageSize,
      sortCol,
      sortDir,
      search,
    ),
  );
}
