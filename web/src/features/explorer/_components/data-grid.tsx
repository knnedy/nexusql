"use client";

import {
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  flexRender,
  tableFeatures,
  useTable,
  type ColumnDef,
  type Row,
} from "@tanstack/react-table";
import { useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpRight, ChevronsUpDown, Lock, TableProperties, TriangleAlert } from "lucide-react";

import { useStudioStore } from "@/shared/store/studio-store";
import type { EnumType, Field, Relation } from "@/shared/types/schema";
import { cx } from "@/shared/lib/cx";
import { EmptyState } from "@/shared/ui/empty-state";
import { Skeleton } from "@/shared/ui/surface";
import { normalizeFieldType } from "@/shared/lib/utils";
import { editKey as cellKey, rowKey, type RowKey } from "../lib/row-key";
import { cellText, isUnchanged } from "../lib/cell";

export interface PendingEdit {
  key: RowKey;
  column: string;
  newValue: string | null; // null writes SQL NULL
  originalValue: unknown;
  error?: string; // why the last save of this edit failed
}

export type CellEditPayload = PendingEdit;

interface DataGridProps {
  tableName: string;
  columns: string[];
  fields: Field[];
  enums: EnumType[];
  relations: Relation[];
  rows: Record<string, unknown>[];
  isLoading: boolean;
  isError: boolean;
  /** Why the rows failed to load, when the server said. */
  errorMessage?: string;
  /** Search or filters are narrowing the rows. */
  isFiltered?: boolean;
  sortCol: string;
  sortDir: "asc" | "desc";
  onSort: (col: string) => void;
  pendingEdits: Map<string, PendingEdit>;
  onCellEdit: (edit: CellEditPayload) => void;
  onNavigateFk: (
    targetTable: string,
    targetField: string,
    value: string,
  ) => void;
  columnVisibility: Record<string, boolean>;
  onColumnVisibilityChange: (visibility: Record<string, boolean>) => void;
  /** Why rows cannot be edited (e.g. a read-only connection); null when they can. */
  readOnlyReason: string | null;
}

// sizing must be registered before resizing, which builds on it
const features = tableFeatures({
  columnVisibilityFeature,
  columnSizingFeature,
  columnResizingFeature,
});
type GridRow = Record<string, unknown>;
type GridColumn = ColumnDef<typeof features, GridRow>;

const NULL_OPTION = "\u0000null"; // a value no enum or boolean option can have
const BOOLEAN_OPTIONS = ["true", "false"];
const NUMERIC_TYPES = new Set([
  "integer", "bigint", "smallint", "serial", "bigserial",
  "numeric", "real", "double precision",
]);

// Values read better in mono when their shape matters: times, ids, JSON, bytes.
const MONO_TYPES = new Set(["uuid", "date", "time", "timestamp", "timestamptz", "interval", "json", "jsonb", "bytea"]);

function formatCellValue(value: unknown): string {
  return cellText(value) ?? "null";
}

function Marker({ children, pending }: { children: string; pending: boolean }) {
  return <span className={cx("text-label italic", pending ? "font-medium text-accent" : "text-fg-subtle")}>{children}</span>;
}

const EDITOR = "h-7 rounded-control border border-accent bg-panel px-1.5 text-body text-fg outline-none ring-3 ring-accent-tint";

interface EditableCellProps {
  value: unknown;
  field: Field;
  options: string[] | null; // a picker instead of free text (enums, booleans)
  numeric: boolean;
  mono: boolean;
  isEnum: boolean;
  canEdit: boolean;
  isEditing: boolean;
  pending: PendingEdit | undefined;
  onStartEdit: () => void;
  onCommit: (next: string | null) => void;
  onCancel: () => void;
  onNavigate: (() => void) | null;
}

