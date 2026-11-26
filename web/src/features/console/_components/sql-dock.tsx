"use client";

import { useRef, useState } from "react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-sql";
import { AlertTriangle, Check, ChevronDown, ChevronUp, Clock, Copy, Eraser, Loader2, Play, SquareTerminal } from "lucide-react";
import { useRunQuery } from "../hooks/use-run-query";
import { toCsv } from "@/shared/lib/csv";
import { cx } from "@/shared/lib/cx";
import type { QueryResponse } from "@/shared/types/query";
import { Button, IconButton } from "@/shared/ui/button";
import { Kbd } from "@/shared/ui/kbd";
import { Menu, MenuContent, MenuItem } from "@/shared/ui/menu";

const MAX_HISTORY = 20;

interface HistoryEntry {
  sql: string;
  ranAt: number;
}

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

/** The SQL console, docked under the stage; collapsing keeps the editor and the result. */
export function SqlDock({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [sql, setSql] = useState("");
  const [ranSql, setRanSql] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [copied, setCopied] = useState<"json" | "csv" | null>(null);
  const started = useRef(0);
  const runQuery = useRunQuery();

  const result = runQuery.data;
  const confirming = !!result?.requiresConfirmation && pendingConfirm;
  const done = result && !result.requiresConfirmation ? result : null;

  function reset() {
    setPendingConfirm(false);
    runQuery.reset();
  }

  function run() {
    if (!sql.trim() || runQuery.isPending) return;
    started.current = performance.now();
    const text = sql;
    runQuery.mutate(
      { sql: text, confirmed: pendingConfirm },
      {
        onSuccess: (data) => {
          setElapsedMs(performance.now() - started.current);
          setRanSql(text);
          if (data.requiresConfirmation) {
            setPendingConfirm(true);
            return;
          }
          setPendingConfirm(false);
          setHistory((h) => [{ sql: text, ranAt: Date.now() }, ...h.filter((e) => e.sql !== text)].slice(0, MAX_HISTORY));
        },
      },
    );
  }

  async function copy(format: "json" | "csv") {
    if (!done || done.columns.length === 0) return;
    await navigator.clipboard.writeText(format === "json" ? JSON.stringify(done.rows, null, 2) : toCsv(done.columns, done.rows));
    setCopied(format);
    setTimeout(() => setCopied(null), 1500);
  }

  const status = runQuery.isPending ? (
    <span className="text-fg-subtle">Running…</span>
  ) : confirming ? (
    <span className="text-warn">Waiting for confirmation</span>
  ) : runQuery.isError ? (
    <span className="text-danger">Failed</span>
  ) : done ? (
    <span className="truncate text-relation">
      {!open && <span className="font-mono text-fg-subtle">{ranSql.replace(/\s+/g, " ").slice(0, 60)} · </span>}
      {summary(done)}
      {elapsedMs !== null && <span className="text-fg-subtle"> · {elapsedMs.toFixed(0)} ms</span>}
    </span>
  ) : null;

  return (
    <section aria-label="SQL" className="flex min-h-0 flex-col border-t border-line-strong bg-panel">
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
                {history.map((e) => (
                  <MenuItem
                    key={e.ranAt}
                    hint={new Date(e.ranAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    onClick={() => {
                      setSql(e.sql);
                      reset();
                    }}>
                    <span className="block max-w-64 truncate font-mono text-label">{e.sql}</span>
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
              {confirming ? "Confirm & Run" : "Run"}
            </Button>
          </>
        )}
        <IconButton label={open ? "Collapse SQL" : "Expand SQL"} size="sm" onClick={() => onOpenChange(!open)}>
          {open ? <ChevronDown aria-hidden /> : <ChevronUp aria-hidden />}
        </IconButton>
      </div>

      {open && (
        <div className="grid h-64 min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] border-t border-line">
          <div
            className="sql-code min-h-0 overflow-auto border-r border-line bg-sunk focus-within:shadow-[inset_0_0_0_1px_var(--nx-accent-line)]"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                run();
              }
            }}>
            <Editor
              value={sql}
              onValueChange={(v) => {
                setSql(v);
                if (pendingConfirm) reset();
              }}
              highlight={(code) => Prism.highlight(code, Prism.languages.sql, "sql")}
              padding={14}
              placeholder="SELECT * FROM users LIMIT 10;"
              textareaClassName="outline-none"
              className="min-h-full font-mono text-body leading-relaxed"
            />
          </div>

          <div className="flex min-h-0 flex-col">
            {confirming && (
              <p className="m-3 flex items-start gap-2 rounded-control border border-warn/40 bg-warn-tint px-3 py-2 text-label text-fg">
                <AlertTriangle aria-hidden className="mt-px size-3.5 shrink-0 text-warn" />
                This may change data, schema or settings. Run it anyway?
              </p>
            )}
            {runQuery.isError && (
              <p className="m-3 rounded-control border border-danger/40 bg-danger-tint px-3 py-2 font-mono text-label text-danger">
                {runQuery.error instanceof Error ? runQuery.error.message : "Query failed"}
              </p>
            )}
            {!done && !confirming && !runQuery.isError && (
              <p className="m-auto text-label text-fg-subtle">Results of the last query show here.</p>
            )}
            {done && done.columns.length > 0 && (
              <>
                <div className="flex h-8 shrink-0 items-center justify-end gap-1 border-b border-line px-2">
                  <Button size="sm" variant="ghost" onClick={() => copy("json")}>
                    {copied === "json" ? <Check aria-hidden /> : <Copy aria-hidden />}
                    JSON
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => copy("csv")}>
                    {copied === "csv" ? <Check aria-hidden /> : <Copy aria-hidden />}
                    CSV
                  </Button>
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
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full border-collapse font-mono text-label">
        <thead className="sticky top-0 bg-panel">
          <tr>
            {result.columns.map((c) => (
              <th key={c} className="h-7.5 border-b border-line px-3 text-left font-semibold whitespace-nowrap text-fg-muted">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => (
            <tr key={i} className="border-b border-line last:border-b-0 hover:bg-sunk">
              {result.columns.map((c) => (
                <td key={c} className={cx("h-7.5 px-3 whitespace-nowrap", row[c] === null ? "text-fg-subtle italic" : "text-fg")}>
                  {row[c] === null ? "null" : String(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
