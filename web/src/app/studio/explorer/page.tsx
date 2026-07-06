"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSchema } from "@/hooks/use-schema";
import {
  useTableRows,
  tableRowsQueryOptions,
  DEFAULT_PAGE_SIZE,
} from "@/hooks/use-table-rows";
import { useUpdateRow } from "@/hooks/use-update-row";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useQueryClient } from "@tanstack/react-query";
import { exportToCsv } from "@/lib/utils";
import TableList from "./components/table-list";
import DataGrid, {
  buildEditKey,
  type PendingEdit,
  type CellEditPayload,
} from "./components/data-grid";
import ExplorerToolbar from "./components/explorer-toolbar";

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

export default function ExplorerPage() {
  const { data: schema } = useSchema();
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedTable = searchParams.get("table");
  const page = Number(searchParams.get("page") ?? "1");
  const sortCol = searchParams.get("sort") ?? "";
  const sortDir = (searchParams.get("dir") as "asc" | "desc") ?? "asc";
  const urlSearch = searchParams.get("search") ?? "";

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

  const {
    data: rowsData,
    isLoading,
    isError,
    isFetching,
  } = useTableRows(
    selectedTable ?? "",
    !!selectedTable,
    page,
    pageSize,
    sortCol,
    sortDir,
    debouncedSearch,
  );

  const updateRow = useUpdateRow(selectedTable ?? "");

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
    const key = buildEditKey(edit.pkValue, edit.targetField);

    setPendingEdits((prev) => {
      const next = new Map(prev);

      if (edit.newValue === String(edit.originalValue ?? "")) {
        next.delete(key);
        return next;
      }

      next.set(key, {
        pkField: edit.pkField,
        pkValue: edit.pkValue,
        targetField: edit.targetField,
        newValue: edit.newValue,
        originalValue: edit.originalValue,
      });
      return next;
    });
  }

  async function handleSaveChanges() {
    if (!selectedTable || pendingEdits.size === 0) return;

    setIsSaving(true);
    const failedKeys: string[] = [];

    for (const [key, edit] of pendingEdits) {
      try {
        await updateRow.mutateAsync({
          pkField: edit.pkField,
          pkValue: edit.pkValue,
          targetField: edit.targetField,
          newValue: edit.newValue,
        });
      } catch {
        failedKeys.push(key);
      }
    }

    setPendingEdits((prev) => {
      const next = new Map<string, PendingEdit>();
      for (const key of failedKeys) {
        const edit = prev.get(key);
        if (edit) next.set(key, edit);
      }
      return next;
    });

    setIsSaving(false);
  }

  function handleDiscardChanges() {
    setPendingEdits(new Map());
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
        isSaving={isSaving}
        onSaveChanges={handleSaveChanges}
        onDiscardChanges={handleDiscardChanges}
      />

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
                columns={rowsData?.columns ?? []}
                fields={selectedTableFields}
                enums={schema?.enums ?? []}
                rows={rowsData?.rows ?? []}
                isLoading={isLoading}
                isError={isError}
                sortCol={sortCol}
                sortDir={sortDir}
                onSort={handleSort}
                pendingEdits={pendingEdits}
                onCellEdit={handleCellEdit}
                columnVisibility={columnVisibility}
                onColumnVisibilityChange={setColumnVisibility}
              />
              <Pagination
                page={page}
                pageSize={pageSize}
                total={rowsData?.total ?? 0}
                onPageChange={handlePageChange}
                onPageSizeChange={setPageSize}
              />
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
