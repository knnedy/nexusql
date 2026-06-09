"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { LayoutGrid, ImageDown, Sun, Moon, X, Database } from "lucide-react";
import { SiPrisma, SiDrizzle } from "react-icons/si";
import { MOCK_SCHEMA, MOCK_PROVIDER } from "@/lib/mock-schema";
import { reapplyLayout } from "@/lib/canvas-utils";
import type { Node } from "@xyflow/react";
import type { TableNodeData } from "@/lib/types";

interface CanvasSidebarProps {
  open: boolean;
  onClose: () => void;
  onLayoutApply: (nodes: Node<TableNodeData>[]) => void;
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-[0.75rem] font-bold uppercase tracking-[0.08em] text-text-tertiary px-2.5 mb-1.5 antialiased">
      {label}
    </p>
  );
}

function SidebarItem({
  iconWrapperClass,
  icon,
  label,
  description,
  onClick,
}: {
  iconWrapperClass: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-all duration-150 cursor-pointer border-none bg-transparent hover:bg-node-border/30 dark:hover:bg-node-border/20 active:scale-[0.98] group">
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-black/3 dark:border-white/3 transition-colors ${iconWrapperClass}`}>
        {icon}
      </div>
      <div className="flex flex-col min-w-0 justify-center">
        <span className="text-base font-semibold text-text-primary group-hover:text-text-primary transition-colors - antialiased">
          {label}
        </span>
        <span className="text-[0.80rem] text-text-tertiary font-normal truncate mt-0.5">
          {description}
        </span>
      </div>
    </button>
  );
}

function Divider() {
  return (
    <div className="h-px bg-node-border/40 dark:bg-node-border/20 mx-2.5 my-1" />
  );
}

export default function CanvasSidebar({
  open,
  onClose,
  onLayoutApply,
}: CanvasSidebarProps) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const handleAutoLayout = useCallback(async () => {
    const { nodes } = await reapplyLayout(MOCK_SCHEMA, MOCK_PROVIDER);
    onLayoutApply(nodes);
  }, [onLayoutApply]);

  function handleExportPng() {
    // Phase 2 — implement canvas-to-image export
  }

  function handleExportPrisma() {
    // Phase 2 — call api.export.prisma()
  }

  function handleExportDrizzle() {
    // Phase 2 — call api.export.drizzle()
  }

  return (
    <>
      {/* Translucent Backdrop Mask */}
      {open && (
        <div
          className="absolute inset-0 z-20 bg-black/5 dark:bg-black/20 backdrop-blur-[1px] animate-in fade-in duration-200"
          onClick={onClose}
        />
      )}

      {/* Main Panel Shell */}
      <div
        className={[
          "absolute top-0 left-0 h-full z-30 flex flex-col border-r border-node-border/80 dark:border-node-border/40 transition-all duration-200 ease-out overflow-hidden shadow-2xl dark:shadow-[4px_0_24px_rgba(0,0,0,0.3)]",
          "bg-node-bg/95 dark:bg-node-bg/98 backdrop-blur-md",
          open ? "w-72 opacity-100" : "w-0 opacity-0 pointer-events-none",
        ].join(" ")}>
        {/* Dynamic Headed Identity Workspace Container */}
        <div className="flex items-center justify-between px-4 py-4 bg-node-header-bg/40 border-b border-node-border/60 dark:border-node-border/30 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-coral/10 text-coral flex items-center justify-center shrink-0 border border-coral/20">
              <Database size={14} aria-hidden />
            </div>
            <div className="flex flex-col min-w-0 justify-center">
              <span className="text-[12px] font-bold text-text-primary tracking-tight truncate antialiased">
                {MOCK_SCHEMA.tables[0]?.schema === "public"
                  ? "Local Dev"
                  : MOCK_SCHEMA.tables[0]?.schema}
              </span>
              <span className="text-[9px] font-medium font-mono text-text-tertiary mt-0.5 uppercase tracking-wider">
                {MOCK_PROVIDER} · {MOCK_SCHEMA.tables.length} tables
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-6 h-6 rounded-md text-text-tertiary hover:text-text-primary hover:bg-node-border/40 transition-colors cursor-pointer border-none bg-transparent shrink-0"
            aria-label="Close sidebar">
            <X size={12} aria-hidden />
          </button>
        </div>

        {/* Sidebar Interior Scroller Layout */}
        <div className="flex flex-col gap-3.5 p-2 flex-1 overflow-y-auto pt-4">
          {/* Layout */}
          <div className="flex flex-col gap-0.5">
            <SectionLabel label="Layout" />
            <SidebarItem
              iconWrapperClass="bg-teal/10 text-teal dark:bg-teal/15 dark:text-teal"
              icon={<LayoutGrid size={14} aria-hidden />}
              label="Auto-layout"
              description="Rearrange structural blocks"
              onClick={handleAutoLayout}
            />
          </div>

          <Divider />

          {/* Exports */}
          <div className="flex flex-col gap-0.5">
            <SectionLabel label="Data Exports" />
            <SidebarItem
              iconWrapperClass="bg-badge-blue-bg/60 text-badge-blue-text dark:bg-badge-blue-bg/20 dark:text-blue-400"
              icon={<ImageDown size={14} aria-hidden />}
              label="Export Canvas View"
              description="Save viewport to PNG format"
              onClick={handleExportPng}
            />
            <SidebarItem
              iconWrapperClass="bg-indigo-500/5 text-indigo-500 dark:bg-indigo-400/10 dark:text-indigo-400"
              icon={<SiPrisma size={14} aria-hidden />}
              label="Prisma Schema"
              description="Generate schema.prisma model"
              onClick={handleExportPrisma}
            />
            <SidebarItem
              iconWrapperClass="bg-lime-500/10 text-lime-600 dark:bg-lime-400/10 dark:text-lime-400"
              icon={<SiDrizzle size={14} aria-hidden />}
              label="Drizzle Schema"
              description="Compile executable TypeScript"
              onClick={handleExportDrizzle}
            />
          </div>

          <Divider />

          {/* Theme */}
          <div className="flex flex-col gap-0.5">
            <SectionLabel label="Theme" />
            <SidebarItem
              iconWrapperClass="bg-surface-3 text-text-secondary dark:bg-surface-3/50"
              icon={
                isDark ? (
                  <Sun size={14} aria-hidden />
                ) : (
                  <Moon size={14} aria-hidden />
                )
              }
              label={isDark ? "Light Presentation" : "Dark Presentation"}
              description="Invert appearance theme"
              onClick={() => setTheme(isDark ? "light" : "dark")}
            />
          </div>
        </div>
      </div>
    </>
  );
}
