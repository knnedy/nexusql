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
import {
  AlertCircle,
  Key,
  Link,
  Hash,
  Lock,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react";

import { useStudioStore } from "@/shared/store/studio-store";
import {
  EnumType,
  Field,
  FIELD_TYPE_BADGE_MAP,
  Relation,
} from "@/shared/types/schema";
import { DatabaseProvider } from "@/shared/types/provider";
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

function formatCellValue(value: unknown): string {
  return cellText(value) ?? "null";
}

function Marker({ children, tone }: { children: string; tone: "muted" | "coral" }) {
  return (
    <span
      className={`italic font-mono text-[10.5px] ${
        tone === "coral" ? "text-coral font-semibold" : "text-text-tertiary/50"
      }`}>
      {children}
    </span>
  );
}

interface EditableCellProps {
  value: unknown;
  field: Field;
  options: string[] | null; // a picker instead of free text (enums, booleans)
  numeric: boolean;
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
          className="w-full h-6 rounded border border-teal bg-node-bg text-[11px] font-mono text-text-primary px-1 outline-none ring-1 ring-teal/40">
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
          className="min-w-0 flex-1 h-6 rounded border border-teal bg-node-bg text-[11px] font-mono text-text-primary px-1 outline-none ring-1 ring-teal/40"
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
            className="shrink-0 h-6 px-1.5 rounded border border-node-border/60 dark:border-node-border/40 bg-transparent text-[9.5px] font-mono font-semibold text-text-tertiary hover:text-text-primary hover:border-teal/60 transition-colors cursor-pointer">
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
      className={`group flex items-center justify-between gap-1.5 min-w-0 ${
        canEdit ? "cursor-text" : ""
      }`}>
      <div className="flex items-center gap-1.5 min-w-0">
        {error ? (
          <AlertCircle
            size={11}
            className="text-coral shrink-0"
            aria-label={`Save failed: ${error}`}
            role="img"
          >
            <title>{`Save failed: ${error}`}</title>
          </AlertCircle>
        ) : (
          pending && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-coral shrink-0"
              title="Unsaved change"
              aria-hidden
            />
          )
        )}
        {current === null ? (
          <Marker tone={pending ? "coral" : "muted"}>null</Marker>
        ) : current === "" ? (
          <Marker tone={pending ? "coral" : "muted"}>empty</Marker>
        ) : (
          <span
            title={title}
            className={`block truncate font-mono text-[11px] ${numeric ? "tabular-nums" : ""} ${
              pending ? "text-coral font-semibold" : "text-text-secondary/90"
            }`}>
            {current}
          </span>
        )}
      </div>
      {field.isForeignKey && (
        <button
          onClick={(e) => {
            if (!onNavigate) return;
            e.stopPropagation();
            onNavigate();
          }}
          disabled={!onNavigate}
          title={onNavigate ? "Go to related row" : undefined}
          className={`shrink-0 opacity-0 group-hover:opacity-100 transition-opacity border-none bg-transparent p-0 ${
            onNavigate
              ? "cursor-pointer text-teal"
              : "cursor-default text-text-tertiary/40"
          }`}>
          <Link size={11} aria-hidden />
        </button>
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

const ROW_NUMBER_COLUMN: GridColumn = {
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
    () => [
      ROW_NUMBER_COLUMN,
      ...columns.map((col): GridColumn => {
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

        return {
          accessorKey: col,
          header: () => (
            <ColumnHeader
              provider={provider}
              field={field}
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={onSort}
            />
          ),
          size: 200,
          minSize: 80,
          cell: (info) => {
            if (!field) {
              return (
                <span className="font-mono text-[11px]">
                  {formatCellValue(info.getValue())}
                </span>
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
                numeric={!!canonical && NUMERIC_TYPES.has(canonical)}
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
    ],
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
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-teal border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="max-w-md px-4 text-center text-[12px] text-text-tertiary">
          {errorMessage ? `Failed to load table data: ${errorMessage}` : "Failed to load table data."}
        </span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-[12px] text-text-tertiary">
          {isFiltered ? "No rows match the search or filters." : "No rows found in this table."}
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {lockedReason && (
        <div
          role="status"
          className="sticky left-0 flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-text-tertiary border-b border-node-border/60 dark:border-node-border/40 bg-node-header-bg/60">
          <Lock size={11} aria-hidden />
          <span>{lockedReason}</span>
        </div>
      )}
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
