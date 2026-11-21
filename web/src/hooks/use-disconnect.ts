import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/shared/api/client";
import { projectsQueryOptions } from "@/hooks/use-projects";
import { schemaQueryOptions } from "@/shared/hooks/use-schema";
import { tableRowsQueryOptions } from "@/shared/hooks/use-table-rows";
import { useStudioStore } from "@/lib/store/studio-store";
import { QUERY_KEYS } from "@/shared/api/query-keys";
import { studioSession } from "@/shared/lib/session-storage";

export function useDisconnect() {
  const router = useRouter();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => api.disconnect(),
    onSuccess: () => {
      studioSession.clear();
      useStudioStore.getState().reset();
      qc.removeQueries({ queryKey: schemaQueryOptions().queryKey });
      qc.removeQueries({
        queryKey: tableRowsQueryOptions("", false).queryKey.slice(0, 1),
      });
      qc.removeQueries({ queryKey: QUERY_KEYS.lookup });
      qc.removeQueries({ queryKey: QUERY_KEYS.export });
      qc.invalidateQueries({ queryKey: projectsQueryOptions.queryKey });
      router.push("/");
    },
  });
}
