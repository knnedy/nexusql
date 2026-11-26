import { queryOptions } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { queryKeys } from "@/shared/api/query-keys";

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
    enabled: enabled && !!format,
    staleTime: Infinity,
  });

/** One table's DDL, rendered by the server from the introspected schema. */
export const tableDdlQueryOptions = (table: string, enabled: boolean) =>
  queryOptions({
    queryKey: queryKeys.tableDdl(table),
    queryFn: async () => (await api.tables.ddl(table)).ddl,
    enabled: enabled && !!table,
  });
