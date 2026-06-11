import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { projectsQueryOptions } from "@/hooks/use-projects";

export function useDisconnect() {
  const router = useRouter();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => api.disconnect(),
    onSuccess: () => {
      sessionStorage.removeItem("nexusql_provider");
      sessionStorage.removeItem("nexusql_project_name");
      qc.invalidateQueries({ queryKey: projectsQueryOptions.queryKey });
      router.push("/");
    },
  });
}
