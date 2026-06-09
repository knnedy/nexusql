"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Download,
  Code2,
  Sun,
  Moon,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { MOCK_SCHEMA, MOCK_PROVIDER } from "@/lib/mock-schema";
import { reapplyLayout } from "@/lib/canvas-utils";
import type { Node, Edge } from "@xyflow/react";
import type { TableNodeData, RelationEdgeData } from "@/lib/types";

interface CanvasSidebarProps {
  open: boolean;
  onClose: () => void;
  nodes: Node<TableNodeData>[];
  edges: Edge<RelationEdgeData>[];
  onLayoutApply: (nodes: Node<TableNodeData>[]) => void;
}

function SidebarButton({
  icon,
  label,
  description,
  onClick,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
  variant?: "default" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer border-none",
        variant === "danger"
          ? "bg-transparent hover:bg-red-500/8 text-text-secondary hover:text-red-500"
          : "bg-transparent hover:bg-surface-3 text-text-secondary hover:text-text-primary",
      ].join(" ")}>
      <div className="shrink-0">{icon}</div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-medium leading-none">{label}</span>
        {description && (
          <span className="text-xs text-text-tertiary leading-none mt-0.5">
            {description}
          </span>
        )}
      </div>
    </button>
  );
}

function SidebarSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-text-tertiary px-3 mb-1">
        {title}
      </p>
      {children}
    </div>
  );
}

export default function CanvasSidebar({
  open,
  onClose,
  nodes,
  edges,
  onLayoutApply,
}: CanvasSidebarProps) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  const handleAutoLayout = useCallback(async () => {
    const { nodes: laid } = await reapplyLayout(MOCK_SCHEMA, MOCK_PROVIDER);
    onLayoutApply(laid);
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
      {/* Backdrop */}
      {open && <div className="absolute inset-0 z-20" onClick={onClose} />}

      {/* Panel */}
      <div
        className={[
          "absolute top-0 left-0 h-full z-30 flex flex-col bg-surface-1 border-r-[0.5px] border-border transition-all duration-200 ease-out",
          open
            ? "w-64 opacity-100"
            : "w-0 opacity-0 pointer-events-none overflow-hidden",
        ].join(" ")}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-[0.5px] border-border shrink-0">
          <span className="text-sm font-semibold text-text-primary tracking-[-0.01em]">
            Canvas
          </span>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-6 h-6 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-3 transition-colors cursor-pointer border-none bg-transparent"
            aria-label="Close sidebar">
            <X size={13} aria-hidden />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-5 p-3 flex-1 overflow-y-auto">
          <SidebarSection title="Layout">
            <SidebarButton
              icon={<LayoutDashboard size={15} />}
              label="Auto-layout"
              description="Rearrange all tables cleanly"
              onClick={handleAutoLayout}
            />
          </SidebarSection>

          <SidebarSection title="Export">
            <SidebarButton
              icon={<Download size={15} />}
              label="Export PNG"
              description="Save canvas as an image"
              onClick={handleExportPng}
            />
            <SidebarButton
              icon={<Code2 size={15} />}
              label="Prisma schema"
              description="Generate schema.prisma"
              onClick={handleExportPrisma}
            />
            <SidebarButton
              icon={<Code2 size={15} />}
              label="Drizzle schema"
              description="Generate schema.ts"
              onClick={handleExportDrizzle}
            />
          </SidebarSection>

          <SidebarSection title="Appearance">
            <SidebarButton
              icon={
                resolvedTheme === "dark" ? (
                  <Sun size={15} />
                ) : (
                  <Moon size={15} />
                )
              }
              label={resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            />
          </SidebarSection>
        </div>
      </div>
    </>
  );
}
