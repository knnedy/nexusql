"use client";

import { useState } from "react";
import { Table2, Search } from "lucide-react";

interface TableListProps {
  tables: { name: string; fields: { name: string }[] }[];
  selectedTable: string | null;
  onSelectTable: (name: string) => void;
  rowCount: number;
}

export default function TableList({
  tables,
  selectedTable,
  onSelectTable,
  rowCount,
}: TableListProps) {
  const [search, setSearch] = useState("");

  const filteredTables = search.trim()
    ? tables.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : tables;

  return (
    <div className="w-64 h-full flex flex-col border-r border-node-border/80 dark:border-node-border/40 bg-node-bg/95 dark:bg-node-bg/98 shrink-0">
      <div className="px-4 py-3.5 border-b border-node-border/60 dark:border-node-border/30 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-teal/10 dark:bg-teal/15 text-teal shrink-0 border border-teal/20">
            <Table2 size={14} aria-hidden />
          </div>
          <div className="flex flex-col min-w-0 justify-center">
            <span className="text-[12.5px] font-mono font-bold text-text-primary tracking-tight truncate leading-none antialiased">
              {selectedTable ?? "No table selected"}
            </span>
          </div>
        </div>
        <span className="text-[9.5px] font-mono text-text-tertiary leading-none mt-2 block">
          {selectedTable ? `${rowCount.toLocaleString()} rows` : "—"}
        </span>
      </div>

      <div className="px-3 py-2.5 border-b border-node-border/60 dark:border-node-border/30 shrink-0">
        <div className="flex items-center gap-2 h-7 px-2.5 rounded-md border border-node-border/60 dark:border-node-border/40 bg-black/2 dark:bg-white/2">
          <Search
            size={11}
            className="text-text-tertiary shrink-0"
            aria-hidden
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tables…"
            className="flex-1 bg-transparent border-none outline-none text-[11px] font-mono text-text-primary placeholder:text-text-tertiary"
          />
        </div>
      </div>

      <div className="px-4 pt-3 pb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-tertiary antialiased">
          Tables
        </span>
        <span className="text-[10px] font-mono text-text-tertiary tabular-nums">
          {filteredTables.length}/{tables.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pb-2">
        {filteredTables.length === 0 ? (
          <div className="px-4 py-6 flex items-center justify-center">
            <span className="text-[11px] text-text-tertiary font-mono">
              No tables match &apos;{search}&apos;
            </span>
          </div>
        ) : (
          filteredTables.map((table) => {
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
          })
        )}
      </div>
    </div>
  );
}
