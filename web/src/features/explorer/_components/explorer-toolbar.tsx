"use client";

import { Columns3, Download, Loader2, RotateCw, Save, Search } from "lucide-react";
import type { EnumType, Field } from "@/shared/types/schema";
import { Button, IconButton } from "@/shared/ui/button";
import { FilterChip } from "@/shared/ui/chip";
import { Input } from "@/shared/ui/input";
import { Menu, MenuCheckboxItem, MenuContent, MenuItem, MenuSeparator } from "@/shared/ui/menu";
import { describeFilter, type RowFilter } from "../lib/filters";
import FilterMenu from "./filter-menu";

interface ExplorerToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  /** Matching rows; undefined while counting. */
  total: number | undefined;
  columns: string[];
  columnVisibility: Record<string, boolean>;
  onColumnVisibilityChange: (visibility: Record<string, boolean>) => void;
  fields: Field[];
  enums: EnumType[];
  filters: RowFilter[];
  onFiltersChange: (filters: RowFilter[]) => void;
  onExportCsv: () => void;
  pendingEditsCount: number;
  failedEditsCount: number;
  isSaving: boolean;
  onSaveChanges: () => void;
  onDiscardChanges: () => void;
}

/** Search, filters and columns on the left; counts, export and saving on the right. */
export default function ExplorerToolbar(p: ExplorerToolbarProps) {
  const hidden = p.columns.filter((c) => p.columnVisibility[c] === false).length;
  const narrowed = p.filters.length > 0 || p.searchValue.trim() !== "";

  return (
    <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-line bg-panel px-4 py-2">
      <Input
        aria-label="Search rows"
        placeholder="Search rows…"
        value={p.searchValue}
        onChange={(e) => p.onSearchChange(e.target.value)}
        leading={<Search aria-hidden />}
        spellCheck={false}
        autoComplete="off"
        wrapperClassName="w-56"
      />
      {p.filters.map((f, i) => (
        <FilterChip key={i} removeLabel={`Remove filter ${describeFilter(f)}`} onRemove={() => p.onFiltersChange(p.filters.filter((_, j) => j !== i))}>
          <span className="font-mono">{describeFilter(f)}</span>
        </FilterChip>
      ))}
      <FilterMenu fields={p.fields} enums={p.enums} filters={p.filters} onApply={p.onFiltersChange} />
      {p.filters.length > 1 && (
        <Button size="sm" variant="ghost" onClick={() => p.onFiltersChange([])}>
          Clear filters
        </Button>
      )}

      <div className="flex-1" />

      {p.pendingEditsCount > 0 ? (
        <>
          <span role="status" className="inline-flex h-7 items-center gap-1.75 rounded-full bg-accent-tint px-2.5 text-label font-medium text-accent tabular-nums">
            <span aria-hidden className="size-1.5 rounded-full bg-accent-fill" />
            {p.pendingEditsCount} unsaved {p.pendingEditsCount === 1 ? "change" : "changes"}
            {p.failedEditsCount > 0 && ` · ${p.failedEditsCount} failed`}
          </span>
          <Button size="sm" variant="ghost" onClick={p.onDiscardChanges} disabled={p.isSaving}>
            Discard
          </Button>
          <Button size="sm" variant="primary" onClick={p.onSaveChanges} disabled={p.isSaving}>
            {p.isSaving ? <Loader2 aria-hidden className="animate-spin" /> : <Save aria-hidden />}
            {p.isSaving ? "Saving…" : "Save changes"}
          </Button>
        </>
      ) : (
        <>
          <span className="text-label text-fg-subtle tabular-nums">
            {p.total === undefined ? "Counting…" : `${p.total.toLocaleString()} ${narrowed ? "matching " : ""}${p.total === 1 ? "row" : "rows"}`}
          </span>
          <Menu.Root>
            <Menu.Trigger render={<Button size="sm" variant="ghost" />}>
              <Columns3 aria-hidden />
              Columns
              {hidden > 0 && <span className="text-fg-subtle tabular-nums">{hidden} hidden</span>}
            </Menu.Trigger>
            <MenuContent align="end" className="max-h-80 overflow-y-auto">
              {p.columns.map((c) => (
                <MenuCheckboxItem key={c} checked={p.columnVisibility[c] !== false} onCheckedChange={(on) => p.onColumnVisibilityChange({ ...p.columnVisibility, [c]: on })}>
                  <span className="font-mono text-label">{c}</span>
                </MenuCheckboxItem>
              ))}
              {hidden > 0 && (
                <>
                  <MenuSeparator />
                  <MenuItem onClick={() => p.onColumnVisibilityChange({})}>Show all columns</MenuItem>
                </>
              )}
            </MenuContent>
          </Menu.Root>
          <IconButton label="Refresh rows" size="sm" onClick={p.onRefresh} disabled={p.isRefreshing}>
            <RotateCw aria-hidden className={p.isRefreshing ? "motion-safe:animate-spin" : undefined} />
          </IconButton>
          <Button size="sm" onClick={p.onExportCsv}>
            <Download aria-hidden />
            Export CSV
          </Button>
        </>
      )}
    </div>
  );
}
