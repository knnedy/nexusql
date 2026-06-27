import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function rowLookupQueryOptions(
  tableName: string,
  field: string,
  value: string,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: ["lookup", tableName, field, value],
    queryFn: () => api.lookup(tableName, field, value),
    enabled: enabled && !!tableName && !!field && !!value,
    staleTime: Infinity,
  });
}
