import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/query-keys";

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
