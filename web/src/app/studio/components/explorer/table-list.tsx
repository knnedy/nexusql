"use client";

import { Table2 } from "lucide-react";
import type { Table } from "@/lib/types";

interface TableListProps {
  tables: Table[];
  selectedTable: string | null;
  onSelectTable: (name: string) => void;
}

export default function TableList({
  tables,
  selectedTable,
  onSelectTable,
}: TableListProps) {
  return (
    <div className="w-64 h-full flex flex-col border-r border-node-border/80 dark:border-node-border/40 bg-node-bg/95 dark:bg-node-bg/98 backdrop-blur-md">
      <div className="px-4 py-4 border-b border-node-border/60 dark:border-node-border/30 shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-tertiary antialiased">
          Tables
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
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
