"use client";

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { useMemo } from "react";
import {
  Key,
  Link,
  Hash,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react";
import type { DatabaseProvider, Field } from "@/lib/types";
import { FIELD_TYPE_BADGE_MAP } from "@/lib/types";
import { normalizeFieldType } from "@/lib/utils";
import { useStudioStore } from "@/lib/store/studio-store";

interface DataGridProps {
  columns: string[];
  fields: Field[];
  rows: Record<string, unknown>[];
  isLoading: boolean;
  isError: boolean;
  sortCol: string;
  sortDir: "asc" | "desc";
  onSort: (col: string) => void;
  columnVisibility: Record<string, boolean>;
  onColumnVisibilityChange: (visibility: Record<string, boolean>) => void;
}

function isNullish(value: unknown): boolean {
  return value === null || value === undefined;
}

function formatCellValue(value: unknown): string {
  if (isNullish(value)) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function CellValue({
  value,
  isForeignKey,
}: {
  value: unknown;
  isForeignKey?: boolean;
}) {
  if (isNullish(value)) {
    return (
      <div className="group flex items-center justify-between gap-1.5 min-w-0">
        <span className="text-text-tertiary/50 italic font-mono text-[10.5px]">
          null
        </span>
        {isForeignKey && (
          <Link
            size={11}
            className="text-teal shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-hidden
          />
        )}
      </div>
    );
  }

  const formatted = formatCellValue(value);

  return (
    <div className="group flex items-center justify-between gap-1.5 min-w-0">
      <span
        title={formatted}
        className="block truncate font-mono text-[11px] text-text-secondary/90">
        {formatted}
      </span>
      {isForeignKey && (
        <Link
          size={11}
          className="text-teal shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-hidden
        />
      )}
    </div>
  );
}

function SortIcon({
  col,
  sortCol,
  sortDir,
}: {
  col: string;
  sortCol: string;
  sortDir: "asc" | "desc";
}) {
  if (sortCol !== col) {
    return (
      <ChevronsUpDown
        size={10}
        className="text-text-secondary shrink-0 group-hover:text-text-primary transition-colors"
        aria-hidden
      />
    );
  }
  return sortDir === "asc" ? (
    <ChevronUp size={10} className="text-teal shrink-0" aria-hidden />
  ) : (
    <ChevronDown size={10} className="text-teal shrink-0" aria-hidden />
  );
}

function ColumnHeader({
  field,
  provider,
  sortCol,
  sortDir,
  onSort,
}: {
  field: Field | undefined;
  provider: DatabaseProvider;
  sortCol: string;
  sortDir: "asc" | "desc";
  onSort: (col: string) => void;
}) {
  if (!field) return null;

  const canonicalType = normalizeFieldType(field.type, provider);
  const variant = FIELD_TYPE_BADGE_MAP[canonicalType] ?? "gray";
  const isActive = sortCol === field.name;

  const badgeStyles = {
    teal: "bg-badge-teal-bg/15 text-badge-teal-text dark:bg-badge-teal-bg/20 dark:text-teal border-black/2 dark:border-white/2",
    coral:
      "bg-badge-coral-bg/15 text-badge-coral-text dark:bg-badge-coral-bg/20 dark:text-coral border-black/2 dark:border-white/2",
    gray: "bg-badge-gray-bg/50 text-badge-gray-text dark:bg-badge-gray-bg/20 dark:text-text-secondary border-black/2 dark:border-white/2",
  } as const;

  return (
    <button
      onClick={() => onSort(field.name)}
      className={`w-full flex flex-col gap-1 min-w-0 text-left bg-transparent border-none cursor-pointer p-0 group ${
        isActive ? "opacity-100" : "opacity-90 hover:opacity-100"
      }`}>
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
        <span
          className={`truncate text-[11px] font-semibold font-mono tracking-tight ${
            isActive ? "text-text-primary" : "text-text-secondary"
          }`}>
          {field.name}
        </span>
        <SortIcon col={field.name} sortCol={sortCol} sortDir={sortDir} />
      </div>
      <span
        className={`inline-flex items-center self-start rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider border font-mono ${badgeStyles[variant]}`}>
        {field.type}
      </span>
    </button>
  );
}

const ROW_NUMBER_COLUMN: ColumnDef<Record<string, unknown>> = {
  id: "__row_number__",
  header: () => (
    <span className="text-[10px] font-mono text-text-secondary select-none">
      #
    </span>
  ),
  size: 48,
  enableResizing: false,
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
  sortCol,
  sortDir,
  onSort,
  columnVisibility,
  onColumnVisibilityChange,
}: DataGridProps) {
  "use no memo";

  const provider = useStudioStore((s) => s.provider);

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
          header: () => (
            <ColumnHeader
              provider={provider}
              field={fieldMap.get(col)}
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={onSort}
            />
          ),
          size: 200,
          minSize: 80,
          cell: (info) => (
            <CellValue
              value={info.getValue()}
              isForeignKey={fieldMap.get(col)?.isForeignKey}
            />
          ),
        }),
      ),
    ],
    [provider, columns, fieldMap, sortCol, sortDir, onSort],
  );

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    state: {
      columnVisibility,
    },
    onColumnVisibilityChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(columnVisibility) : updater;
      onColumnVisibilityChange(next);
    },
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
        className="text-[11px] font-mono border-collapse table-fixed"
        style={{ width: table.getTotalSize() }}>
        <colgroup>
          {table.getVisibleLeafColumns().map((col) => (
            <col key={col.id} style={{ width: col.getSize() }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 bg-node-header-bg/95 backdrop-blur-md z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={`relative px-3 py-2.5 text-left whitespace-nowrap border-b border-node-border/60 dark:border-node-border/40 overflow-hidden ${
                    header.column.id === "__row_number__"
                      ? "bg-node-header-bg/80 border-r border-node-border/40 dark:border-node-border/20"
                      : ""
                  }`}>
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                  {header.column.getCanResize() && (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={`absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none opacity-0 hover:opacity-100 transition-opacity ${
                        header.column.getIsResizing()
                          ? "bg-teal opacity-100"
                          : "bg-node-border/60 dark:bg-node-border/40"
                      }`}
                      aria-hidden
                    />
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
              className="border-t-[0.5px] border-node-row-border/60 transition-colors hover:bg-black/2 dark:hover:bg-white/2">
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
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
