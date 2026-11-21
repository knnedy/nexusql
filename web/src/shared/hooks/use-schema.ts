import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { QUERY_KEYS } from "@/shared/api/query-keys";

function getProjectId(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("nexusql_project_id") ?? "";
}

export function schemaQueryOptions() {
  const projectId = getProjectId();
  return queryOptions({
    queryKey: [QUERY_KEYS.schema, projectId],
    queryFn: () => api.schema(),
    staleTime: Infinity,
    enabled: !!projectId,
  });
}

export function useSchema() {
  return useQuery(schemaQueryOptions());
}
