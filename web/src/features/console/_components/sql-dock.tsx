"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-sql";
import { AlertTriangle, Check, ChevronDown, ChevronUp, Clock, Copy, Eraser, Loader2, Maximize2, Minimize2, Play, SquareTerminal } from "lucide-react";
import { useRunQuery } from "../hooks/use-run-query";
import { clampHeight, errorLine, isNumeric, loadHistory, MIN_DOCK, nearMiss, saveHistory, toRun, type HistoryEntry } from "../lib/console";
import { toCsv } from "@/shared/lib/csv";
import { cx } from "@/shared/lib/cx";
import { studioSession } from "@/shared/lib/session-storage";
import type { QueryResponse } from "@/shared/types/query";
import { Button, IconButton } from "@/shared/ui/button";
import { Kbd } from "@/shared/ui/kbd";
import { Menu, MenuContent, MenuItem } from "@/shared/ui/menu";

const MAX_HISTORY = 20;
const DEFAULT_HEIGHT = 288;
const HEIGHT_KEY = "nexusql.dockHeight";
const STEP = 24;
// Room the top bar, view tabs and the dock's own bar keep when the dock is at its tallest.
const KEEP_CLEAR = 180;

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** One line on what the last run gave back. */
function summary(result: QueryResponse): string {
  const tail = result.statements > 1 ? ` · last of ${result.statements} statements` : "";
  if (result.columns.length > 0) {
    return (result.truncated ? `first ${plural(result.rows.length, "row")}, more not shown` : plural(result.rows.length, "row")) + tail;
  }
  return (result.isWrite ? `${plural(result.rowsAffected, "row")} affected` : "Done") + tail;
}

const maxHeight = () => (typeof window === "undefined" ? 600 : Math.max(MIN_DOCK, window.innerHeight - KEEP_CLEAR));

function storedHeight(): number {
  try {
    const n = Number(localStorage.getItem(HEIGHT_KEY));
    return n > 0 ? n : DEFAULT_HEIGHT;
  } catch {
    return DEFAULT_HEIGHT;
  }
}

function currentProject(): string | null {
  try {
    return studioSession.projectId();
  } catch {
    return null;
  }
}

const linesLabel = ([a, b]: [number, number]) => (a === b ? `selection, line ${a}` : `selection, lines ${a}–${b}`);

