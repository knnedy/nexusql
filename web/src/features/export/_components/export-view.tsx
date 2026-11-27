"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { codeToHtml } from "shiki";
import { AlertTriangle, Check, Copy, Download, WrapText } from "lucide-react";
import { exportFormatsQueryOptions, exportQueryOptions } from "@/shared/hooks/use-export";
import { studioSession } from "@/shared/lib/session-storage";
import { cx } from "@/shared/lib/cx";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/surface";
import { useToast } from "@/shared/ui/toast";
import type { SchemaResponse } from "@/shared/types/schema";
import { groupFormats } from "../lib/format-groups";
import { exportTables, linkedTables, type Include } from "../lib/scope";
import { FormatIcon, formatTint } from "./format-icon";

// Mermaid's default maxTextSize and maxEdges: past either, renderers refuse the diagram.
const MERMAID_MAX_TEXT = 50_000;
const MERMAID_MAX_EDGES = 500;
const MERMAID_RELATION = /^\s*\S+ \S*(?:--|\.\.)\S* \S+ : /;

function mermaidTooLarge(text: string): boolean {
  if (text.length > MERMAID_MAX_TEXT) return true;
  let edges = 0;
  for (const line of text.split("\n")) {
    if (MERMAID_RELATION.test(line) && ++edges > MERMAID_MAX_EDGES) return true;
  }
  return false;
}

// Line numbers count shiki's line spans; wrapped lines keep one number.
const NUMBERED =
  "[&_code]:[counter-reset:line] [&_.line]:before:mr-4 [&_.line]:before:inline-block [&_.line]:before:w-8 [&_.line]:before:text-right [&_.line]:before:text-fg-subtle [&_.line]:before:content-[counter(line)] [&_.line]:before:[counter-increment:line] [&_.line]:before:select-none";

