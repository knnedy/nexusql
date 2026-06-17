"use client";

import { LayoutGrid, Table2 } from "lucide-react";
import { useStudioStore } from "@/lib/store/studio-store";

interface ModeSwitcherProps {
  className?: string;
}

export default function ModeSwitcher({ className = "" }: ModeSwitcherProps) {
  const viewMode = useStudioStore((s) => s.viewMode);
  const setViewMode = useStudioStore((s) => s.setViewMode);

  return (
    <div
      className={`flex items-center gap-0.5 p-0.5 rounded-lg bg-node-header-bg/60 dark:bg-node-header-bg/40 border border-node-border/60 dark:border-node-border/30 ${className}`}>
      <button
        onClick={() => setViewMode("canvas")}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-150 border-none cursor-pointer ${
          viewMode === "canvas"
            ? "bg-node-bg text-text-primary shadow-sm"
            : "bg-transparent text-text-tertiary hover:text-text-secondary"
        }`}>
        <LayoutGrid size={11} aria-hidden />
        <span>Canvas</span>
      </button>
      <button
        onClick={() => setViewMode("explorer")}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-150 border-none cursor-pointer ${
          viewMode === "explorer"
            ? "bg-node-bg text-text-primary shadow-sm"
            : "bg-transparent text-text-tertiary hover:text-text-secondary"
        }`}>
        <Table2 size={11} aria-hidden />
        <span>Explorer</span>
      </button>
    </div>
  );
}
