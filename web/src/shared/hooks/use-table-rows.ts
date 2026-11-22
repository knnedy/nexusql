import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { queryKeys } from "@/shared/api/query-keys";

export const DEFAULT_PAGE_SIZE = 50;

export function tableRowsQueryOptions(
  tableName: string,
  enabled: boolean,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
  sortCol: string = "",
  sortDir: "asc" | "desc" = "asc",
  search: string = "",
  filters: string = "",
) {
  return queryOptions({
    queryKey: [
      ...queryKeys.tableRows(tableName),
      page,
      pageSize,
      sortCol,
      sortDir,
      search,
      filters,
    ],
    queryFn: () =>
      api.rows(tableName, page, pageSize, sortCol, sortDir, search, filters),
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
  filters: string = "",
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
      filters,
    ),
  );
}