function Code({ code, lang, wrap }: { code: string; lang: string; wrap: boolean }) {
  const [html, setHtml] = useState("");
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    const theme = resolvedTheme === "dark" ? "github-dark-default" : "github-light-default";
    // An unknown language keeps the plain text below.
    codeToHtml(code, { lang, theme }).then(setHtml, () => setHtml(""));
  }, [code, lang, resolvedTheme]);

  const frame = "min-h-0 flex-1 overflow-auto bg-sunk font-mono text-label leading-relaxed select-text";
  if (!html) return <pre className={cx(frame, "p-4 text-fg", wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre")}>{code}</pre>;
  return (
    <div
      className={cx(frame, NUMBERED, "[&>pre]:min-h-full [&>pre]:p-4 [&>pre]:bg-transparent!", wrap && "[&>pre]:whitespace-pre-wrap [&>pre]:break-words")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function download(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const plural = (n: number, one: string) => `${n.toLocaleString("en")} ${one}${n === 1 ? "" : "s"}`;

interface ExportViewProps {
  format: string | null;
  onFormatChange: (id: string) => void;
  schema: SchemaResponse | undefined;
  /** The table chosen in the workspace; Include can narrow to it. */
  table: string | null;
  include: Include;
  onIncludeChange: (include: Include) => void;
}

/** The schema as code: pick a format on the left, read, copy or save it on the right. */
export function ExportView({ format, onFormatChange, schema, table, include, onIncludeChange }: ExportViewProps) {
  const toast = useToast();
  const provider = studioSession.provider() ?? "postgres";
  const { data: formats = [] } = useQuery(exportFormatsQueryOptions());
  const chosen = formats.find((f) => f.id === format) ?? formats[0];
  const relations = useMemo(() => schema?.relations ?? [], [schema]);
  const known = !!table && !!schema?.tables.some((t) => t.name === table);
  const scope = known ? include : "all";
  const tables = useMemo(() => exportTables(scope, table, relations), [scope, table, relations]);
  const { data, isLoading, isError } = useQuery(exportQueryOptions(chosen?.id ?? null, !!chosen, tables));
  const [copied, setCopied] = useState(false);
  const [wrap, setWrap] = useState(false);
  const text = data?.schema ?? "";
  const lines = text ? text.replace(/\n$/, "").split("\n").length : 0;
  const tableCount = tables.length || (schema?.tables.length ?? 0);
  const linked = table ? linkedTables(table, relations).length : 0;
  const options: [Include, string][] = [
    ["all", `All ${plural(schema?.tables.length ?? 0, "table")}`],
    ["table", `${table} only`],
    ["linked", `${table} and its ${plural(linked, "linked table")}`],
  ];

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[15rem_minmax(0,1fr)] bg-ground">
      <nav aria-label="Export formats" className="min-h-0 overflow-y-auto border-r border-line bg-panel p-2">
        {groupFormats(formats).map((g) => (
          <div key={g.label} role="group" aria-label={g.label} className="mb-3">
            <p className="px-2 pt-1 pb-1.5 text-caption font-medium text-fg-subtle">{g.label}</p>
            {g.formats.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-current={f.id === chosen?.id || undefined}
                onClick={() => onFormatChange(f.id)}
                className={cx(
                  "flex w-full cursor-pointer items-center gap-2.5 rounded-control px-2 py-1.5 text-left transition-colors duration-150",
                  f.id === chosen?.id ? "bg-accent-tint text-fg" : "text-fg-muted hover:bg-sunk hover:text-fg",
                )}>
                <span className={cx("flex size-6 shrink-0 items-center justify-center rounded-md", formatTint(f.id, provider))}>
                  <FormatIcon id={f.id} provider={provider} size={13} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-body font-medium">{f.label}</span>
                  <span className="block truncate text-caption text-fg-subtle">{f.description}</span>
                </span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <section aria-label={chosen?.label ?? "Export"} className="flex min-h-0 flex-col">
        {chosen && (
          <header className="flex items-center gap-3 border-b border-line px-4 py-2.5">
            <h2 className="min-w-0 truncate font-mono text-body font-medium text-fg" translate="no">{chosen.filename}</h2>
            <p className="mr-auto shrink-0 text-caption text-fg-subtle tabular-nums">
              {plural(tableCount, "table")}
              {text && ` · ${plural(lines, "line")}`}
            </p>
            <Button size="sm" variant="ghost" aria-pressed={wrap} className="aria-pressed:bg-sunk aria-pressed:text-fg" onClick={() => setWrap((w) => !w)}>
              <WrapText aria-hidden />
              Wrap lines
            </Button>
            <Button size="sm" variant="ghost" onClick={copy} disabled={!text}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={!text}
              onClick={() => {
                download(text, chosen.filename);
                toast({ title: `Saved ${chosen.filename}`, tone: "success" });
              }}>
              <Download aria-hidden />
              Download {chosen.filename}
            </Button>
          </header>
        )}

        {known && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2 text-label text-fg-muted">
            <span id="export-include">Include</span>
            <div role="group" aria-labelledby="export-include" className="inline-flex h-7.5 overflow-hidden rounded-control border border-line-strong">
              {options.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={scope === id}
                  onClick={() => onIncludeChange(id)}
                  className={cx(
                    "h-full cursor-pointer px-2.5 whitespace-nowrap transition-colors duration-150",
                    scope === id ? "bg-sunk font-medium text-fg" : "text-fg-muted hover:text-fg",
                  )}>
                  {label}
                </button>
              ))}
            </div>
            {scope !== "all" && <span className="ml-auto text-caption text-fg-subtle">Keys to tables left out become plain columns</span>}
          </div>
        )}

        {chosen?.id === "mermaid" && mermaidTooLarge(text) && (
          <p role="note" className="mx-4 mt-3 flex items-start gap-2 rounded-control border border-warn/40 bg-warn-tint px-3 py-2 text-label text-fg">
            <AlertTriangle className="mt-px size-3.5 shrink-0 text-warn" aria-hidden />
            This diagram is too large for most Mermaid renderers (over {MERMAID_MAX_EDGES} relationships or{" "}
            {MERMAID_MAX_TEXT.toLocaleString("en")} characters). Use DBML, or save the diagram as a PNG, instead.
          </p>
        )}

        {isLoading ? (
          <Skeleton className="m-4 flex-1" />
        ) : isError ? (
          <p className="p-4 text-body text-danger">The server could not render this format.</p>
        ) : (
          chosen && <Code code={text} lang={chosen.language} wrap={wrap} />
        )}
      </section>
    </div>
  );
}
