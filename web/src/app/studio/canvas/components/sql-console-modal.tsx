"use client";

import { useState } from "react";
import { X, Play, AlertTriangle, Loader2 } from "lucide-react";
import { useRunQuery } from "@/hooks/use-run-query";

interface SqlConsoleModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SqlConsoleModal({
  open,
  onClose,
}: SqlConsoleModalProps) {
  const [sql, setSql] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const runQuery = useRunQuery();

  if (!open) return null;

  function handleRun() {
    if (!sql.trim()) return;
    runQuery.mutate(
      { sql, confirmed: pendingConfirm },
      {
        onSuccess: (data) => {
          if (data.requiresConfirmation) {
            setPendingConfirm(true);
          } else {
            setPendingConfirm(false);
          }
        },
      },
    );
  }

  function handleClose() {
    setSql("");
    setPendingConfirm(false);
    runQuery.reset();
    onClose();
  }

  const result = runQuery.data;
  const showConfirmBanner = result?.requiresConfirmation && pendingConfirm;
  const showResults = result && !result.requiresConfirmation;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150">
      <div className="w-full max-w-3xl max-h-[80vh] flex flex-col rounded-xl border border-node-border/60 dark:border-node-border/40 bg-node-bg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-node-border/60 dark:border-node-border/40 shrink-0">
          <span className="text-[13px] font-bold text-text-primary">
            SQL Console
          </span>
          <button
            onClick={handleClose}
            className="flex items-center justify-center w-6 h-6 rounded-md text-text-tertiary hover:text-text-primary hover:bg-node-border/40 transition-colors cursor-pointer border-none bg-transparent"
            aria-label="Close SQL console">
            <X size={13} aria-hidden />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4 overflow-y-auto">
          <textarea
            value={sql}
            onChange={(e) => {
              setSql(e.target.value);
              if (pendingConfirm) {
                setPendingConfirm(false);
                runQuery.reset();
              }
            }}
            placeholder="SELECT * FROM users LIMIT 10;"
            rows={6}
            className="w-full rounded-lg border border-node-border/60 dark:border-node-border/40 bg-surface-2 dark:bg-surface-3/40 text-[12px] font-mono text-text-primary p-3 outline-none focus:border-teal/60 resize-y"
          />

          {showConfirmBanner && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-coral/10 dark:bg-coral/15 border border-coral/20">
              <AlertTriangle
                size={14}
                className="text-coral shrink-0"
                aria-hidden
              />
              <span className="text-[11.5px] text-coral flex-1">
                This statement will modify data or schema. Run anyway?
              </span>
            </div>
          )}

          {runQuery.isError && (
            <div className="px-3 py-2.5 rounded-lg bg-coral/10 dark:bg-coral/15 border border-coral/20">
              <span className="text-[11.5px] font-mono text-coral">
                {runQuery.error instanceof Error
                  ? runQuery.error.message
                  : "Query failed"}
              </span>
            </div>
          )}

          {showResults && !result.isWrite && (
            <QueryResultsTable columns={result.columns} rows={result.rows} />
          )}

          {showResults && result.isWrite && (
            <div className="px-3 py-2.5 rounded-lg bg-teal/10 dark:bg-teal/15 border border-teal/20">
              <span className="text-[11.5px] font-mono text-teal">
                {result.rowsAffected}{" "}
                {result.rowsAffected === 1 ? "row" : "rows"} affected
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-node-border/60 dark:border-node-border/40 shrink-0">
          <button
            onClick={handleClose}
            className="flex items-center h-8 px-3 rounded-lg border border-node-border/60 dark:border-node-border/40 text-[11.5px] font-medium text-text-secondary hover:text-text-primary hover:bg-black/2 dark:hover:bg-white/2 transition-colors cursor-pointer bg-transparent">
            Close
          </button>
          <button
            onClick={handleRun}
            disabled={!sql.trim() || runQuery.isPending}
            className={`flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[11.5px] font-semibold transition-colors cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed ${
              showConfirmBanner
                ? "bg-coral text-white hover:bg-coral/90"
                : "bg-teal text-white hover:bg-teal/90"
            }`}>
            {runQuery.isPending ? (
              <Loader2 size={13} className="animate-spin" aria-hidden />
            ) : (
              <Play size={13} aria-hidden />
            )}
            <span>{showConfirmBanner ? "Confirm & Run" : "Run"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function QueryResultsTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Record<string, unknown>[];
}) {
  if (rows.length === 0) {
    return (
      <div className="px-3 py-4 flex items-center justify-center rounded-lg border border-node-border/60 dark:border-node-border/40">
        <span className="text-[11.5px] text-text-tertiary">
          Query returned no rows.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-node-border/60 dark:border-node-border/40 overflow-auto max-h-64">
      <table className="text-[11px] font-mono border-collapse w-full">
        <thead className="sticky top-0 bg-node-header-bg/95 backdrop-blur-md">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="px-2.5 py-2 text-left whitespace-nowrap border-b border-node-border/60 dark:border-node-border/40 text-text-secondary font-semibold">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t-[0.5px] border-node-row-border/60">
              {columns.map((col) => (
                <td
                  key={col}
                  className="px-2.5 py-1.5 text-text-secondary/90 whitespace-nowrap">
                  {row[col] === null ? (
                    <span className="text-text-tertiary/50 italic">null</span>
                  ) : (
                    String(row[col])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
