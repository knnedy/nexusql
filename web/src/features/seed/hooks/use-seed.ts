import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { queryKeys } from "@/shared/api/query-keys";
import type { SeedRequest } from "@/shared/types/seed";

export function useSeed() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (req: SeedRequest) => api.seed(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.rows() });
      qc.invalidateQueries({ queryKey: queryKeys.lookups() });
    },
  });
}
