"use client";

import { Database } from "lucide-react";
import { useSchema } from "@/hooks/use-schema";
import { useStudioStore } from "@/lib/store/studio-store";
import ModeSwitcher from "../components/mode-switcher";
import DisconnectButton from "../components/disconnect-button";

export default function CanvasToolbar() {
  const { data: schema } = useSchema();
  const provider = useStudioStore((s) => s.provider);
  const projectName = useStudioStore((s) => s.projectName);

  const tableCount = schema?.tables.length ?? 0;

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
            {tableCount} tables
          </span>
        </div>
      </div>

      <div className="w-px h-5 bg-node-border/60 dark:bg-node-border/30 shrink-0 self-center" />

      <div className="px-3 self-center flex items-center">
        <span className="inline-flex items-center rounded-md bg-badge-teal-bg/15 dark:bg-badge-teal-bg/20 px-2 py-1 text-[9px] font-bold tracking-wider text-badge-teal-text dark:text-teal uppercase border border-black/2 dark:border-white/2 font-mono leading-none">
          {provider}
        </span>
      </div>

      <div className="w-px h-5 bg-node-border/60 dark:bg-node-border/30 shrink-0 self-center" />

      <div className="px-3 self-center flex items-center">
        <ModeSwitcher />
      </div>

      <div className="w-px h-5 bg-node-border/60 dark:bg-node-border/30 shrink-0 self-center" />

      <DisconnectButton className="h-full pl-4 pr-5 hover:bg-coral/10 dark:hover:bg-coral/15" />
    </div>
  );
}
