import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { projectsQueryOptions } from "@/hooks/use-projects";
import { schemaQueryOptions } from "@/hooks/use-schema";
import { tableRowsQueryOptions } from "@/hooks/use-table-rows";
import { useStudioStore } from "@/lib/store/studio-store";
import { QUERY_KEYS } from "@/lib/query-keys";

export function useDisconnect() {
  const router = useRouter();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => api.disconnect(),
    onSuccess: () => {
      sessionStorage.removeItem("nexusql_provider");
      sessionStorage.removeItem("nexusql_project_name");
      sessionStorage.removeItem("nexusql_project_id");
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
