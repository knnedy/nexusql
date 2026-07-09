import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { projectsQueryOptions } from "@/hooks/use-projects";
import { schemaQueryOptions } from "@/hooks/use-schema";
import { useStudioStore } from "@/lib/store/studio-store";
import { ConnectRequest } from "@/lib/types/health";
import { DatabaseProvider } from "@/lib/types/provider";

export function useConnect() {
  const router = useRouter();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (req: ConnectRequest) => api.connect(req),
    onSuccess: (data, variables) => {
      const projectName = variables.name ?? "";

      sessionStorage.setItem("nexusql_provider", data.provider);
      sessionStorage.setItem("nexusql_project_id", data.projectId);
      sessionStorage.setItem("nexusql_project_name", projectName);

      useStudioStore
        .getState()
        .setSession(data.provider as DatabaseProvider, projectName);

      qc.invalidateQueries({ queryKey: projectsQueryOptions.queryKey });
      qc.invalidateQueries({ queryKey: schemaQueryOptions().queryKey });
      router.push("/studio");
    },
  });
}
