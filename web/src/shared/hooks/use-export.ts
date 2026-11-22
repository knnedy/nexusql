import { queryOptions } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { queryKeys } from "@/shared/api/query-keys";

/** The canvas snapshot; every other export choice is a server format id. */
export const PNG_EXPORT = "png";

export const exportFormatsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.exportFormats,
    queryFn: async () => (await api.export.formats()).formats,
    staleTime: Infinity,
  });

export const exportQueryOptions = (format: string | null, enabled: boolean) =>
  queryOptions({
    queryKey: queryKeys.export(format),
    queryFn: () => api.export.render(format ?? ""),
    enabled: enabled && !!format && format !== PNG_EXPORT,
    staleTime: Infinity,
  });
