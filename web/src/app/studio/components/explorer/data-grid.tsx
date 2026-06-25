"use client";

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { useMemo } from "react";
import { Key, Link, Hash } from "lucide-react";
import type { Field } from "@/lib/types";
import { FIELD_TYPE_BADGE_MAP } from "@/lib/types";

interface DataGridProps {
  columns: string[];
  fields: Field[];
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

function ColumnHeader({ field }: { field: Field | undefined }) {
  if (!field) return null;

  const variant = FIELD_TYPE_BADGE_MAP[field.type] ?? "gray";

  const badgeStyles = {
    teal: "bg-badge-teal-bg/15 text-badge-teal-text dark:bg-badge-teal-bg/20 dark:text-teal border-black/2 dark:border-white/2",
    coral:
      "bg-badge-coral-bg/15 text-badge-coral-text dark:bg-badge-coral-bg/20 dark:text-coral border-black/2 dark:border-white/2",
    gray: "bg-badge-gray-bg/50 text-badge-gray-text dark:bg-badge-gray-bg/20 dark:text-text-secondary border-black/2 dark:border-white/2",
  } as const;

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-1.5 min-w-0">
        {field.isPrimaryKey && (
          <Key size={9} className="text-coral shrink-0" aria-hidden />
        )}
        {field.isForeignKey && !field.isPrimaryKey && (
          <Link size={9} className="text-teal shrink-0" aria-hidden />
        )}
        {!field.isPrimaryKey && !field.isForeignKey && (
          <Hash
            size={9}
            className="text-text-tertiary/50 shrink-0"
            aria-hidden
          />
        )}
        <span className="truncate text-[11px] font-semibold text-text-secondary font-mono tracking-tight">
          {field.name}
        </span>
      </div>
      <span
        className={`inline-flex items-center self-start rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider border font-mono ${badgeStyles[variant]}`}>
        {field.type}
      </span>
    </div>
  );
}

const ROW_NUMBER_COLUMN: ColumnDef<Record<string, unknown>> = {
  id: "__row_number__",
  header: () => (
    <span className="text-[10px] font-mono text-text-tertiary/50 select-none">
      #
    </span>
  ),
  size: 48,
  cell: (info) => (
    <span className="text-[10.5px] font-mono text-text-tertiary/40 select-none tabular-nums">
      {info.row.index + 1}
    </span>
  ),
};

export default function DataGrid({
  columns,
  fields,
  rows,
  isLoading,
  isError,
}: DataGridProps) {
  "use no memo";

  const fieldMap = useMemo(
    () => new Map(fields.map((f) => [f.name, f])),
    [fields],
  );

  const tableColumns = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () => [
      ROW_NUMBER_COLUMN,
      ...columns.map(
        (col): ColumnDef<Record<string, unknown>> => ({
          accessorKey: col,
          header: () => <ColumnHeader field={fieldMap.get(col)} />,
          size: 200,
          cell: (info) => <CellValue value={info.getValue()} />,
        }),
      ),
    ],
    [columns, fieldMap],
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
                  className={`px-3 py-2.5 text-left whitespace-nowrap border-b border-node-border/60 dark:border-node-border/40 overflow-hidden ${
                    header.column.id === "__row_number__"
                      ? "bg-node-header-bg/80 border-r border-node-border/40 dark:border-node-border/20"
                      : ""
                  }`}>
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
                  style={{ width: cell.column.getSize() }}
                  className={`px-3 py-2 overflow-hidden ${
                    cell.column.id === "__row_number__"
                      ? "bg-node-header-bg/40 border-r border-node-border/40 dark:border-node-border/20"
                      : ""
                  }`}>
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
