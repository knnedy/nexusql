import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const DEFAULT_PAGE_SIZE = 50;

export function tableRowsQueryOptions(
  tableName: string,
  enabled: boolean,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
) {
  return queryOptions({
    queryKey: ["rows", tableName, page, pageSize],
    queryFn: () => api.rows(tableName, page, pageSize),
    enabled: enabled && !!tableName,
    staleTime: Infinity,
  });
}

export function useTableRows(
  tableName: string,
  enabled: boolean,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
) {
  return useQuery(tableRowsQueryOptions(tableName, enabled, page, pageSize));
}
