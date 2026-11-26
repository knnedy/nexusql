"use client";

import { useState, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/shared/ui/button";
import { Select } from "@/shared/ui/select";
import { useSchema } from "@/shared/hooks/use-schema";
import {
  useTableRows,
  useTableRowCount,
  tableRowsQueryOptions,
  tableRowCountQueryOptions,
  DEFAULT_PAGE_SIZE,
} from "@/shared/hooks/use-table-rows";
import { useUpdateRow } from "@/features/explorer/hooks/use-update-row";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { useQueryClient } from "@tanstack/react-query";
import { exportToCsv } from "@/features/explorer/lib/csv";
import DataGrid, {
  type PendingEdit,
  type CellEditPayload,
} from "@/features/explorer/_components/data-grid";
import { editKey } from "@/features/explorer/lib/row-key";
import { isUnchanged } from "@/features/explorer/lib/cell";
import {
  parseFilters,
  serializeFilters,
  type RowFilter,
} from "@/features/explorer/lib/filters";
import { queryKeys } from "@/shared/api/query-keys";
import { useReadOnly } from "@/shared/hooks/use-read-only";
import ExplorerToolbar from "@/features/explorer/_components/explorer-toolbar";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250];

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number | undefined; // undefined while counting
  hasMore: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

function Pagination({ page, pageSize, total, hasMore, onPageChange, onPageSizeChange }: PaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = total === undefined ? page * pageSize : Math.min(page * pageSize, total);
  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-t border-line bg-panel px-4 text-label text-fg-muted">
      <span aria-hidden>Rows per page</span>
      <Select
        aria-label="Rows per page"
        items={PAGE_SIZE_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
        value={String(pageSize)}
        onValueChange={(v) => onPageSizeChange(Number(v))}
        className="h-7 min-w-16 text-label tabular-nums"
      />
      <div className="flex-1" />
      {/* An empty result has no range worth reading. */}
      {total !== 0 && (
        <span className="tabular-nums">
          {from.toLocaleString()}–{to.toLocaleString()} of {total?.toLocaleString() ?? "…"}
        </span>
      )}
      <div className="flex items-center gap-0.5">
        <IconButton label="Previous page" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft aria-hidden />
        </IconButton>
        <IconButton label="Next page" size="sm" onClick={() => onPageChange(page + 1)} disabled={!hasMore}>
          <ChevronRight aria-hidden />
        </IconButton>
      </div>
    </div>
  );
}

export default function ExplorerStudio() {
  return (
    <Suspense fallback={null}>
      <ExplorerInner />
    </Suspense>
  );
}

