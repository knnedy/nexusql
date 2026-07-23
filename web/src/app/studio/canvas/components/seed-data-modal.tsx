"use client";

import { useState } from "react";
import { Sprout, X, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { useSeed } from "@/hooks/use-seed";

interface SeedDataModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SeedDataModal({ open, onClose }: SeedDataModalProps) {
  const [rowsPerTable, setRowsPerTable] = useState(10);
  const [nullChance, setNullChance] = useState(0.2);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const seed = useSeed();

  if (!open) return null;

  function handleClose() {
    setPendingConfirm(false);
    seed.reset();
    onClose();
  }

  function handleRun() {
    if (!pendingConfirm) {
      setPendingConfirm(true);
      return;
    }
    seed.mutate({ rowsPerTable, nullChance });
  }

  const result = seed.data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150">
      <div className="w-full max-w-md flex flex-col rounded-xl border border-node-border/60 dark:border-node-border/40 bg-node-bg shadow-2xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-node-header-bg/40 border-b border-node-border/60 dark:border-node-border/30 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-teal/10 dark:bg-teal/15 text-teal shrink-0 border border-teal/20">
              <Sprout size={16} aria-hidden />
            </div>
            <div className="flex flex-col min-w-0 justify-center">
              <span className="text-[14px] font-bold text-text-primary tracking-tight antialiased">
                Seed Data
              </span>
              <span className="text-[11.5px] font-mono text-text-tertiary leading-none mt-0.5">
                Generate fake rows for every table
              </span>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="flex items-center justify-center w-6 h-6 rounded-md text-text-tertiary hover:text-text-primary hover:bg-node-border/40 transition-colors cursor-pointer border-none bg-transparent shrink-0">
            <X size={13} aria-hidden />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-4 py-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-wide uppercase text-text-tertiary">
              Rows per table
            </span>
            <input
              type="number"
              min={1}
              max={500}
              value={rowsPerTable}
              onChange={(e) => {
                setRowsPerTable(Number(e.target.value));
                setPendingConfirm(false);
                seed.reset();
              }}
              className="h-8 px-2.5 rounded-md border border-node-border/60 dark:border-node-border/40 bg-surface-2 dark:bg-surface-3/40 text-[12px] font-mono text-text-primary outline-none focus:border-teal/60"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-wide uppercase text-text-tertiary">
              Null chance ({Math.round(nullChance * 100)}%)
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={nullChance}
              onChange={(e) => {
                setNullChance(Number(e.target.value));
                setPendingConfirm(false);
                seed.reset();
              }}
              className="accent-teal"
            />
          </label>

          {pendingConfirm && !seed.isSuccess && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-coral/10 dark:bg-coral/15 border border-coral/20">
              <AlertTriangle
                size={14}
                className="text-coral shrink-0"
                aria-hidden
              />
              <span className="text-[11.5px] text-coral flex-1">
                This inserts real rows into every table. Continue?
              </span>
            </div>
          )}

          {seed.isError && (
            <div className="px-3 py-2.5 rounded-lg bg-coral/10 dark:bg-coral/15 border border-coral/20">
              <span className="text-[11.5px] font-mono text-coral">
                {seed.error instanceof Error
                  ? seed.error.message
                  : "Seed failed"}
              </span>
            </div>
          )}

          {result && (
            <div className="flex flex-col gap-1.5 px-3 py-2.5 rounded-lg bg-teal/10 dark:bg-teal/15 border border-teal/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-teal" aria-hidden />
                <span className="text-[11.5px] font-mono text-teal">
                  Seed complete
                </span>
              </div>
              {Object.entries(result.rowsInserted).map(([table, count]) => (
                <div
                  key={table}
                  className="flex items-center justify-between text-[10.5px] font-mono text-teal/80 pl-5">
                  <span>{table}</span>
                  <span>{count} rows</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-node-border/60 dark:border-node-border/40 shrink-0">
          <button
            onClick={handleClose}
            className="flex items-center h-8 px-3 rounded-lg border border-node-border/60 dark:border-node-border/40 text-[11.5px] font-medium text-text-secondary hover:text-text-primary hover:bg-black/2 dark:hover:bg-white/2 transition-colors cursor-pointer bg-transparent">
            Close
          </button>
          {!seed.isSuccess && (
            <button
              onClick={handleRun}
              disabled={seed.isPending}
              className={`flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[11.5px] font-semibold transition-colors cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed ${
                pendingConfirm
                  ? "bg-coral text-white hover:bg-coral/90"
                  : "bg-teal text-white hover:bg-teal/90"
              }`}>
              {seed.isPending ? (
                <Loader2 size={13} className="animate-spin" aria-hidden />
              ) : (
                <Sprout size={13} aria-hidden />
              )}
              <span>{pendingConfirm ? "Confirm & Seed" : "Seed Database"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
