import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/shared/api/client";

const readOnlyQueryOptions = queryOptions({
  queryKey: ["read-only"],
  queryFn: () => api.readOnly.get(),
});

/** Whether the active connection refuses writes; the server is the source of truth. */
export function useReadOnly() {
  const qc = useQueryClient();
  const status = useQuery({
    ...readOnlyQueryOptions,
    // Keys are not yet scoped by connection, so never trust a cached value.
    refetchOnMount: "always",
  });
  const toggle = useMutation({
    mutationFn: (readOnly: boolean) => api.readOnly.set({ readOnly }),
    onSuccess: (data) => qc.setQueryData(readOnlyQueryOptions.queryKey, data),
  });
  return {
    readOnly: status.data?.readOnly ?? false,
    setReadOnly: toggle.mutate,
    isPending: status.isPending || toggle.isPending,
  };
}
