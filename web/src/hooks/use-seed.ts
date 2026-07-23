import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { tableRowsQueryOptions } from "@/hooks/use-table-rows";
import { rowLookupQueryOptions } from "@/hooks/use-row-lookup";
import type { SeedRequest } from "@/lib/types/seed";

export function useSeed() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (req: SeedRequest) => api.seed(req),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: tableRowsQueryOptions("", false).queryKey.slice(0, 1),
      });
      qc.invalidateQueries({
        queryKey: rowLookupQueryOptions("", "", "", false).queryKey.slice(0, 1),
      });
    },
  });
}
