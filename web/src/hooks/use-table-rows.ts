import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function tableRowsQueryOptions(tableName: string, enabled: boolean) {
  return queryOptions({
    queryKey: ["rows", tableName],
    queryFn: () => api.rows(tableName),
    enabled: enabled && !!tableName,
    staleTime: Infinity,
  });
}

export function useTableRows(tableName: string, enabled: boolean) {
  return useQuery(tableRowsQueryOptions(tableName, enabled));
}
