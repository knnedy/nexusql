"use client";

import { Database, Search, RotateCw } from "lucide-react";
import { useStudioStore } from "@/lib/store/studio-store";
import ModeSwitcher from "../mode-switcher";
import DisconnectButton from "../disconnect-button";
import ThemeToggle from "./theme-toggle";

interface ExplorerToolbarProps {
  tableSelected: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export default function ExplorerToolbar({
  tableSelected,
  searchValue,
  onSearchChange,
  onRefresh,
  isRefreshing,
}: ExplorerToolbarProps) {
  const provider = useStudioStore((s) => s.provider);
  const projectName = useStudioStore((s) => s.projectName);

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

      <div className="flex-1" />

      <ThemeToggle className="w-9 h-9 rounded-lg hover:bg-black/2 dark:hover:bg-white/2" />

      <div className="w-px h-6 bg-node-border/60 dark:bg-node-border/30 shrink-0" />

      <ModeSwitcher />

      <div className="w-px h-6 bg-node-border/60 dark:bg-node-border/30 shrink-0" />

      <DisconnectButton className="h-9 px-3.5 rounded-lg hover:bg-coral/10 dark:hover:bg-coral/15" />
    </div>
  );
}
