import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/shared/api/client";
import { projectsQueryOptions } from "@/shared/hooks/use-projects";
import { forgetConnection } from "@/shared/api/query-keys";
import { useStudioStore } from "@/shared/store/studio-store";
import { ConnectRequest } from "@/shared/types/health";
import { DatabaseProvider } from "@/shared/types/provider";
import { studioSession } from "@/shared/lib/session-storage";

export function useConnect() {
  const router = useRouter();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (req: ConnectRequest) => api.connect(req),
    onSuccess: (data, variables) => {
      forgetConnection(qc); // the server dropped the old connection
      const projectName = variables.name ?? "";

      studioSession.save({
        provider: data.provider,
        projectId: data.projectId,
        projectName,
      });

      useStudioStore
        .getState()
        .setSession(data.provider as DatabaseProvider, projectName);

      qc.invalidateQueries({ queryKey: projectsQueryOptions.queryKey });
      router.push("/studio");
    },
  });
}
