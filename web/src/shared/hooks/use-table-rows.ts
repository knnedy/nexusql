import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { queryKeys } from "@/shared/api/query-keys";
import type { RowsResponse } from "@/shared/types/rows";

export const DEFAULT_PAGE_SIZE = 50;

/** after continues from the previous page's cursor; it is not part of the key. */
export function tableRowsQueryOptions(
  tableName: string,
  enabled: boolean,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
  sortCol: string = "",
  sortDir: "asc" | "desc" = "asc",
  search: string = "",
  filters: string = "",
  after: string[] | null = null,
) {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps -- after only picks how the server reaches the same page
  return queryOptions({
    queryKey: [
      ...queryKeys.tableRows(tableName),
      page,
      pageSize,
      sortCol,
      sortDir,
      search,
      filters,
    ],
    queryFn: () =>
      api.rows(tableName, page, pageSize, sortCol, sortDir, search, filters, after),
    enabled: enabled && !!tableName,
    staleTime: Infinity,
  });
}

export function tableRowCountQueryOptions(
  tableName: string,
  enabled: boolean,
  search: string = "",
  filters: string = "",
) {
  return queryOptions({
    queryKey: [...queryKeys.tableRows(tableName), "count", search, filters],
    queryFn: () => api.rowCount(tableName, search, filters),
    enabled: enabled && !!tableName,
    staleTime: Infinity,
  });
}

export function useTableRows(
  tableName: string,
  enabled: boolean,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
  sortCol: string = "",
  sortDir: "asc" | "desc" = "asc",
  search: string = "",
  filters: string = "",
) {
  const qc = useQueryClient();
  // The cached previous page holds the cursor; without it (e.g. a reload) the server pages by offset.
  const previous =
    page > 1
      ? qc.getQueryData<RowsResponse>(
          tableRowsQueryOptions(tableName, enabled, page - 1, pageSize, sortCol, sortDir, search, filters)
            .queryKey,
        )
      : undefined;
  return useQuery(
    tableRowsQueryOptions(
      tableName,
      enabled,
      page,
      pageSize,
      sortCol,
      sortDir,
      search,
      filters,
      previous?.cursor ?? null,
    ),
  );
}

export function useTableRowCount(
  tableName: string,
  enabled: boolean,
  search: string = "",
  filters: string = "",
) {
  return useQuery(tableRowCountQueryOptions(tableName, enabled, search, filters));
}