function EditableCell({
  value,
  field,
  options,
  numeric,
  mono,
  isEnum,
  canEdit,
  isEditing,
  pending,
  onStartEdit,
  onCommit,
  onCancel,
  onNavigate,
}: EditableCellProps) {
  const current = pending ? pending.newValue : cellText(value);
  const [localValue, setLocalValue] = useState(current ?? "");
  const suppressBlurRef = useRef(false);

  if (isEditing) {
    if (options) {
      return (
        <select
          autoFocus
          defaultValue={current ?? NULL_OPTION}
          onChange={(e) =>
            onCommit(e.target.value === NULL_OPTION ? null : e.target.value)
          }
          onBlur={onCancel}
          className={cx(EDITOR, "w-full")}>
          {field.nullable && <option value={NULL_OPTION}>NULL</option>}
          {options.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      );
    }

    return (
      <div className="flex items-center gap-1">
        <input
          aria-label={`Edit ${field.name}`}
          autoFocus
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              suppressBlurRef.current = true;
              onCommit(localValue);
            } else if (e.key === "Escape") {
              suppressBlurRef.current = true;
              onCancel();
            }
          }}
          onBlur={() => {
            if (suppressBlurRef.current) {
              suppressBlurRef.current = false;
              return;
            }
            onCommit(localValue);
          }}
          className={cx(EDITOR, "min-w-0 flex-1", mono && "font-mono text-label", numeric && "text-right tabular-nums")}
        />
        {field.nullable && (
          <button
            type="button"
            aria-label="Set NULL"
            title="Set NULL"
            // keep focus in the input so its blur does not commit the text first
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              suppressBlurRef.current = true;
              onCommit(null);
            }}
            className="h-7 shrink-0 cursor-pointer rounded-control border border-line-strong bg-panel px-1.5 font-mono text-caption font-semibold text-fg-muted hover:border-fg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-accent">
            NULL
          </button>
        )}
      </div>
    );
  }

  const error = pending?.error;
  const title =
    typeof value === "object" && value !== null && !pending
      ? JSON.stringify(value, null, 2)
      : (current ?? undefined);

  return (
    <div
      onDoubleClick={canEdit ? onStartEdit : undefined}
      className={cx("group/cell flex min-w-0 items-center gap-1.5", numeric && "justify-end", canEdit && "cursor-text")}>
      {error ? (
        <AlertCircle size={13} className="shrink-0 text-danger" aria-label={`Save failed: ${error}`} role="img">
          <title>{`Save failed: ${error}`}</title>
        </AlertCircle>
      ) : (
        pending && <span className="size-1.5 shrink-0 rounded-full bg-accent-fill" title="Unsaved change" aria-hidden />
      )}
      {current === null ? (
        <Marker pending={!!pending}>null</Marker>
      ) : current === "" ? (
        <Marker pending={!!pending}>empty</Marker>
      ) : isEnum && !pending ? (
        <span title={title} className="inline-flex min-w-0 items-center gap-1.5 text-label text-fg-muted">
          <span aria-hidden className="size-1.75 shrink-0 rounded-xs bg-relation-line" />
          <span className="truncate">{current}</span>
        </span>
      ) : (
        <span
          title={title}
          className={cx(
            "block truncate",
            mono && "font-mono text-label",
            numeric && "tabular-nums",
            pending ? "font-medium text-accent" : field.isForeignKey ? "text-relation" : "text-fg",
          )}>
          {current}
        </span>
      )}
      {field.isForeignKey && onNavigate && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate();
          }}
          aria-label="Go to related row"
          title="Go to related row"
          className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-sm text-relation opacity-0 group-hover/cell:opacity-100 hover:bg-relation-tint focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent">
          <ArrowUpRight size={13} aria-hidden />
        </button>
      )}
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ChevronsUpDown size={12} aria-hidden className="shrink-0 text-fg-subtle opacity-0 group-hover/th:opacity-100" />;
  return dir === "asc" ? <ArrowUp size={12} aria-hidden className="shrink-0 text-accent" /> : <ArrowDown size={12} aria-hidden className="shrink-0 text-accent" />;
}

/** Name over a mono line: type, then PK or where the key points. */
function ColumnHeader({ field, target, numeric, sortCol, sortDir, onSort }: { field: Field; target: string | undefined; numeric: boolean; sortCol: string; sortDir: "asc" | "desc"; onSort: (col: string) => void }) {
  const active = sortCol === field.name;
  return (
    <button
      type="button"
      onClick={() => onSort(field.name)}
      aria-label={`Sort by ${field.name}`}
      className={cx("group/th flex w-full min-w-0 cursor-pointer flex-col py-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent", numeric && "items-end text-right")}>
      <span className={cx("flex max-w-full items-center gap-1", numeric && "flex-row-reverse")}>
        <span className={cx("truncate text-body font-medium", active ? "text-fg" : "text-fg-muted")}>{field.name}</span>
        <SortIcon active={active} dir={sortDir} />
      </span>
      <span className="mt-0.5 max-w-full truncate font-mono text-caption font-normal text-fg-subtle">
        {field.type}
        {field.isPrimaryKey && " · PK"}
        {target && <span className="text-relation"> · → {target}</span>}
      </span>
    </button>
  );
}