function ExplorerInner() {
  const { data: schema } = useSchema();
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedTable = searchParams.get("table");
  const page = Number(searchParams.get("page") ?? "1");
  const sortCol = searchParams.get("sort") ?? "";
  const sortDir = (searchParams.get("dir") as "asc" | "desc") ?? "asc";
  const urlSearch = searchParams.get("search") ?? "";
  const filtersParam = searchParams.get("filters") ?? "";
  const filters = useMemo(() => parseFilters(filtersParam), [filtersParam]);
  const filtersKey = serializeFilters(filters); // drops what the URL held but could not be read

  const [searchValue, setSearchValue] = useState(urlSearch);
  const sizeParam = Number(searchParams.get("size"));
  const pageSize = PAGE_SIZE_OPTIONS.includes(sizeParam) ? sizeParam : DEFAULT_PAGE_SIZE;
  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >({});
  const [pendingEdits, setPendingEdits] = useState<Map<string, PendingEdit>>(
    new Map(),
  );
  const [isSaving, setIsSaving] = useState(false);

  const debouncedSearch = useDebouncedValue(searchValue, 300);

  const qc = useQueryClient();

  const updateParams = useCallback(
    (updates: Record<string, string | number | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      router.replace(`/studio/?${next.toString()}`, {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  const selectedTableFields = useMemo(
    () => schema?.tables.find((t) => t.name === selectedTable)?.fields ?? [],
    [schema, selectedTable],
  );

  const tableRowsResult = useTableRows(
    selectedTable ?? "",
    !!selectedTable,
    page,
    pageSize,
    sortCol,
    sortDir,
    debouncedSearch,
    filtersKey,
  );

  const countResult = useTableRowCount(
    selectedTable ?? "",
    !!selectedTable,
    debouncedSearch,
    filtersKey,
  );
  const total = countResult.data?.total;

  const rowsData = tableRowsResult.data;
  const { isLoading, isError, isFetching } = tableRowsResult;

  const updateRow = useUpdateRow(selectedTable ?? "");
  const { readOnly } = useReadOnly();
  const failedCount = [...pendingEdits.values()].filter((e) => e.error).length;

  function handleSort(col: string) {
    if (sortCol !== col) {
      updateParams({ sort: col, dir: "asc", page: null });
    } else if (sortDir === "asc") {
      updateParams({ sort: col, dir: "desc", page: null });
    } else {
      updateParams({ sort: null, dir: null, page: null });
    }
  }

  function handlePageChange(next: number) {
    updateParams({ page: next === 1 ? null : next });
  }

  function handleSearchChange(v: string) {
    setSearchValue(v);
    updateParams({ search: v || null, page: null });
  }

  function handleRefresh() {
    if (!selectedTable) return;
    qc.invalidateQueries({
      queryKey: tableRowsQueryOptions(
        selectedTable,
        true,
        page,
        pageSize,
        sortCol,
        sortDir,
        debouncedSearch,
        filtersKey,
      ).queryKey,
    });
    qc.invalidateQueries({
      queryKey: tableRowCountQueryOptions(selectedTable, true, debouncedSearch, filtersKey).queryKey,
    });
  }

  function handleExportCsv() {
    if (!selectedTable || !rowsData) return;
    exportToCsv(
      selectedTable,
      rowsData.columns,
      rowsData.rows,
      columnVisibility,
    );
  }

  function handleCellEdit(edit: CellEditPayload) {
    const key = editKey(edit.key, edit.column);

    setPendingEdits((prev) => {
      const next = new Map(prev);
      if (isUnchanged(edit.originalValue, edit.newValue)) {
        next.delete(key); // edited back to what the database holds
      } else {
        next.set(key, { ...edit, error: undefined });
      }
      return next;
    });
  }

  async function handleSaveChanges() {
    if (!selectedTable || pendingEdits.size === 0) return;

    setIsSaving(true);
    const batch = new Map(pendingEdits);
    const failed = new Map<string, string>();

    for (const [key, edit] of batch) {
      try {
        await updateRow.mutateAsync({
          key: edit.key,
          column: edit.column,
          value: edit.newValue,
        });
      } catch (err) {
        failed.set(key, err instanceof Error ? err.message : "Save failed");
      }
    }

    // Saved cells keep showing their new value until the refetch has it,
    // so they never flash back to the old one.
    await qc.invalidateQueries({
      queryKey: queryKeys.tableRows(selectedTable),
    });

    setPendingEdits((prev) => {
      const next = new Map(prev);
      for (const [key, edit] of batch) {
        if (next.get(key) !== edit) continue; // edited again while saving
        const error = failed.get(key);
        if (error) next.set(key, { ...edit, error });
        else next.delete(key);
      }
      return next;
    });

    setIsSaving(false);
  }

  function handleDiscardChanges() {
    setPendingEdits(new Map());
  }

  function handleNavigateFk(
    targetTable: string,
    targetField: string,
    value: string,
  ) {
    setSearchValue("");
    setColumnVisibility({});
    setPendingEdits(new Map());
    updateParams({
      table: targetTable,
      page: null,
      sort: null,
      dir: null,
      search: null,
      filters: serializeFilters([{ column: targetField, op: "eq", values: [value] }]),
    });
  }

  function handleFiltersChange(next: RowFilter[]) {
    updateParams({ filters: serializeFilters(next) || null, page: null });
  }

  return (
    <div className="flex h-full w-full flex-col bg-panel">
      <ExplorerToolbar
        searchValue={searchValue}
        onSearchChange={handleSearchChange}
        onRefresh={handleRefresh}
        isRefreshing={isFetching}
        total={total}
        columns={selectedTableFields.map((f) => f.name)}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        fields={selectedTableFields}
        enums={schema?.enums ?? []}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onExportCsv={handleExportCsv}
        pendingEditsCount={pendingEdits.size}
        failedEditsCount={failedCount}
        isSaving={isSaving}
        onSaveChanges={handleSaveChanges}
        onDiscardChanges={handleDiscardChanges}
      />
      <DataGrid
        tableName={selectedTable ?? ""}
        columns={rowsData?.columns ?? []}
        fields={selectedTableFields}
        enums={schema?.enums ?? []}
        relations={schema?.relations ?? []}
        rows={rowsData?.rows ?? []}
        isLoading={isLoading}
        isError={isError}
        errorMessage={tableRowsResult.error?.message}
        isFiltered={!!debouncedSearch || filters.length > 0}
        sortCol={sortCol}
        sortDir={sortDir}
        onSort={handleSort}
        pendingEdits={pendingEdits}
        onCellEdit={handleCellEdit}
        onNavigateFk={handleNavigateFk}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        readOnlyReason={readOnly ? "The connection is read-only. Turn off Read-only in the top bar to edit rows." : null}
      />
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        hasMore={rowsData?.hasMore ?? false}
        onPageChange={handlePageChange}
        onPageSizeChange={(n) => updateParams({ size: n === DEFAULT_PAGE_SIZE ? null : n, page: null })}
      />
    </div>
  );
}
