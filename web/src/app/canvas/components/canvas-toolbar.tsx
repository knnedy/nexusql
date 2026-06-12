"use client";

import { Database, Unplug, Loader2 } from "lucide-react";
import { useSchema } from "@/hooks/use-schema";
import { useDisconnect } from "@/hooks/use-disconnect";

export default function CanvasToolbar() {
  const { data: schema } = useSchema();
  const disconnect = useDisconnect();

  const provider = sessionStorage.getItem("nexusql_provider") ?? "postgres";
  const projectName =
    sessionStorage.getItem("nexusql_project_name") ?? "Local Dev";
  const tableCount = schema?.tables.length ?? 0;

  function handleDisconnect() {
    disconnect.mutate();
  }

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center rounded-xl bg-node-bg/85 dark:bg-node-bg/90 backdrop-blur-md border border-node-border/80 dark:border-node-border/40 shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_12px_42px_rgba(0,0,0,0.5)] transition-all duration-200">
      <div className="flex items-center gap-3 pl-4 pr-3 py-2.5">
        <div className="flex items-center justify-center w-5 h-5 rounded-md bg-coral/10 dark:bg-coral/15 text-coral shrink-0 border border-coral/20">
          <Database size={11} aria-hidden />
        </div>
        <div className="flex flex-col min-w-0 justify-center">
          <span className="text-[12px] font-bold text-text-primary tracking-tight leading-none mb-0.5 antialiased">
            {projectName}
          </span>
          <span className="text-[10px] font-medium font-mono text-text-tertiary leading-none">
            {tableCount} tables
          </span>
        </div>
      </div>

      <div className="w-px h-4 bg-node-border/60 dark:bg-node-border/30 shrink-0" />

      <div className="px-3 py-2.5 flex items-center">
        <span className="inline-flex items-center rounded-md bg-badge-teal-bg/15 dark:bg-badge-teal-bg/20 px-2 py-0.5 text-[9px] font-bold tracking-wider text-badge-teal-text dark:text-teal uppercase border border-black/2 dark:border-white/2 font-mono">
          {provider}
        </span>
      </div>

      <div className="w-px h-4 bg-node-border/60 dark:bg-node-border/30 shrink-0" />

      <button
        onClick={handleDisconnect}
        disabled={disconnect.isPending}
        className="flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-medium text-text-secondary dark:text-text-secondary/90 hover:text-coral hover:bg-coral/5 dark:hover:bg-coral/10 transition-all duration-150 rounded-r-xl cursor-pointer border-none bg-transparent group disabled:opacity-60"
        aria-label="Disconnect">
        {disconnect.isPending ? (
          <Loader2 size={12} className="animate-spin text-text-tertiary" />
        ) : (
          <Unplug
            size={12}
            className="text-text-tertiary group-hover:text-coral transition-colors"
            aria-hidden
          />
        )}
        <span className="tracking-tight antialiased">Disconnect</span>
      </button>
    </div>
  );
}