/** The SQL console, docked under the stage; collapsing keeps the editor and the result. */
export function SqlDock({ open, onOpenChange, tables = [] }: { open: boolean; onOpenChange: (open: boolean) => void; tables?: string[] }) {
  const [sql, setSql] = useState("");
  const [ranSql, setRanSql] = useState("");
  const [ranLines, setRanLines] = useState<[number, number] | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [project] = useState(currentProject);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory(project));
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [copied, setCopied] = useState<"json" | "csv" | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [height, setHeight] = useState(storedHeight);
  const [maximized, setMaximized] = useState(false);
  const started = useRef(0);
  const editorRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; h: number } | null>(null);
  const runQuery = useRunQuery();

  const result = runQuery.data;
  const confirming = !!result?.requiresConfirmation && pendingConfirm;
  const done = result && !result.requiresConfirmation ? result : null;
  const errorText = runQuery.isError ? (runQuery.error instanceof Error ? runQuery.error.message : "Query failed") : "";
  const miss = errorText ? nearMiss(errorText, tables, ranSql) : null;
  const failedLine = miss ? errorLine(ranSql, miss.wrong) : null;
  const shown = maximized ? maxHeight() : clampHeight(height, maxHeight());

  useEffect(() => {
    try {
      localStorage.setItem(HEIGHT_KEY, String(height));
    } catch {
      // Not remembered; the default comes back next time.
    }
  }, [height]);

  // The textarea's "select" event bubbles natively; keys and clicks catch collapsed selections.
  useEffect(() => {
    const box = editorRef.current;
    if (!open || !box) return;
    const update = () => {
      const area = box.querySelector("textarea");
      setHasSelection(!!area && area.selectionStart !== area.selectionEnd && !!toRun(area.value, area.selectionStart, area.selectionEnd).lines);
    };
    box.addEventListener("select", update);
    box.addEventListener("keyup", update);
    box.addEventListener("mouseup", update);
    return () => {
      box.removeEventListener("select", update);
      box.removeEventListener("keyup", update);
      box.removeEventListener("mouseup", update);
    };
  }, [open]);

  function reset() {
    setPendingConfirm(false);
    runQuery.reset();
  }

  function run() {
    if (!sql.trim() || runQuery.isPending) return;
    const area = editorRef.current?.querySelector("textarea");
    // A confirmation re-runs what was asked about, not a new selection.
    const target = pendingConfirm ? { sql: ranSql, lines: ranLines } : toRun(sql, area?.selectionStart ?? 0, area?.selectionEnd ?? 0);
    started.current = performance.now();
    setRanSql(target.sql);
    setRanLines(target.lines);
    runQuery.mutate(
      { sql: target.sql, confirmed: pendingConfirm },
      {
        onSuccess: (data) => {
          setElapsedMs(performance.now() - started.current);
          if (data.requiresConfirmation) {
            setPendingConfirm(true);
            return;
          }
          setPendingConfirm(false);
          const next = [{ sql: target.sql, ranAt: Date.now() }, ...history.filter((e) => e.sql !== target.sql)].slice(0, MAX_HISTORY);
          setHistory(next);
          saveHistory(project, next);
        },
      },
    );
  }

  function fixName() {
    if (!miss) return;
    const word = new RegExp(`(^|[^\\w$])${miss.wrong.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[^\\w$]|$)`, "g");
    setSql((s) => s.replace(word, `$1${miss.meant}`));
    reset();
  }

  async function copy(format: "json" | "csv") {
    if (!done || done.columns.length === 0) return;
    await navigator.clipboard.writeText(format === "json" ? JSON.stringify(done.rows, null, 2) : toCsv(done.columns, done.rows));
    setCopied(format);
    setTimeout(() => setCopied(null), 1500);
  }

  function onGripDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, h: shown };
    setMaximized(false);
  }
  function onGripMove(e: PointerEvent<HTMLDivElement>) {
    if (drag.current) setHeight(clampHeight(drag.current.h + drag.current.y - e.clientY, maxHeight()));
  }
  function onGripKey(e: KeyboardEvent<HTMLDivElement>) {
    const by = { ArrowUp: STEP, ArrowDown: -STEP }[e.key];
    const to = e.key === "Home" ? MIN_DOCK : e.key === "End" ? maxHeight() : by ? shown + by : null;
    if (to === null) return;
    e.preventDefault();
    setMaximized(false);
    setHeight(clampHeight(to, maxHeight()));
  }

  const status = runQuery.isPending ? (
    <span className="text-fg-subtle">Running…</span>
  ) : confirming ? (
    <span className="text-warn">Waiting for confirmation</span>
  ) : runQuery.isError ? (
    <span className="text-danger">{failedLine ? `Failed on line ${failedLine}` : "Failed"}</span>
  ) : done ? (
    <span className="truncate">
      {!open && <span className="font-mono text-fg-subtle">{ranSql.replace(/\s+/g, " ").slice(0, 60)} · </span>}
      <span className="text-relation">
        {summary(done)}
        {elapsedMs !== null && <span className="text-fg-subtle tabular-nums"> · {elapsedMs.toFixed(0)} ms</span>}
      </span>
      {ranLines && <span className="text-fg-subtle"> · {linesLabel(ranLines)}</span>}
    </span>
  ) : null;

  const lineCount = sql.split("\n").length;

  return (
    <section aria-label="SQL" className="relative flex min-h-0 flex-col border-t border-line-strong bg-panel">
      {open && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize SQL"
          aria-valuenow={shown}
          aria-valuemin={MIN_DOCK}
          aria-valuemax={maxHeight()}
          tabIndex={0}
          title="Drag to resize; double-click for the default height"
          onPointerDown={onGripDown}
          onPointerMove={onGripMove}
          onPointerUp={() => (drag.current = null)}
          onDoubleClick={() => {
            setMaximized(false);
            setHeight(DEFAULT_HEIGHT);
          }}
          onKeyDown={onGripKey}
          className="group absolute inset-x-0 -top-1 z-10 h-2 cursor-row-resize touch-none focus-visible:outline-none">
          <span className="absolute top-0.5 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-line-strong group-hover:bg-accent group-focus-visible:bg-accent" />
        </div>
      )}
      <div className="flex h-9.5 shrink-0 items-center gap-2.5 pr-2 pl-4 text-label text-fg-muted">
        <SquareTerminal aria-hidden className="size-3.75 text-fg-subtle" />
        <span className="text-body font-semibold text-fg">SQL</span>
        <span className="flex gap-0.5" aria-hidden>
          <Kbd>Ctrl</Kbd>
          <Kbd>J</Kbd>
        </span>
        <span role="status" className="min-w-0 flex-1 truncate">
          {status}
        </span>
        {open && (
          <>
            <Menu.Root>
              <Menu.Trigger
                disabled={history.length === 0}
                className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-control px-2.5 text-body text-fg-muted hover:bg-sunk hover:text-fg disabled:pointer-events-none disabled:opacity-50 data-popup-open:bg-sunk">
                <Clock aria-hidden className="size-3.5" />
                History
                {history.length > 0 && <span className="text-caption text-fg-subtle tabular-nums">{history.length}</span>}
              </Menu.Trigger>
              <MenuContent align="end" className="max-h-72 w-96 overflow-y-auto">
                <p className="flex px-2 pt-1 pb-1.5 text-label text-fg-subtle">
                  Ran on this project<span className="ml-auto">kept in this browser</span>
                </p>
                {history.map((e) => (
                  <MenuItem
                    key={e.ranAt}
                    hint={
                      new Date(e.ranAt).toDateString() === new Date().toDateString()
                        ? new Date(e.ranAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : new Date(e.ranAt).toLocaleDateString([], { month: "short", day: "numeric" })
                    }
                    onClick={() => {
                      setSql(e.sql);
                      reset();
                    }}>
                    <span translate="no" className="block max-w-64 truncate font-mono text-label">
                      {e.sql}
                    </span>
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu.Root>
            <Button
              size="sm"
              variant="ghost"
              disabled={!sql}
              onClick={() => {
                setSql("");
                reset();
              }}>
              <Eraser aria-hidden />
              Clear
            </Button>
            <Button size="sm" variant={confirming ? "danger" : "primary"} disabled={!sql.trim() || runQuery.isPending} onClick={run}>
              {runQuery.isPending ? <Loader2 aria-hidden className="animate-spin" /> : <Play aria-hidden />}
              {confirming ? "Confirm & Run" : hasSelection ? "Run selection" : "Run"}
              <span aria-hidden className="ml-0.5 rounded-sm border border-current/35 px-1 text-caption leading-4 opacity-80">
                Ctrl ↵
              </span>
            </Button>
            <IconButton label={maximized ? "Restore SQL size" : "Maximize SQL"} size="sm" onClick={() => setMaximized((m) => !m)}>
              {maximized ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
            </IconButton>
          </>
        )}
        <IconButton label={open ? "Collapse SQL" : "Expand SQL"} size="sm" onClick={() => onOpenChange(!open)}>
          {open ? <ChevronDown aria-hidden /> : <ChevronUp aria-hidden />}
        </IconButton>
      </div>

      {open && (
        <div style={{ height: shown }} className="grid min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] border-t border-line">
          <div
            ref={editorRef}
            translate="no"
            className="sql-code flex min-h-0 items-start overflow-auto border-r border-line bg-sunk focus-within:shadow-[inset_0_0_0_1px_var(--nx-accent-line)]"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                run();
              }
            }}>
            <div aria-hidden className="sticky left-0 min-h-full shrink-0 border-r border-line bg-sunk py-3.5 pr-2 pl-3 text-right font-mono text-body leading-relaxed text-fg-subtle select-none">
              {Array.from({ length: lineCount }, (_, i) => (
                <span key={i} className={cx("block tabular-nums", failedLine === i + 1 && "font-semibold text-danger")}>
                  {i + 1}
                </span>
              ))}
            </div>
            <Editor
              value={sql}
              onValueChange={(v) => {
                setSql(v);
                if (pendingConfirm || runQuery.isError) reset();
              }}
              highlight={(code) => Prism.highlight(code, Prism.languages.sql, "sql")}
              padding={14}
              placeholder="SELECT * FROM users LIMIT 10;"
              textareaClassName="outline-none"
              className="min-h-full min-w-0 flex-1 font-mono text-body leading-relaxed"
            />
          </div>

          <div className="flex min-h-0 flex-col">
            {confirming && (
              <p className="m-3 flex items-start gap-2 rounded-control border border-warn/40 bg-warn-tint px-3 py-2 text-label text-fg">
                <AlertTriangle aria-hidden className="mt-px size-3.5 shrink-0 text-warn" />
                This may change data, schema or settings, and there is no undo. Run it anyway?
              </p>
            )}
            {runQuery.isError && (
              <div className="m-3 rounded-control border border-danger/40 bg-danger-tint px-3 py-2 text-label text-fg">
                <p translate="no" className="font-mono break-words text-danger">
                  {errorText}
                </p>
                {(failedLine || miss) && (
                  <p className="mt-1">
                    {failedLine && `Line ${failedLine}. `}
                    {miss && (
                      <>
                        Did you mean{" "}
                        <button type="button" onClick={fixName} translate="no" className="cursor-pointer font-mono text-relation underline underline-offset-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent">
                          {miss.meant}
                        </button>
                        ?
                      </>
                    )}
                  </p>
                )}
              </div>
            )}
            {!done && !confirming && !runQuery.isError && <p className="m-auto text-label text-fg-subtle">Results of the last query show here.</p>}
            {done && done.columns.length > 0 && (
              <>
                <div className="flex h-8 shrink-0 items-center gap-1 border-b border-line pr-2 pl-3 text-label text-fg-subtle">
                  <span className="mr-auto tabular-nums">
                    {summary(done)}
                    {elapsedMs !== null && ` · ${elapsedMs.toFixed(0)} ms`}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => copy("csv")}>
                    {copied === "csv" ? <Check aria-hidden /> : <Copy aria-hidden />}
                    Copy CSV
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => copy("json")}>
                    {copied === "json" ? <Check aria-hidden /> : <Copy aria-hidden />}
                    Copy JSON
                  </Button>
                  <span className="sr-only" aria-live="polite">
                    {copied ? `Copied as ${copied.toUpperCase()}` : ""}
                  </span>
                </div>
                <ResultTable result={done} />
              </>
            )}
            {done && done.columns.length === 0 && <p className="m-auto text-label text-fg-subtle">The statement returns no rows.</p>}
          </div>
        </div>
      )}
    </section>
  );
}

