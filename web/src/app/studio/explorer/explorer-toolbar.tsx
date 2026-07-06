"use client";

import { useState, useRef, useEffect } from "react";
import {
  Database,
  Search,
  RotateCw,
  Columns3,
  Check,
  Download,
  Save,
  X,
  Loader2,
} from "lucide-react";
import { useStudioStore } from "@/lib/store/studio-store";
import ModeSwitcher from "../components/mode-switcher";
import DisconnectButton from "../components/disconnect-button";
import ThemeToggle from "./theme-toggle";

interface ExplorerToolbarProps {
  tableSelected: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  columns: string[];
  columnVisibility: Record<string, boolean>;
  onColumnVisibilityChange: (visibility: Record<string, boolean>) => void;
  onExportCsv: () => void;
  pendingEditsCount: number;
  isSaving: boolean;
  onSaveChanges: () => void;
  onDiscardChanges: () => void;
}

export default function ExplorerToolbar({
  tableSelected,
  searchValue,
  onSearchChange,
  onRefresh,
  isRefreshing,
  columns = [],
  columnVisibility,
  onColumnVisibilityChange,
  onExportCsv,
  pendingEditsCount,
  isSaving,
  onSaveChanges,
  onDiscardChanges,
}: ExplorerToolbarProps) {
  const provider = useStudioStore((s) => s.provider);
  const projectName = useStudioStore((s) => s.projectName);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!columnsOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setColumnsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [columnsOpen]);

  const hiddenCount = columns.filter(
    (col) => columnVisibility[col] === false,
  ).length;

  const hasPendingEdits = pendingEditsCount > 0;

  function toggleColumn(col: string) {
    onColumnVisibilityChange({
      ...columnVisibility,
      [col]: columnVisibility[col] === false ? true : false,
    });
  }

  function showAll() {
    const next: Record<string, boolean> = {};
    columns.forEach((col) => (next[col] = true));
    onColumnVisibilityChange(next);
  }

  return (
    <div className="flex items-center h-14 px-4 gap-3 border-b border-node-border/80 dark:border-node-border/40 bg-node-bg/95 dark:bg-node-bg/98 shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-coral/10 dark:bg-coral/15 text-coral shrink-0 border border-coral/20">
          <Database size={16} aria-hidden />
        </div>
        <div className="flex flex-col min-w-0 justify-center">
          <span className="text-lg font-bold text-text-primary truncate leading-none antialiased">
            {projectName}
          </span>
          <span className="text-xs font-mono text-text-tertiary leading-none mt-0.5">
            <span className="inline-flex items-center rounded-md bg-badge-teal-bg/15 dark:bg-badge-teal-bg/20 px-2 py-0.5 text-[9px] font-bold tracking-wider text-badge-teal-text dark:text-teal uppercase border border-black/2 dark:border-white/2 font-mono leading-none">
              {provider}
            </span>
          </span>
        </div>
      </div>

      <div className="w-px h-6 bg-node-border/60 dark:bg-node-border/30 shrink-0" />

      <div className="flex items-center h-9 rounded-lg border border-node-border/60 dark:border-node-border/40 bg-black/2 dark:bg-white/2 overflow-hidden">
        <div className="flex items-center gap-2 px-3 h-full">
          <Search
            size={12}
            className="text-text-tertiary shrink-0"
            aria-hidden
          />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter rows…"
            disabled={!tableSelected}
            className="w-48 bg-transparent border-none outline-none text-[11.5px] font-mono text-text-primary placeholder:text-text-tertiary disabled:opacity-50"
          />
        </div>

        <div className="w-px h-5 bg-node-border/60 dark:bg-node-border/30 shrink-0" />

        <button
          onClick={onRefresh}
          disabled={!tableSelected || isRefreshing}
          className="flex items-center justify-center w-9 h-full text-text-tertiary hover:text-teal hover:bg-teal/5 transition-colors border-none bg-transparent cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Refresh table data">
          <RotateCw
            size={12}
            className={isRefreshing ? "animate-spin" : ""}
            aria-hidden
          />
        </button>
      </div>

      {tableSelected && (
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setColumnsOpen((o) => !o)}
            className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border text-[11.5px] font-medium transition-colors cursor-pointer bg-transparent ${
              columnsOpen
                ? "border-teal/40 text-teal bg-teal/5"
                : "border-node-border/60 dark:border-node-border/40 text-text-secondary hover:text-text-primary hover:bg-black/2 dark:hover:bg-white/2"
            }`}>
            <Columns3 size={13} aria-hidden />
            <span>Columns</span>
            {hiddenCount > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-teal text-[9px] font-bold text-white leading-none">
                {hiddenCount}
              </span>
            )}
          </button>

          {columnsOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-52 rounded-xl border border-node-border/60 dark:border-node-border/40 bg-node-bg/98 dark:bg-node-bg/99 backdrop-blur-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-node-border/40">
                <span className="text-[11px] font-semibold text-text-secondary">
                  Toggle columns
                </span>
                {hiddenCount > 0 && (
                  <button
                    onClick={showAll}
                    className="text-[10px] font-medium text-teal hover:text-teal-hover transition-colors border-none bg-transparent cursor-pointer">
                    Show all
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {columns.map((col) => {
                  const visible = columnVisibility[col] !== false;
                  return (
                    <button
                      key={col}
                      onClick={() => toggleColumn(col)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left border-none bg-transparent cursor-pointer hover:bg-black/2 dark:hover:bg-white/2 transition-colors">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
                          visible
                            ? "bg-teal border-teal"
                            : "border-node-border/60 dark:border-node-border/40"
                        }`}>
                        {visible && (
                          <Check size={10} className="text-white" aria-hidden />
                        )}
                      </div>
                      <span
                        className={`text-[11.5px] font-mono truncate ${
                          visible ? "text-text-primary" : "text-text-tertiary"
                        }`}>
                        {col}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tableSelected && (
        <button
          onClick={onExportCsv}
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-node-border/60 dark:border-node-border/40 text-[11.5px] font-medium text-text-secondary hover:text-text-primary hover:bg-black/2 dark:hover:bg-white/2 transition-colors cursor-pointer bg-transparent">
          <Download size={13} aria-hidden />
          <span>Export CSV</span>
        </button>
      )}

      <div className="flex-1" />

      {hasPendingEdits && (
        <div className="flex items-center gap-2 pr-1 animate-in fade-in slide-in-from-top-1 duration-150">
          <span className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-coral/10 dark:bg-coral/15 border border-coral/20 text-[11px] font-mono font-semibold text-coral">
            <span className="w-1.5 h-1.5 rounded-full bg-coral shrink-0" />
            {pendingEditsCount} unsaved{" "}
            {pendingEditsCount === 1 ? "change" : "changes"}
          </span>

          <button
            onClick={onDiscardChanges}
            disabled={isSaving}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-node-border/60 dark:border-node-border/40 text-[11.5px] font-medium text-text-secondary hover:text-text-primary hover:bg-black/2 dark:hover:bg-white/2 transition-colors cursor-pointer bg-transparent disabled:opacity-40 disabled:cursor-not-allowed">
            <X size={13} aria-hidden />
            <span>Discard</span>
          </button>

          <button
            onClick={onSaveChanges}
            disabled={isSaving}
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-coral text-white text-[11.5px] font-semibold hover:bg-coral/90 transition-colors cursor-pointer border-none disabled:opacity-60 disabled:cursor-not-allowed">
            {isSaving ? (
              <Loader2 size={13} className="animate-spin" aria-hidden />
            ) : (
              <Save size={13} aria-hidden />
            )}
            <span>{isSaving ? "Saving…" : "Save changes"}</span>
          </button>
        </div>
      )}

      <ThemeToggle className="w-9 h-9 rounded-lg hover:bg-black/2 dark:hover:bg-white/2" />

      <div className="w-px h-6 bg-node-border/60 dark:bg-node-border/30 shrink-0" />

      <ModeSwitcher />

      <div className="w-px h-6 bg-node-border/60 dark:bg-node-border/30 shrink-0" />

      <DisconnectButton className="h-9 px-3.5 rounded-lg hover:bg-coral/10 dark:hover:bg-coral/15" />
    </div>
  );
}
