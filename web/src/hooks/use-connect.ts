import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { projectsQueryOptions } from "@/hooks/use-projects";
import type { ConnectRequest } from "@/lib/types";

export function useConnect() {
  const router = useRouter();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (req: ConnectRequest) => api.connect(req),
    onSuccess: (data) => {
      sessionStorage.setItem("nexusql_provider", data.provider);
      qc.invalidateQueries({ queryKey: projectsQueryOptions.queryKey });
      router.push(`/canvas/${data.projectId}`);
    },
  });
}
