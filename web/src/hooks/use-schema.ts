import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function schemaQueryOptions(projectId: string) {
  return queryOptions({
    queryKey: ["schema", projectId],
    queryFn: () => api.schema(),
    staleTime: Infinity,
    enabled: !!projectId,
  });
}

export function useSchema(projectId: string) {
  return useQuery(schemaQueryOptions(projectId));
}