export default function DataGrid({
  tableName,
  columns,
  fields,
  enums,
  relations,
  rows,
  isLoading,
  isError,
  errorMessage,
  isFiltered = false,
  sortCol,
  sortDir,
  onSort,
  pendingEdits,
  onCellEdit,
  onNavigateFk,
  columnVisibility,
  onColumnVisibilityChange,
  readOnlyReason,
}: DataGridProps) {
  "use no memo";

  const provider = useStudioStore((s) => s.provider);
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    columnId: string;
  } | null>(null);

  const fieldMap = useMemo(
    () => new Map(fields.map((f) => [f.name, f])),
    [fields],
  );

  const enumMap = useMemo(
    () => new Map(enums.map((e) => [e.name, e])),
    [enums],
  );

  const relationMap = useMemo(
    () =>
      new Map(
        relations
          // composite keys cannot be followed from one cell
          .filter((r) => r.sourceTable === tableName && r.sourceFields.length === 1)
          .map((r) => [r.sourceField, r]),
      ),
    [relations, tableName],
  );

  const hasPrimaryKey = useMemo(() => fields.some((f) => f.isPrimaryKey), [fields]);
  const lockedReason =
    readOnlyReason ??
    (hasPrimaryKey
      ? null
      : "This table has no primary key, so its rows cannot be edited.");

  const tableColumns = useMemo<GridColumn[]>(
    () =>
      columns.map((col): GridColumn => {
        const field = fieldMap.get(col);
        const enumType = field ? enumMap.get(field.type) : undefined;
        const canonical = field ? normalizeFieldType(field.type, provider) : null;
        const options = enumType
          ? enumType.values
          : canonical === "boolean"
            ? BOOLEAN_OPTIONS
            : null;
        const canEdit = !!field && !lockedReason && !field.isPrimaryKey;
        const relation = relationMap.get(col);
        const numeric = !!canonical && NUMERIC_TYPES.has(canonical);
        return {
          accessorKey: col,
          header: () =>
            field ? (
              <ColumnHeader field={field} target={relation?.targetTable} numeric={numeric} sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
            ) : (
              col
            ),
          size: 200,
          minSize: 80,
          cell: (info) => {
            if (!field) {
              return (
                <span className="font-mono text-label">{formatCellValue(info.getValue())}</span>
              );
            }

            const row: Row<typeof features, GridRow> = info.row;
            const isEditing =
              editingCell?.rowId === row.id && editingCell?.columnId === col;

            const key = rowKey(fields, row.original);
            const pending = key ? pendingEdits.get(cellKey(key, col)) : undefined;
            const cellValue = info.getValue();

            return (
              <EditableCell
                key={isEditing ? "editing" : "display"}
                value={cellValue}
                field={field}
                options={options}
                numeric={numeric}
                mono={!!canonical && MONO_TYPES.has(canonical)}
                isEnum={!!enumType}
                canEdit={canEdit}
                isEditing={isEditing}
                pending={pending}
                onStartEdit={() =>
                  setEditingCell({ rowId: row.id, columnId: col })
                }
                onCancel={() => setEditingCell(null)}
                onCommit={(newValue) => {
                  setEditingCell(null);
                  const original = row.original[col];
                  if (!key || (!pending && isUnchanged(original, newValue))) {
                    return;
                  }
                  onCellEdit({ key, column: col, newValue, originalValue: original });
                }}
                onNavigate={
                  relation && cellText(cellValue) !== null
                    ? () =>
                        onNavigateFk(
                          relation.targetTable,
                          relation.targetField,
                          String(cellValue),
                        )
                    : null
                }
              />
            );
          },
        };
      }),
    [
      provider,
      columns,
      fieldMap,
      enumMap,
      relationMap,
      fields,
      lockedReason,
      sortCol,
      sortDir,
      onSort,
      editingCell,
      pendingEdits,
      onCellEdit,
      onNavigateFk,
    ],
  );

  const table = useTable({
    features,
    data: rows,
    columns: tableColumns,
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
      <div aria-busy className="flex-1 overflow-hidden">
        <div className="h-12 border-b border-line-strong" />
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex h-8.5 items-center gap-6 border-b border-line px-3.5">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="grid flex-1 place-items-center">
        <EmptyState icon={<TriangleAlert aria-hidden />} title="The rows did not load">
          {errorMessage ?? "The database did not answer."} Refresh to try again.
        </EmptyState>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="grid flex-1 place-items-center">
        <EmptyState icon={<TableProperties aria-hidden />} title={isFiltered ? "No rows match" : "This table is empty"}>
          {isFiltered ? "Loosen the search or remove a filter to see more rows." : "Rows appear here once the table has data."}
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto overscroll-contain">
      {lockedReason && (
        <div role="status" className="sticky left-0 flex items-center gap-1.75 border-b border-line bg-sunk px-4 py-1.5 text-label text-fg-muted">
          <Lock size={12} aria-hidden />
          {lockedReason}
        </div>
      )}
      <table className="table-fixed border-separate border-spacing-0 text-body" style={{ width: table.getTotalSize() }}>
        <colgroup>
          {table.getVisibleLeafColumns().map((col) => (
            <col key={col.id} style={{ width: col.getSize() }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-10 bg-panel">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  aria-sort={sortCol === header.column.id ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                  className="relative overflow-hidden border-b border-line-strong px-3.5 text-left font-normal whitespace-nowrap">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getCanResize() && (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      aria-hidden
                      className={cx(
                        "absolute top-0 right-0 h-full w-1 cursor-col-resize touch-none select-none",
                        header.column.getIsResizing() ? "bg-accent" : "hover:bg-line-strong",
                      )}
                    />
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="hover:bg-sunk/60">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="h-8.5 overflow-hidden border-b border-line px-3.5 whitespace-nowrap">
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
