import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { QueryRequest } from "@/lib/types/query";

export function useRunQuery() {
  return useMutation({
    mutationFn: (req: QueryRequest) => api.query(req),
  });
}
