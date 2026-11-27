"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@base-ui/react/dialog";
import { Loader2, Plus, RefreshCw, Table2, X } from "lucide-react";
import { isNumeric } from "@/features/console/lib/console";
import { api } from "@/shared/api/client";
import { queryKeys } from "@/shared/api/query-keys";
import { useReadOnly } from "@/shared/hooks/use-read-only";
import { seedPlanQueryOptions, seedSampleQueryOptions } from "@/shared/hooks/use-seed";
import { cx } from "@/shared/lib/cx";
import { studioSession } from "@/shared/lib/session-storage";
import type { Field, SchemaResponse } from "@/shared/types/schema";
import type { SeedResponse } from "@/shared/types/seed";
import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/ui/toast";
import { needsLabel, planRows, seedBody, totals } from "../lib/plan";

const DEFAULT_ROWS = 10;
const MAX_ROWS = 10_000;
const SAMPLE_ROWS = 3;

const plural = (n: number, one: string) => `${n.toLocaleString("en")} ${one}${n === 1 ? "" : "s"}`;
const clampRows = (v: string) => Math.min(MAX_ROWS, Math.max(0, Math.floor(Number(v) || 0)));

interface SeedDialogProps {
  open: boolean;
  onClose: () => void;
  schema: SchemaResponse | undefined;
  /** The workspace's chosen table; its sample shows first. */
  table: string | null;
  onOpenData: (table: string) => void;
}

