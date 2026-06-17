"use client";

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { useMemo } from "react";

interface DataGridProps {
  columns: string[];
  rows: Record<string, unknown>[];
  isLoading: boolean;
  isError: boolean;
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function DataGrid({
  columns,
  rows,
  isLoading,
  isError,
}: DataGridProps) {
  "use no memo";
  const tableColumns = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () =>
      columns.map((col) => ({
        accessorKey: col,
        header: col,
        cell: (info) => formatCellValue(info.getValue()),
      })),
    [columns],
  );

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-teal border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-[12px] text-text-tertiary">
          Failed to load table data.
        </span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-[12px] text-text-tertiary">
          No rows found in this table.
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-[11px] font-mono border-collapse">
        <thead className="sticky top-0 bg-node-header-bg/95 backdrop-blur-md z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-3 py-2.5 text-left font-semibold text-text-secondary whitespace-nowrap border-b border-node-border/60 dark:border-node-border/40">
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="border-t-[0.5px] border-node-row-border/60 hover:bg-black/2 dark:hover:bg-white/2 transition-colors">
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className="px-3 py-2 text-text-secondary/90 whitespace-nowrap max-w-55 truncate">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
