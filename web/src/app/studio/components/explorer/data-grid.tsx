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

function isNullish(value: unknown): boolean {
  return value === null || value === undefined;
}

function formatCellValue(value: unknown): string {
  if (isNullish(value)) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function CellValue({ value }: { value: unknown }) {
  if (isNullish(value)) {
    return (
      <span className="text-text-tertiary/50 italic font-mono text-[10.5px]">
        null
      </span>
    );
  }

  const formatted = formatCellValue(value);

  return (
    <span
      title={formatted}
      className="block truncate max-w-50 font-mono text-[11px] text-text-secondary/90">
      {formatted}
    </span>
  );
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
        size: 200,
        cell: (info) => <CellValue value={info.getValue()} />,
      })),
    [columns],
  );

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    defaultColumn: {
      size: 200,
      minSize: 80,
    },
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
      <table
        className="text-[11px] font-mono border-collapse"
        style={{ width: table.getTotalSize() }}>
        <thead className="sticky top-0 bg-node-header-bg/95 backdrop-blur-md z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  style={{ width: header.getSize() }}
                  className="px-3 py-2.5 text-left font-semibold text-text-secondary whitespace-nowrap border-b border-node-border/60 dark:border-node-border/40 overflow-hidden">
                  <span className="block truncate">
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </span>
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
                  style={{ width: cell.column.getSize() }}
                  className="px-3 py-2 overflow-hidden">
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
