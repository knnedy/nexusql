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
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0 rounded-xl bg-surface-1 border-[0.5px] border-border shadow-[0_2px_8px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
      {/* Project identity */}
      <div className="flex items-center gap-2.5 px-4 py-2.5">
        <div className="flex items-center justify-center w-5 h-5 rounded-md bg-coral shrink-0">
          <Database size={11} color="#fff" aria-hidden />
        </div>
        <span className="text-sm font-semibold text-text-primary tracking-[-0.01em]">
          {MOCK_PROJECT_NAME}
        </span>
        <span className="text-xs text-text-tertiary">
          {MOCK_SCHEMA.tables.length} tables
        </span>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-border shrink-0" />

      {/* Provider badge */}
      <div className="px-3 py-2.5">
        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold bg-badge-teal-bg text-badge-teal-text dark:bg-badge-teal-bg dark:text-teal">
          {MOCK_PROVIDER}
        </span>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-border shrink-0" />

      {/* Disconnect */}
      <button
        onClick={handleDisconnect}
        className="flex items-center gap-1.5 px-3 py-2.5 text-xs text-text-secondary hover:text-red-500 hover:bg-red-500/5 transition-colors rounded-r-xl cursor-pointer border-none bg-transparent"
        aria-label="Disconnect">
        <Unplug size={13} aria-hidden />
        Disconnect
      </button>
    </div>
  );
}
