"use client";

import { useState, useMemo } from "react";
import { useStudioStore } from "@/lib/store/studio-store";
import { useSchema } from "@/hooks/use-schema";
import { useTableRows, tableRowsQueryOptions } from "@/hooks/use-table-rows";
import { useQueryClient } from "@tanstack/react-query";
import TableList from "./table-list";
import DataGrid from "./data-grid";
import ExplorerToolbar from "./explorer-toolbar";

export default function Explorer() {
  const { data: schema } = useSchema();
  const selectedTable = useStudioStore((s) => s.selectedTable);
  const setSelectedTable = useStudioStore((s) => s.setSelectedTable);
  const [searchValue, setSearchValue] = useState("");

  const qc = useQueryClient();
  const tables = schema?.tables ?? [];

  const {
    data: rowsData,
    isLoading,
    isError,
    isFetching,
  } = useTableRows(selectedTable ?? "", !!selectedTable);

  const filteredRows = useMemo(() => {
    if (!rowsData) return [];
    if (!searchValue.trim()) return rowsData.rows;

    const needle = searchValue.toLowerCase();
    return rowsData.rows.filter((row) =>
      Object.values(row).some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(needle),
      ),
    );
  }, [rowsData, searchValue]);

  function handleSelectTable(name: string) {
    setSelectedTable(name);
    setSearchValue("");
  }

  function handleRefresh() {
    if (!selectedTable) return;
    qc.invalidateQueries({
      queryKey: tableRowsQueryOptions(selectedTable, true).queryKey,
    });
  }

  return (
    <div className="w-full h-full flex flex-col bg-canvas-bg">
      <ExplorerToolbar
        tableName={selectedTable}
        rowCount={filteredRows.length}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onRefresh={handleRefresh}
        isRefreshing={isFetching}
      />

      <div className="flex flex-1 overflow-hidden">
        <TableList
          tables={tables}
          selectedTable={selectedTable}
          onSelectTable={handleSelectTable}
        />

        {selectedTable ? (
          <DataGrid
            columns={rowsData?.columns ?? []}
            rows={filteredRows}
            isLoading={isLoading}
            isError={isError}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[12px] text-text-tertiary">
              Select a table to preview its data.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
