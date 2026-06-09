"use client";

import { Database, Unplug } from "lucide-react";
import { useRouter } from "next/navigation";
import { MOCK_SCHEMA, MOCK_PROVIDER } from "@/lib/mock-schema";

// Mock project name — replaced by active project in Phase 2
const MOCK_PROJECT_NAME = "Local Dev";

export default function CanvasToolbar() {
  const router = useRouter();

  function handleDisconnect() {
    // Phase 2 — replace with: disconnect.mutate()
    router.push("/");
  }

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center rounded-xl bg-node-bg/85 dark:bg-node-bg/90 backdrop-blur-md border border-node-border/80 dark:border-node-border/40 shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_12px_42px_rgba(0,0,0,0.5)] transition-all duration-200">
      {/* Project Identity Widget */}
      <div className="flex items-center gap-3 pl-4 pr-3 py-2.5">
        <div className="flex items-center justify-center w-5 h-5 rounded-md bg-coral/10 dark:bg-coral/15 text-coral shrink-0 border border-coral/20">
          <Database size={11} aria-hidden />
        </div>
        <div className="flex flex-col min-w-0 justify-center">
          <span className="text-[12px] font-bold text-text-primary tracking-tight leading-none mb-0.5 antialiased">
            {MOCK_PROJECT_NAME}
          </span>
          <span className="text-[10px] font-medium font-mono text-text-tertiary leading-none">
            {MOCK_SCHEMA.tables.length} tables
          </span>
        </div>
      </div>

      {/* Structured Minimal Divider */}
      <div className="w-px h-4 bg-node-border/60 dark:bg-node-border/30 shrink-0" />

      {/* Provider Tagging Block */}
      <div className="px-3 py-2.5 flex items-center">
        <span className="inline-flex items-center rounded-md bg-badge-teal-bg/15 dark:bg-badge-teal-bg/20 px-2 py-0.5 text-[9px] font-bold tracking-wider text-badge-teal-text dark:text-teal uppercase border border-black/[0.02] dark:border-white/[0.02] font-mono">
          {MOCK_PROVIDER}
        </span>
      </div>

      {/* Structured Minimal Divider */}
      <div className="w-px h-4 bg-node-border/60 dark:bg-node-border/30 shrink-0" />

      {/* Integrated Action Button */}
      <button
        onClick={handleDisconnect}
        className="flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-medium text-text-secondary dark:text-text-secondary/90 hover:text-coral hover:bg-coral/5 dark:hover:bg-coral/10 transition-all duration-150 rounded-r-xl cursor-pointer border-none bg-transparent group"
        aria-label="Disconnect">
        <Unplug
          size={12}
          className="text-text-tertiary group-hover:text-coral transition-colors"
          aria-hidden
        />
        <span className="tracking-tight antialiased">Disconnect</span>
      </button>
    </div>
  );
}
