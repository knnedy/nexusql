import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { queryKeys } from "@/shared/api/query-keys";
import { studioSession } from "@/shared/lib/session-storage";

function getProjectId(): string {
  return studioSession.projectId() ?? "";
}

export function schemaQueryOptions() {
  const projectId = getProjectId();
  return queryOptions({
    queryKey: queryKeys.schema(),
    queryFn: () => api.schema(),
    staleTime: Infinity,
    enabled: !!projectId,
  });
}

export function useSchema() {
  return useQuery(schemaQueryOptions());
}
