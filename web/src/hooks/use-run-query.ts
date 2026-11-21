import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { tableRowsQueryOptions } from "@/hooks/use-table-rows";
import { rowLookupQueryOptions } from "@/hooks/use-row-lookup";
import type { QueryRequest } from "@/shared/types/query";

export function useRunQuery() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (req: QueryRequest) => api.query(req),
    onSuccess: (data) => {
      if (data.isWrite) {
        qc.invalidateQueries({
          queryKey: tableRowsQueryOptions("", false).queryKey.slice(0, 1),
        });
        qc.invalidateQueries({
          queryKey: rowLookupQueryOptions("", "", "", false).queryKey.slice(
            0,
            1,
          ),
        });
      }
    },
  });
}
