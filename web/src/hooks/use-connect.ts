import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { projectsQueryOptions } from "@/hooks/use-projects";
import { schemaQueryOptions } from "@/hooks/use-schema";
import type { ConnectRequest } from "@/lib/types";

export function useConnect() {
  const router = useRouter();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (req: ConnectRequest) => api.connect(req),
    onSuccess: (data, variables) => {
      sessionStorage.setItem("nexusql_provider", data.provider);
      sessionStorage.setItem("nexusql_project_id", data.projectId);
      sessionStorage.setItem("nexusql_project_name", variables.name ?? "");
      qc.invalidateQueries({ queryKey: projectsQueryOptions.queryKey });
      qc.invalidateQueries({ queryKey: schemaQueryOptions().queryKey });
      router.push("/studio");
    },
  });
}
