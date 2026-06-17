"use client";

import { Database, Table2 } from "lucide-react";
import { useStudioStore } from "@/lib/store/studio-store";

interface TableListProps {
  tables: { name: string; fields: { name: string }[] }[];
  selectedTable: string | null;
  onSelectTable: (name: string) => void;
}

export default function TableList({
  tables,
  selectedTable,
  onSelectTable,
}: TableListProps) {
  const provider = useStudioStore((s) => s.provider);
  const projectName = useStudioStore((s) => s.projectName);

  return (
    <div className="w-64 h-full flex flex-col border-r border-node-border/80 dark:border-node-border/40 bg-node-bg/95 dark:bg-node-bg/98 shrink-0">
      <div className="px-4 py-3.5 border-b border-node-border/60 dark:border-node-border/30 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-coral/10 dark:bg-coral/15 text-coral shrink-0 border border-coral/20">
            <Database size={14} aria-hidden />
          </div>
          <div className="flex flex-col min-w-0 justify-center">
            <span className="text-[12.5px] font-bold text-text-primary tracking-tight truncate leading-none antialiased">
              {projectName}
            </span>
          </div>
        </div>
        <span className="inline-flex items-center rounded-md bg-badge-teal-bg/15 dark:bg-badge-teal-bg/20 px-2 py-0.5 text-[9px] font-bold tracking-wider text-badge-teal-text dark:text-teal uppercase border border-black/2 dark:border-white/2 font-mono leading-none mt-2">
          {provider}
        </span>
      </div>

      <div className="px-4 pt-3.5 pb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-tertiary antialiased">
          Tables
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pb-2">
        {tables.map((table) => {
          const isActive = table.name === selectedTable;
          return (
            <button
              key={table.name}
              onClick={() => onSelectTable(table.name)}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left border-none cursor-pointer transition-colors ${
                isActive
                  ? "bg-coral/10 dark:bg-coral/15"
                  : "bg-transparent hover:bg-black/2 dark:hover:bg-white/2"
              }`}>
              <Table2
                size={13}
                className={isActive ? "text-coral" : "text-text-tertiary"}
                aria-hidden
              />
              <div className="flex flex-col min-w-0">
                <span
                  className={`text-[12px] font-mono truncate tracking-tight ${
                    isActive
                      ? "text-text-primary font-semibold"
                      : "text-text-secondary/90"
                  }`}>
                  {table.name}
                </span>
                <span className="text-[10px] text-text-tertiary">
                  {table.fields.length} fields
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
