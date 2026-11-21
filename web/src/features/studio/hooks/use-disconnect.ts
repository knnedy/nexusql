import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/shared/api/client";
import { projectsQueryOptions } from "@/shared/hooks/use-projects";
import { useStudioStore } from "@/shared/store/studio-store";
import { forgetConnection } from "@/shared/api/query-keys";
import { studioSession } from "@/shared/lib/session-storage";

export function useDisconnect() {
  const router = useRouter();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => api.disconnect(),
    onSuccess: () => {
      forgetConnection(qc);
      studioSession.clear();
      useStudioStore.getState().reset();
      qc.invalidateQueries({ queryKey: projectsQueryOptions.queryKey });
      router.push("/");
    },
  });
}
