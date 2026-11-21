"use client";

import { useState, useRef, useEffect } from "react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-sql";
import {
  X,
  Play,
  AlertTriangle,
  Loader2,
  SquareTerminal,
  Clock,
  Copy,
  Check,
  ChevronDown,
  Inbox,
  Eraser,
  CheckCircle2,
  Command,
} from "lucide-react";
import { useRunQuery } from "@/hooks/use-run-query";

interface SqlConsoleModalProps {
  open: boolean;
  onClose: () => void;
}

interface HistoryEntry {
  sql: string;
  ranAt: number;
}

const MAX_HISTORY = 20;
const GUTTER_MIN_LINES = 7;

function highlightSql(code: string): string {
  return Prism.highlight(code, Prism.languages.sql, "sql");
}

function rowsToCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const header = columns.join(",");
  const lines = rows.map((row) =>
    columns
      .map((col) => {
        const val = row[col];
        if (val === null || val === undefined) return "";
        const s = String(val).replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      })
      .join(","),
  );
  return [header, ...lines].join("\n");
}

export default function SqlConsoleModal({
  open,
  onClose,
}: SqlConsoleModalProps) {
  const [sql, setSql] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [copied, setCopied] = useState<"json" | "csv" | null>(null);
  const [gutterScroll, setGutterScroll] = useState(0);

  const startTimeRef = useRef<number>(0);
  const historyRef = useRef<HTMLDivElement>(null);
  const editorWrapRef = useRef<HTMLDivElement>(null);
  const runQuery = useRunQuery();

  useEffect(() => {
    if (!historyOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        historyRef.current &&
        !historyRef.current.contains(e.target as Node)
      ) {
        setHistoryOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [historyOpen]);

  useEffect(() => {
    if (!open) return;
    const textarea = editorWrapRef.current?.querySelector("textarea");
    if (!textarea) return;
    const handleScroll = () => setGutterScroll(textarea.scrollTop);
    textarea.addEventListener("scroll", handleScroll);
    return () => textarea.removeEventListener("scroll", handleScroll);
  }, [open]);

  if (!open) return null;

  const result = runQuery.data;
  const showConfirmBanner = result?.requiresConfirmation && pendingConfirm;
  const showResults = result && !result.requiresConfirmation;

  const status: "idle" | "running" | "confirm" | "error" | "success" =
    runQuery.isPending
      ? "running"
      : showConfirmBanner
        ? "confirm"
        : runQuery.isError
          ? "error"
          : showResults
            ? "success"
            : "idle";

  const statusStyles: Record<typeof status, string> = {
    idle: "bg-text-tertiary/40",
    running: "bg-amber-400 animate-pulse",
    confirm: "bg-coral animate-pulse",
    error: "bg-coral",
    success: "bg-teal",
  };

  function handleRun() {
    if (!sql.trim()) return;
    startTimeRef.current = performance.now();

    runQuery.mutate(
      { sql, confirmed: pendingConfirm },
      {
        onSuccess: (data) => {
          setElapsedMs(performance.now() - startTimeRef.current);

          if (data.requiresConfirmation) {
            setPendingConfirm(true);
            return;
          }

          setPendingConfirm(false);
          setHistory((prev) =>
            [{ sql, ranAt: Date.now() }, ...prev].slice(0, MAX_HISTORY),
          );
        },
      },
    );
  }

  function handleClose() {
    setSql("");
    setPendingConfirm(false);
    setElapsedMs(null);
    setHistoryOpen(false);
    runQuery.reset();
    onClose();
  }

  function handleClear() {
    setSql("");
    setPendingConfirm(false);
    runQuery.reset();
  }

  function handleSelectHistory(entry: HistoryEntry) {
    setSql(entry.sql);
    setHistoryOpen(false);
    setPendingConfirm(false);
    runQuery.reset();
  }

  async function handleCopy(format: "json" | "csv") {
    if (!result || result.isWrite) return;
    const text =
      format === "json"
        ? JSON.stringify(result.rows, null, 2)
        : rowsToCsv(result.columns, result.rows);
    await navigator.clipboard.writeText(text);
    setCopied(format);
    setTimeout(() => setCopied(null), 1500);
  }

  const lineCount = Math.max(sql.split("\n").length, GUTTER_MIN_LINES);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150">
      <div className="w-full max-w-4xl h-[85vh] flex flex-col rounded-xl border border-node-border/60 dark:border-node-border/40 bg-node-bg shadow-2xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-node-header-bg/40 border-b border-node-border/60 dark:border-node-border/30 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-teal/10 dark:bg-teal/15 text-teal shrink-0 border border-teal/20">
              <SquareTerminal size={18} aria-hidden />
            </div>
            <div className="flex flex-col min-w-0 justify-center">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-bold text-text-primary tracking-tight antialiased">
                  SQL Console
                </span>
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusStyles[status]}`}
                  aria-hidden
                />
              </div>
              <span className="text-[11.5px] font-mono text-text-tertiary leading-none mt-0.5">
                Run raw queries against this project
              </span>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="flex items-center justify-center w-6 h-6 rounded-md text-text-tertiary hover:text-text-primary hover:bg-node-border/40 transition-colors cursor-pointer border-none bg-transparent shrink-0"
            aria-label="Close SQL console">
            <X size={13} aria-hidden />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <div ref={historyRef} className="relative">
              <button
                onClick={() => setHistoryOpen((o) => !o)}
                disabled={history.length === 0}
                className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-[12px] font-medium transition-colors cursor-pointer bg-transparent disabled:opacity-40 disabled:cursor-not-allowed ${
                  historyOpen
                    ? "border-teal/40 text-teal bg-teal/5"
                    : "border-node-border/60 dark:border-node-border/40 text-text-secondary hover:text-text-primary hover:bg-black/2 dark:hover:bg-white/2"
                }`}>
                <Clock size={12} aria-hidden />
                <span>History</span>
                {history.length > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-teal text-[8.5px] font-bold text-white leading-none">
                    {history.length}
                  </span>
                )}
                <ChevronDown size={12} aria-hidden />
              </button>

              {historyOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-80 max-h-64 overflow-y-auto rounded-xl border border-node-border/60 dark:border-node-border/40 bg-node-bg/98 dark:bg-node-bg/99 backdrop-blur-xl shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  {history.map((entry, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectHistory(entry)}
                      className="w-full flex flex-col gap-0.5 px-3 py-2 text-left border-none bg-transparent cursor-pointer hover:bg-black/2 dark:hover:bg-white/2 transition-colors border-b border-node-border/30 last:border-b-0">
                      <span className="text-[10.5px] font-mono text-text-primary truncate">
                        {entry.sql}
                      </span>
                      <span className="text-[9px] font-mono text-text-tertiary">
                        {new Date(entry.ranAt).toLocaleTimeString()}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleClear}
              disabled={!sql}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-node-border/60 dark:border-node-border/40 text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-black/2 dark:hover:bg-white/2 transition-colors cursor-pointer bg-transparent disabled:opacity-40 disabled:cursor-not-allowed">
              <Eraser size={12} aria-hidden />
              <span>Clear</span>
            </button>
          </div>

          <kbd className="text-[11px] font-mono text-text-tertiary px-1.5 py-1 flex items-center gap-1 rounded border border-node-border/50 dark:border-node-border/30 bg-black/2 dark:bg-white/2">
            <span>
              <Command size={12} aria-hidden />
            </span>
            / Ctrl + Enter
          </kbd>
        </div>

        {/* Editor */}
        <div className="px-4 pb-3 shrink-0">
          <div
            ref={editorWrapRef}
            className="relative flex rounded-lg border border-node-border/60 dark:border-node-border/40 bg-surface-2 dark:bg-surface-3/40 focus-within:border-teal/60 transition-colors overflow-hidden sql-editor"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handleRun();
              }
            }}>
            <div
              className="select-none pt-3 pb-3 pl-3 pr-2.5 text-right border-r border-node-border/40 dark:border-node-border/30"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 14,
                lineHeight: "20px",
                transform: `translateY(-${gutterScroll}px)`,
              }}>
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i} className="text-text-tertiary/50">
                  {i + 1}
                </div>
              ))}
            </div>
            <div className="flex-1 min-w-0">
              <Editor
                value={sql}
                onValueChange={(v) => {
                  setSql(v);
                  if (pendingConfirm) {
                    setPendingConfirm(false);
                    runQuery.reset();
                  }
                }}
                highlight={highlightSql}
                padding={12}
                placeholder="SELECT * FROM users LIMIT 10;"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  lineHeight: "20px",
                  minHeight: 168,
                }}
                textareaClassName="outline-none"
              />
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex flex-col flex-1 min-h-0 px-4 pb-4 gap-2">
          <div className="flex items-center justify-between shrink-0">
            <span className="text-[10.5px] font-semibold tracking-wide uppercase text-text-tertiary">
              Results
            </span>
            {showResults && !result.isWrite && (
              <div className="flex items-center gap-2.5">
                <span className="text-[10.5px] font-mono text-text-tertiary">
                  {result.rows.length}{" "}
                  {result.rows.length === 1 ? "row" : "rows"}
                  {elapsedMs !== null && ` · ${elapsedMs.toFixed(0)}ms`}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleCopy("json")}
                    className="flex items-center gap-1 h-6 px-2 rounded-md border border-node-border/60 dark:border-node-border/40 text-[10.5px] font-medium text-text-secondary hover:text-text-primary hover:bg-black/2 dark:hover:bg-white/2 transition-colors cursor-pointer bg-transparent">
                    {copied === "json" ? (
                      <Check size={10} className="text-teal" aria-hidden />
                    ) : (
                      <Copy size={10} aria-hidden />
                    )}
                    <span>JSON</span>
                  </button>
                  <button
                    onClick={() => handleCopy("csv")}
                    className="flex items-center gap-1 h-6 px-2 rounded-md border border-node-border/60 dark:border-node-border/40 text-[10.5px] font-medium text-text-secondary hover:text-text-primary hover:bg-black/2 dark:hover:bg-white/2 transition-colors cursor-pointer bg-transparent">
                    {copied === "csv" ? (
                      <Check size={10} className="text-teal" aria-hidden />
                    ) : (
                      <Copy size={10} aria-hidden />
                    )}
                    <span>CSV</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            {showConfirmBanner && (
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-coral/10 dark:bg-coral/15 border border-coral/20 mb-2">
                <AlertTriangle
                  size={14}
                  className="text-coral shrink-0"
                  aria-hidden
                />
                <span className="text-[11.5px] text-coral flex-1">
                  This will modify data or schema. Run it anyway?
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

            {!showResults && !showConfirmBanner && !runQuery.isError && (
              <div className="flex flex-col items-center justify-center gap-2 h-full py-10 rounded-lg border border-dashed border-node-border/60 dark:border-node-border/40">
                <Inbox
                  size={20}
                  className="text-text-tertiary/50"
                  aria-hidden
                />
                <span className="text-[11px] text-text-tertiary">
                  Run a query to see results here
                </span>
              </div>
            )}

            {showResults && !result.isWrite && (
              <QueryResultsTable columns={result.columns} rows={result.rows} />
            )}

            {showResults && result.isWrite && (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-teal/10 dark:bg-teal/15 border border-teal/20">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-teal" aria-hidden />
                  <span className="text-[11.5px] font-mono text-teal">
                    {result.rowsAffected}{" "}
                    {result.rowsAffected === 1 ? "row" : "rows"} affected
                  </span>
                </div>
                {elapsedMs !== null && (
                  <span className="text-[10.5px] font-mono text-teal/70">
                    {elapsedMs.toFixed(0)}ms
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
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

      <style jsx global>{`
        .sql-editor .token.keyword {
          color: var(--teal);
          font-weight: 600;
        }
        .sql-editor .token.string {
          color: var(--coral);
        }
        .sql-editor .token.number,
        .sql-editor .token.boolean {
          color: var(--text-primary);
        }
        .sql-editor .token.function {
          color: var(--teal);
        }
        .sql-editor .token.operator,
        .sql-editor .token.punctuation {
          color: var(--text-secondary);
        }
        .sql-editor .token.comment {
          color: var(--text-tertiary);
          font-style: italic;
        }
      `}</style>
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
      <div className="px-3 py-4 h-full flex items-center justify-center rounded-lg border border-node-border/60 dark:border-node-border/40">
        <span className="text-[11.5px] text-text-tertiary">
          Query returned no rows.
        </span>
      </div>
    );
  }

  return (
    <div className="h-full rounded-lg border border-node-border/60 dark:border-node-border/40 overflow-auto">
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