/** Fills tables with made-up rows: plan them, see a sample, add them in one transaction. */
export function SeedDialog({ open, onClose, schema, table, onOpenData }: SeedDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 ease-out-strong data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 grid h-[min(40rem,calc(100vh-6rem))] w-[min(62rem,calc(100vw-4rem))] -translate-x-1/2 -translate-y-1/2 grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden rounded-panel border border-line-strong bg-raised text-body text-fg shadow-float outline-none transition-[transform,opacity] duration-200 ease-out-strong data-ending-style:scale-97 data-ending-style:opacity-0 data-starting-style:scale-97 data-starting-style:opacity-0">
          {open && schema && <SeedPanel schema={schema} table={table} onClose={onClose} onOpenData={onOpenData} />}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SeedPanel({ schema, table, onClose, onOpenData }: Omit<SeedDialogProps, "open" | "schema"> & { schema: SchemaResponse }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { readOnly } = useReadOnly();
  const plan = useQuery(seedPlanQueryOptions());
  const rows = useMemo(() => planRows(plan.data?.order ?? [], schema.relations), [plan.data, schema.relations]);
  const [every, setEvery] = useState(DEFAULT_ROWS);
  const [own, setOwn] = useState<Record<string, number>>({});
  const [off, setOff] = useState<Set<string>>(new Set());
  const [emptyPct, setEmptyPct] = useState(20);
  const [picked, setPicked] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const abort = useRef<AbortController | null>(null);

  const counts = useMemo(() => Object.fromEntries(rows.map((r) => [r.table, own[r.table] ?? every])), [rows, own, every]);
  const sum = totals(counts, off);
  const nullChance = emptyPct / 100;

  const run = useMutation({
    mutationFn: () => {
      abort.current = new AbortController();
      return api.seed(seedBody(counts, off, nullChance), abort.current.signal);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.rows() }),
    onError: (err) => {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast({ title: "Seed stopped", description: "The database rolls back a seed that did not finish." });
        run.reset();
      }
    },
  });
  const result = run.data;
  const troubled = result && rows.find((r) => result.skipped?.[r.table] || result.problems?.[r.table])?.table;
  const known = (t: string | null) => (t && rows.some((r) => r.table === t) ? t : null);
  const selected = known(picked) ?? (result ? troubled : null) ?? known(table) ?? rows[0]?.table ?? null;
  const failed = run.isError && !(run.error instanceof DOMException) ? run.error.message : null;

  function setCount(t: string, value: string) {
    setOwn((o) => ({ ...o, [t]: clampRows(value) }));
  }

  return (
    <>
      <header className="flex items-center gap-3 border-b border-line px-5 py-3.5">
        <Dialog.Title className="text-subheading font-semibold">Seed data</Dialog.Title>
        <span className="font-mono text-label text-fg-subtle" translate="no">
          {studioSession.projectName()}
        </span>
        <Dialog.Close aria-label="Close" className="ml-auto grid size-7 cursor-pointer place-items-center rounded-control text-fg-subtle hover:bg-sunk hover:text-fg">
          <X size={16} aria-hidden />
        </Dialog.Close>
      </header>

      {/* Kept as an empty row once running, so the grid rows below stay in place. */}
      {result || run.isPending ? (
        <div />
      ) : (
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-panel px-5 py-2.5 text-label text-fg-muted">
        <label className="flex items-center gap-2">
          Rows for every table
          <input
            type="number"
            min={0}
            max={MAX_ROWS}
            value={every}
            onChange={(e) => {
              setEvery(clampRows(e.target.value));
              setOwn({});
            }}
            className="h-7 w-18 rounded-control border border-line-strong bg-raised px-2 text-right font-mono text-label text-fg tabular-nums"
          />
        </label>
        <label className="flex items-center gap-2">
          Optional columns left empty
          <input type="range" min={0} max={100} step={5} value={emptyPct} onChange={(e) => setEmptyPct(Number(e.target.value))} className="w-32 accent-accent" />
          <span className="w-9 font-mono text-fg tabular-nums">{emptyPct}%</span>
        </label>
      </div>
      )}

      <div className="grid min-h-0 grid-cols-[minmax(0,25rem)_minmax(0,1fr)]">
        <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] border-r border-line">
          <div className="grid h-8 grid-cols-[1.5rem_1rem_minmax(0,1fr)_6rem] items-center gap-2 border-b border-line px-4 text-caption text-fg-subtle">
            <span>#</span>
            <span />
            <span id="seed-plan">Tables, in the order rows go in</span>
            <span className="text-right">{result ? "Result" : "Rows"}</span>
          </div>
          {plan.isError && !plan.data ? (
            <p className="p-4 text-body text-danger">{plan.error.message}</p>
          ) : (
            <ol aria-labelledby="seed-plan" className="min-h-0 overflow-y-auto py-1">
              {rows.map((r, i) => {
                const isOff = off.has(r.table) || counts[r.table] === 0;
                return (
                  <li
                    key={r.table}
                    aria-label={r.table}
                    className={cx(
                      "grid min-h-10 grid-cols-[1.5rem_1rem_minmax(0,1fr)_6rem] items-center gap-2 border-l-2 px-4 py-1 hover:bg-sunk",
                      r.table === selected ? "border-accent bg-sunk" : "border-transparent",
                    )}>
                    <span className="text-right font-mono text-caption text-fg-subtle">{i + 1}</span>
                    <input
                      type="checkbox"
                      aria-label={`Seed ${r.table}`}
                      checked={!off.has(r.table)}
                      disabled={!!result || run.isPending}
                      onChange={(e) =>
                        setOff((o) => {
                          const next = new Set(o);
                          if (e.target.checked) next.delete(r.table);
                          else next.add(r.table);
                          return next;
                        })
                      }
                      className="size-3.5 cursor-pointer accent-accent"
                    />
                    <button
                      type="button"
                      aria-current={r.table === selected || undefined}
                      onClick={() => setPicked(r.table)}
                      className="min-w-0 cursor-pointer text-left">
                      <span className={cx("block truncate font-mono text-label font-medium text-fg", isOff && "opacity-45")} translate="no">
                        {r.table}
                      </span>
                      <span className={cx("block truncate text-caption", isOff ? "text-fg-subtle" : off.size && r.needs.some((n) => off.has(n)) ? "text-warn" : "text-fg-subtle")}>
                        {isOff ? "left out" : needsLabel(r.needs, off)}
                      </span>
                    </button>
                    {result ? (
                      <Outcome result={result} table={r.table} />
                    ) : (
                      <input
                        type="number"
                        min={0}
                        max={MAX_ROWS}
                        aria-label={`Rows for ${r.table}`}
                        value={counts[r.table]}
                        disabled={off.has(r.table) || run.isPending}
                        onChange={(e) => setCount(r.table, e.target.value)}
                        className="h-7 w-full rounded-control border border-line-strong bg-raised px-2 text-right font-mono text-label text-fg tabular-nums disabled:opacity-45"
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)]">
          {run.isPending ? (
            <div role="status" className="row-span-3 grid place-content-center justify-items-center gap-2 p-6 text-center text-body text-fg-muted">
              <Loader2 aria-hidden className="size-5 text-accent motion-safe:animate-spin" />
              <b className="text-fg">Adding {plural(sum.rows, "row")} to {plural(sum.tables, "table")}…</b>
              <span className="max-w-sm">Usually a few seconds. It all goes in as one transaction: Stop, or an error, leaves the database as it was.</span>
            </div>
          ) : result && selected ? (
            <ResultPane result={result} table={selected} />
          ) : selected ? (
            <SamplePane table={selected} fields={schema.tables.find((t) => t.name === selected)?.fields ?? []} nullChance={nullChance} round={round} onAgain={() => setRound((n) => n + 1)} />
          ) : null}
        </section>
      </div>

      <footer className="flex items-center gap-2 border-t border-line bg-panel px-5 py-3">
        {result ? (
          <>
            <p className="mr-auto text-label text-fg-muted">
              <b className="font-semibold text-fg">
                Added {plural(Object.values(result.rowsInserted).reduce((a, b) => a + b, 0), "row")} to {plural(Object.keys(result.rowsInserted).length, "table")}.
              </b>{" "}
              {skippedNote(result)}
            </p>
            <Button size="sm" variant="ghost" onClick={() => run.reset()}>
              Seed again
            </Button>
            {selected && (
              <Button
                size="sm"
                onClick={() => {
                  onOpenData(selected);
                  onClose();
                }}>
                <Table2 aria-hidden />
                Open {selected}
              </Button>
            )}
            <Button size="sm" variant="primary" onClick={onClose}>
              Done
            </Button>
          </>
        ) : run.isPending ? (
          <>
            <p className="mr-auto text-label font-semibold text-fg">Adding rows…</p>
            <Button size="sm" onClick={() => abort.current?.abort()}>
              Stop
            </Button>
          </>
        ) : (
          <>
            <p className="mr-auto text-label text-fg-muted" role={failed ? "alert" : undefined}>
              {failed ? (
                <span className="text-danger">{failed}</span>
              ) : readOnly ? (
                <>
                  This connection is read-only. <b className="font-semibold text-fg">Switch to Read-write</b> in the top bar to seed.
                </>
              ) : (
                <>
                  <b className="font-semibold text-fg">
                    Adds {plural(sum.rows, "row")} to {plural(sum.tables, "table")}
                  </b>{" "}
                  in <span translate="no">{studioSession.projectName()}</span>, as one transaction. <span className="text-fg-subtle">Real rows: once added, there is no undo.</span>
                </>
              )}
            </p>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" disabled={readOnly || sum.rows === 0 || !plan.data} onClick={() => run.mutate()}>
              <Plus aria-hidden />
              Add {plural(sum.rows, "row")}
            </Button>
          </>
        )}
      </footer>
    </>
  );
}

function skippedNote(result: SeedResponse): string {
  const skipped = Object.entries(result.skipped ?? {}).filter(([, n]) => n > 0);
  if (!skipped.length) return "";
  return `${skipped.map(([t, n]) => `${n} skipped in ${t}`).join(", ")}.`;
}

function Outcome({ result, table }: { result: SeedResponse; table: string }) {
  const added = result.rowsInserted[table];
  const skipped = result.skipped?.[table] ?? 0;
  if (added === undefined && !skipped) return <span className="text-right font-mono text-caption text-fg-subtle">off</span>;
  return (
    <span className={cx("text-right font-mono text-caption tabular-nums", skipped ? "text-warn" : "text-relation")}>
      {skipped ? `${added ?? 0} · ${skipped} skipped` : `+${added}`}
    </span>
  );
}

function ResultPane({ result, table }: { result: SeedResponse; table: string }) {
  const added = result.rowsInserted[table] ?? 0;
  const skipped = result.skipped?.[table] ?? 0;
  const problem = result.problems?.[table];
  return (
    <>
      <div className="flex items-baseline gap-2.5 px-5 pt-3.5 pb-2">
        <h3 className="font-mono text-body font-semibold" translate="no">
          {table}
        </h3>
        <span className="text-label text-fg-subtle">
          {plural(added, "row")} added{skipped ? `, ${skipped} skipped` : ""}
        </span>
      </div>
      {problem ? (
        <div className="mx-5 mb-3 rounded-control border border-warn/40 bg-warn-tint px-3 py-2.5 text-label leading-relaxed">
          {skipped ? `The database rejected ${plural(skipped, "row")} on every try:` : "Some keys could not be filled in:"} <code className="font-mono">{problem}</code>
        </div>
      ) : (
        <p className="px-5 text-label text-fg-muted">Everything went in. Open a table to see its new rows.</p>
      )}
    </>
  );
}

function SamplePane({ table, fields, nullChance, round, onAgain }: { table: string; fields: Field[]; nullChance: number; round: number; onAgain: () => void }) {
  const sample = useQuery(seedSampleQueryOptions(table, SAMPLE_ROWS, nullChance, round));
  const label = (f: Field) =>
    sample.data?.refs[f.name] ? `→ ${sample.data.refs[f.name]}` : f.allowed?.length ? `one of ${f.allowed.length}` : f.nativeType || f.type;
  return (
    <>
      <div className="flex items-center gap-2.5 px-5 pt-3 pb-1">
        <h3 className="font-mono text-body font-semibold" translate="no">
          {table}
        </h3>
        <span className="text-label text-fg-subtle">{SAMPLE_ROWS} sample rows</span>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onAgain} disabled={sample.isFetching}>
          <RefreshCw aria-hidden />
          Another sample
        </Button>
      </div>
      <p className="px-5 pb-2.5 text-label text-fg-muted">Made from the column types and rules. Nothing is written until you add rows.</p>
      <div className="mx-5 mb-4 max-h-full min-h-0 self-start overflow-auto rounded-card border border-line bg-panel">
        {sample.isError ? (
          <p className="p-3 text-label text-danger">{sample.error.message}</p>
        ) : !sample.data ? (
          <p role="status" className="flex items-center gap-2 p-3 text-label text-fg-subtle">
            <Loader2 aria-hidden className="size-3.5 motion-safe:animate-spin" />
            Making sample rows…
          </p>
        ) : (
          <table aria-label={`Sample rows of ${table}`} className="w-max min-w-full border-collapse text-label">
            <thead>
              <tr>
                {fields.map((f) => (
                  <th key={f.name} className="sticky top-0 border-b border-line bg-sunk px-3 py-1.5 text-left align-bottom font-medium whitespace-nowrap text-fg-muted">
                    <span translate="no">{f.name}</span>
                    <span className="block font-mono text-caption font-normal text-fg-subtle">{label(f)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sample.data.rows.map((r, i) => (
                <tr key={i} className="border-b border-line last:border-b-0">
                  {fields.map((f) => {
                    const ref = sample.data.refs[f.name];
                    const auto = sample.data.auto.includes(f.name);
                    const v = r[f.name];
                    return (
                      <td
                        key={f.name}
                        className={cx(
                          "max-w-64 truncate px-3 py-1.5 font-mono whitespace-nowrap",
                          ref ? "text-relation" : auto || v === null || v === undefined ? "font-sans text-fg-subtle italic" : "text-fg",
                          !ref && !auto && v != null && isNumeric(f.type, v) && "text-right tabular-nums",
                        )}>
                        {ref ? `→ ${ref}` : auto ? "auto" : v == null ? "empty" : v}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
