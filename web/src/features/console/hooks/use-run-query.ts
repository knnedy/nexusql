import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { queryKeys } from "@/shared/api/query-keys";
import type { QueryRequest } from "@/shared/types/query";

export function useRunQuery() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (req: QueryRequest) => api.query(req),
    onSuccess: (data) => {
      // A write may be DDL, so the schema and exports go stale with the rows.
      if (data.isWrite) {
        qc.invalidateQueries({ queryKey: queryKeys.connection() });
      }
    },
  });
}
