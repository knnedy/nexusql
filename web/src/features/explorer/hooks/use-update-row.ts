import { useMutation } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { UpdateRowRequest } from "@/shared/types/rows";

/** Saves one cell; the caller refetches once the whole batch is done. */
export function useUpdateRow(tableName: string) {
  return useMutation({
    mutationFn: (req: UpdateRowRequest) => api.updateRow(tableName, req),
  });
}
