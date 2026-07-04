import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { tableRowsQueryOptions } from "@/hooks/use-table-rows";
import type { UpdateRowRequest } from "@/lib/types";

export function useUpdateRow(tableName: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (req: UpdateRowRequest) => api.updateRow(tableName, req),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: tableRowsQueryOptions(tableName, false).queryKey.slice(0, 2),
      });
    },
  });
}