function ResultTable({ result }: { result: QueryResponse }) {
  if (result.rows.length === 0) return <p className="m-auto text-label text-fg-subtle">The query returned no rows.</p>;
  const numeric = result.columns.map((c, i) => isNumeric(result.columnTypes?.[i] ?? "", result.rows.find((r) => r[c] !== null)?.[c]));
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full border-collapse font-mono text-label">
        <thead className="sticky top-0 bg-panel">
          <tr>
            {result.columns.map((c, i) => (
              <th key={c} className={cx("border-b border-line px-3 py-1 align-bottom font-semibold whitespace-nowrap text-fg-muted", numeric[i] ? "text-right" : "text-left")}>
                <span translate="no">{c}</span>
                {result.columnTypes?.[i] && <span className="block font-sans text-caption font-normal text-fg-subtle">{result.columnTypes[i]}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, r) => (
            <tr key={r} className="border-b border-line last:border-b-0 hover:bg-sunk">
              {result.columns.map((c, i) => (
                <td key={c} className={cx("h-7.5 px-3 whitespace-nowrap", numeric[i] && "text-right tabular-nums", row[c] === null ? "text-fg-subtle italic" : "text-fg")}>
                  {row[c] === null ? "null" : typeof row[c] === "object" ? JSON.stringify(row[c]) : String(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
