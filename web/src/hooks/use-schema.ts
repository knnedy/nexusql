import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

function getProjectId(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("nexusql_project_id") ?? "";
}

export function schemaQueryOptions() {
  const projectId = getProjectId();
  return queryOptions({
    queryKey: ["schema", projectId],
    queryFn: () => api.schema(),
    staleTime: Infinity,
    enabled: !!projectId,
  });
}

export function useSchema() {
  return useQuery(schemaQueryOptions());
}
