import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { QUERY_KEYS } from "@/shared/api/query-keys";

export function rowLookupQueryOptions(
  tableName: string,
  field: string,
  value: string,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: [QUERY_KEYS.lookup, tableName, field, value],
    queryFn: () => api.lookup(tableName, field, value),
    enabled: enabled && !!tableName && !!field && !!value,
    staleTime: Infinity,
  });
}

export function useRowLookup(
  tableName: string,
  field: string,
  value: string,
  enabled: boolean,
) {
  return useQuery(rowLookupQueryOptions(tableName, field, value, enabled));
}
