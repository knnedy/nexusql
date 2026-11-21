"use client";

import { useState, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useSchema } from "@/shared/hooks/use-schema";
import {
  useTableRows,
  tableRowsQueryOptions,
  DEFAULT_PAGE_SIZE,
} from "@/shared/hooks/use-table-rows";
import { useRowLookup, rowLookupQueryOptions } from "@/shared/hooks/use-row-lookup";
import { useUpdateRow } from "@/features/explorer/hooks/use-update-row";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { useQueryClient } from "@tanstack/react-query";
import { exportToCsv } from "@/features/explorer/lib/csv";
import TableList from "@/features/explorer/_components/table-list";
import DataGrid, {
  type PendingEdit,
  type CellEditPayload,
} from "@/features/explorer/_components/data-grid";
import { editKey } from "@/features/explorer/lib/row-key";
import { isUnchanged } from "@/features/explorer/lib/cell";
import { useReadOnly } from "@/shared/hooks/use-read-only";
import ExplorerToolbar from "@/features/explorer/_components/explorer-toolbar";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250];

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-node-border/60 dark:border-node-border/40 bg-node-bg/95 dark:bg-node-bg/98 shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-text-tertiary font-mono">
          Rows per page
        </span>
        <select
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
            onPageChange(1);
          }}
          className="h-7 rounded-md border border-node-border/60 dark:border-node-border/40 bg-node-bg text-text-secondary text-[11px] font-mono px-2 outline-none cursor-pointer">
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[11px] text-text-tertiary font-mono tabular-nums">
          {from}–{to} of {total.toLocaleString()}
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="flex items-center justify-center w-7 h-7 rounded-md border border-node-border/60 dark:border-node-border/40 bg-transparent text-text-secondary hover:text-text-primary hover:bg-node-border/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            <ChevronLeft size={13} aria-hidden />
          </button>

          <span className="text-[11px] font-mono text-text-secondary tabular-nums px-2">
            {page} / {totalPages}
          </span>

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="flex items-center justify-center w-7 h-7 rounded-md border border-node-border/60 dark:border-node-border/40 bg-transparent text-text-secondary hover:text-text-primary hover:bg-node-border/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            <ChevronRight size={13} aria-hidden />
          </button>
        </div>
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
  const filterField = searchParams.get("filterField") ?? "";
  const filterValue = searchParams.get("filterValue") ?? "";
  const hasFilter = !!filterField && !!filterValue;

  const [searchValue, setSearchValue] = useState(urlSearch);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >({});
  const [pendingEdits, setPendingEdits] = useState<Map<string, PendingEdit>>(
    new Map(),
  );
  const [isSaving, setIsSaving] = useState(false);

  const debouncedSearch = useDebouncedValue(searchValue, 300);

  const qc = useQueryClient();
  const tables = schema?.tables ?? [];

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
      router.replace(`/studio/explorer?${next.toString()}`, {
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
    !!selectedTable && !hasFilter,
    page,
    pageSize,
    sortCol,
    sortDir,
    debouncedSearch,
  );

  const lookupResult = useRowLookup(
    selectedTable ?? "",
    filterField,
    filterValue,
    !!selectedTable && hasFilter,
  );

  const rowsData = hasFilter
    ? lookupResult.data
      ? {
          tableName: lookupResult.data.tableName,
          columns: lookupResult.data.columns,
          rows: lookupResult.data.rows,
          total: lookupResult.data.rows.length,
          page: 1,
          pageSize: lookupResult.data.rows.length,
          sortCol: "",
          sortDir: "asc" as const,
          search: "",
        }
      : undefined
    : tableRowsResult.data;

  const isLoading = hasFilter
    ? lookupResult.isLoading
    : tableRowsResult.isLoading;
  const isError = hasFilter ? lookupResult.isError : tableRowsResult.isError;
  const isFetching = hasFilter
    ? lookupResult.isFetching
    : tableRowsResult.isFetching;

  const updateRow = useUpdateRow(selectedTable ?? "");
  const { readOnly } = useReadOnly();
  const failedCount = [...pendingEdits.values()].filter((e) => e.error).length;

  function handleSelectTable(name: string) {
    setSearchValue("");
    setColumnVisibility({});
    setPendingEdits(new Map());
    updateParams({
      table: name,
      page: null,
      sort: null,
      dir: null,
      search: null,
      filterField: null,
      filterValue: null,
    });
  }

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
    if (hasFilter) {
      qc.invalidateQueries({
        queryKey: rowLookupQueryOptions(
          selectedTable,
          filterField,
          filterValue,
          true,
        ).queryKey,
      });
      return;
    }
    qc.invalidateQueries({
      queryKey: tableRowsQueryOptions(
        selectedTable,
        true,
        page,
        pageSize,
        sortCol,
        sortDir,
        debouncedSearch,
      ).queryKey,
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
    await Promise.all([
      qc.invalidateQueries({
        queryKey: tableRowsQueryOptions(selectedTable, false).queryKey.slice(0, 2),
      }),
      qc.invalidateQueries({
        queryKey: rowLookupQueryOptions(selectedTable, "", "", false).queryKey.slice(0, 2),
      }),
    ]);

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
      filterField: targetField,
      filterValue: value,
    });
  }

  function handleClearFilter() {
    updateParams({ filterField: null, filterValue: null });
  }

  return (
    <div className="w-full h-full flex flex-col bg-canvas-bg">
      <ExplorerToolbar
        tableSelected={!!selectedTable}
        searchValue={searchValue}
        onSearchChange={handleSearchChange}
        onRefresh={handleRefresh}
        isRefreshing={isFetching}
        columns={selectedTableFields.map((f) => f.name)}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        onExportCsv={handleExportCsv}
        pendingEditsCount={pendingEdits.size}
        failedEditsCount={failedCount}
        isSaving={isSaving}
        onSaveChanges={handleSaveChanges}
        onDiscardChanges={handleDiscardChanges}
      />

      {hasFilter && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-node-border/60 dark:border-node-border/40 bg-teal/5 dark:bg-teal/10 shrink-0">
          <span className="text-[11px] font-mono text-teal">
            Filtered by <span className="font-semibold">{filterField}</span> ={" "}
            <span className="font-semibold">{filterValue}</span>
          </span>
          <button
            onClick={handleClearFilter}
            className="flex items-center gap-1 text-[11px] font-medium text-text-tertiary hover:text-text-primary transition-colors border-none bg-transparent cursor-pointer">
            <X size={12} aria-hidden />
            <span>Clear filter</span>
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <TableList
          tables={tables}
          selectedTable={selectedTable}
          onSelectTable={handleSelectTable}
          rowCount={rowsData?.total ?? 0}
        />

        <div className="relative flex flex-col flex-1 overflow-hidden">
          {selectedTable ? (
            <>
              <DataGrid
                tableName={selectedTable}
                columns={rowsData?.columns ?? []}
                fields={selectedTableFields}
                enums={schema?.enums ?? []}
                relations={schema?.relations ?? []}
                rows={rowsData?.rows ?? []}
                isLoading={isLoading}
                isError={isError}
                sortCol={sortCol}
                sortDir={sortDir}
                onSort={handleSort}
                pendingEdits={pendingEdits}
                onCellEdit={handleCellEdit}
                onNavigateFk={handleNavigateFk}
                columnVisibility={columnVisibility}
                onColumnVisibilityChange={setColumnVisibility}
                readOnlyReason={
                  readOnly
                    ? "The connection is read-only. Switch it off in the SQL console to edit rows."
                    : null
                }
              />
              {!hasFilter && (
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={rowsData?.total ?? 0}
                  onPageChange={handlePageChange}
                  onPageSizeChange={setPageSize}
                />
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[12px] text-text-tertiary">
                Select a table to preview its data.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
