import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { tableRowsQueryOptions } from "@/shared/hooks/use-table-rows";
import { UpdateRowRequest } from "@/shared/types/rows";

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
