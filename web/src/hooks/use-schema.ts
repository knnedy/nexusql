import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const schemaQueryOptions = queryOptions({
  queryKey: ["schema"],
  queryFn: () => api.schema(),
  staleTime: Infinity,
});

export function useSchema() {
  return useQuery(schemaQueryOptions);
}
