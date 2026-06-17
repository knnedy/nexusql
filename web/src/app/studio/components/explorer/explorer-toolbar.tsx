"use client";

import { Search, RotateCw, Table2 } from "lucide-react";
import ModeSwitcher from "../mode-switcher";
import DisconnectButton from "../disconnect-button";
import ThemeToggle from "./theme-toggle";

interface ExplorerToolbarProps {
  tableName: string | null;
  rowCount: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export default function ExplorerToolbar({
  tableName,
  rowCount,
  searchValue,
  onSearchChange,
  onRefresh,
  isRefreshing,
}: ExplorerToolbarProps) {
  return (
    <div className="flex items-center h-14 px-4 gap-3 border-b border-node-border/80 dark:border-node-border/40 bg-node-bg/95 dark:bg-node-bg/98 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <Table2 size={14} className="text-teal shrink-0" aria-hidden />
        <div className="flex flex-col min-w-0 justify-center">
          <span className="text-[13px] font-mono font-bold text-text-primary tracking-tight truncate leading-none antialiased">
            {tableName ?? "No table selected"}
          </span>
          <span className="text-[9.5px] font-mono text-text-tertiary leading-none mt-0.5">
            {tableName ? `showing ${rowCount} rows` : "—"}
          </span>
        </div>
      </div>

      <div className="flex-1" />

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
            disabled={!tableName}
            className="w-40 bg-transparent border-none outline-none text-[11.5px] font-mono text-text-primary placeholder:text-text-tertiary disabled:opacity-50"
          />
        </div>

        <div className="w-px h-5 bg-node-border/60 dark:bg-node-border/30 shrink-0" />

        <button
          onClick={onRefresh}
          disabled={!tableName || isRefreshing}
          className="flex items-center justify-center w-9 h-full text-text-tertiary hover:text-teal hover:bg-teal/5 transition-colors border-none bg-transparent cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Refresh table data">
          <RotateCw
            size={12}
            className={isRefreshing ? "animate-spin" : ""}
            aria-hidden
          />
        </button>
      </div>

      <div className="w-px h-6 bg-node-border/60 dark:bg-node-border/30 shrink-0" />

      <ThemeToggle className="w-9 h-9 rounded-lg hover:bg-black/2 dark:hover:bg-white/2" />

      <div className="w-px h-6 bg-node-border/60 dark:bg-node-border/30 shrink-0" />

      <ModeSwitcher />

      <div className="w-px h-6 bg-node-border/60 dark:bg-node-border/30 shrink-0" />

      <DisconnectButton className="h-9 px-3.5 rounded-lg hover:bg-coral/10 dark:hover:bg-coral/15" />
    </div>
  );
}
