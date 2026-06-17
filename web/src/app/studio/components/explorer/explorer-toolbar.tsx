"use client";

import { Database, Search, RotateCw, Table2 } from "lucide-react";
import { useStudioStore } from "@/lib/store/studio-store";
import ModeSwitcher from "../mode-switcher";
import DisconnectButton from "../disconnect-button";

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
  const provider = useStudioStore((s) => s.provider);
  const projectName = useStudioStore((s) => s.projectName);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-stretch h-12 overflow-hidden rounded-2xl bg-node-bg/85 dark:bg-node-bg/90 backdrop-blur-md border border-node-border/80 dark:border-node-border/40 shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_12px_42px_rgba(0,0,0,0.5)] transition-all duration-200">
      <div className="flex items-center gap-3 pl-4 pr-3 self-center">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-coral/10 dark:bg-coral/15 text-coral shrink-0 border border-coral/20">
          <Database size={14} aria-hidden />
        </div>
        <div className="flex flex-col min-w-0 justify-center">
          <span className="text-[13px] font-bold text-text-primary tracking-tight leading-none mb-0.5 antialiased">
            {projectName}
          </span>
          <span className="text-[10px] font-medium font-mono text-text-tertiary leading-none mt-0.5">
            {provider}
          </span>
        </div>
      </div>

      <div className="w-px h-5 bg-node-border/60 dark:bg-node-border/30 shrink-0 self-center" />

      <div className="flex items-center gap-2 px-3 self-center min-w-0">
        <Table2 size={13} className="text-teal shrink-0" aria-hidden />
        <div className="flex flex-col min-w-0 justify-center">
          <span className="text-[12px] font-mono font-semibold text-text-primary tracking-tight truncate leading-none antialiased">
            {tableName ?? "No table selected"}
          </span>
          <span className="text-[9px] font-mono text-text-tertiary leading-none mt-0.5">
            {tableName ? `showing ${rowCount} rows` : "—"}
          </span>
        </div>
      </div>

      <div className="w-px h-5 bg-node-border/60 dark:bg-node-border/30 shrink-0 self-center" />

      <div className="flex items-center gap-2 px-3 self-center">
        <Search size={12} className="text-text-tertiary shrink-0" aria-hidden />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter rows…"
          disabled={!tableName}
          className="w-32 bg-transparent border-none outline-none text-[11px] font-mono text-text-primary placeholder:text-text-tertiary disabled:opacity-50"
        />
      </div>

      <div className="w-px h-5 bg-node-border/60 dark:bg-node-border/30 shrink-0 self-center" />

      <button
        onClick={onRefresh}
        disabled={!tableName || isRefreshing}
        className="flex items-center justify-center px-3.5 self-stretch text-text-tertiary hover:text-teal transition-colors border-none bg-transparent cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Refresh table data">
        <RotateCw
          size={13}
          className={isRefreshing ? "animate-spin" : ""}
          aria-hidden
        />
      </button>

      <div className="w-px h-5 bg-node-border/60 dark:bg-node-border/30 shrink-0 self-center" />

      <div className="px-3 self-center flex items-center">
        <ModeSwitcher />
      </div>

      <div className="w-px h-5 bg-node-border/60 dark:bg-node-border/30 shrink-0 self-center" />

      <DisconnectButton className="h-full pl-4 pr-5 hover:bg-coral/10 dark:hover:bg-coral/15" />
    </div>
  );
}
