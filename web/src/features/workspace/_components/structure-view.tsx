"use client";

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Table2, WrapText } from "lucide-react";
import { tableKeys } from "@/features/canvas/lib/table-keys";
import { tableDdlQueryOptions } from "@/shared/hooks/use-export";
import { cx } from "@/shared/lib/cx";
import type { Relation, Table } from "@/shared/types/schema";
import { Button } from "@/shared/ui/button";
import { SqlCode } from "@/shared/ui/sql-code";
import { columnRules, deleteEffect, tableOverview, type Rule } from "../lib/structure";

interface StructureViewProps {
  table: string | null;
  tables: Table[];
  relations: Relation[];
  onSelectTable: (table: string) => void;
  onOpenData: (table: string) => void;
  /** The address of a table's structure, so names open in a new tab too. */
  hrefFor: (table: string) => string;
}

/** A link to a table that stays in the app on a plain click. */
function TableLink({ table, hrefFor, onSelectTable, className, children }: { table: string; hrefFor: (t: string) => string; onSelectTable: (t: string) => void; className?: string; children: ReactNode }) {
  return (
    <a
      href={hrefFor(table)}
      translate="no"
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onSelectTable(table);
      }}>
      {children}
    </a>
  );
}

/** The chosen table's columns, keys and DDL; every table at a glance when none is chosen. */
export function StructureView({ table, tables, relations, onSelectTable, onOpenData, hrefFor }: StructureViewProps) {
  const chosen = tables.find((t) => t.name === table);
  return (
    <div className="absolute inset-0 overflow-auto px-6 pt-5 pb-7">
      {chosen ? (
        <TableStructure key={chosen.name} table={chosen} relations={relations} onSelectTable={onSelectTable} onOpenData={onOpenData} hrefFor={hrefFor} />
      ) : (
        <Overview tables={tables} relations={relations} onSelectTable={onSelectTable} hrefFor={hrefFor} />
      )}
    </div>
  );
}

const TH = "bg-sunk px-3 py-2 text-left text-label font-medium whitespace-nowrap text-fg-subtle";
const TD = "border-t border-line px-3 py-2.5 align-top";

function Heading({ title, count, children }: { title: string; count?: number; children?: ReactNode }) {
  return (
    <h3 id={`structure-${title.toLowerCase().replace(/\W+/g, "-")}`} className="mb-2 flex items-baseline gap-2 text-body font-semibold text-fg">
      {title}
      {count !== undefined && <span className="text-label font-normal text-fg-subtle tabular-nums">{count}</span>}
      {children}
    </h3>
  );
}

const Box = ({ className, ...rest }: React.ComponentProps<"div">) => (
  <div className={cx("overflow-hidden rounded-card border border-line-strong bg-panel", className)} {...rest} />
);

function Overview({ tables, relations, onSelectTable, hrefFor }: Pick<StructureViewProps, "tables" | "relations" | "onSelectTable" | "hrefFor">) {
  const rows = tableOverview(tables, relations);
  const columns = rows.reduce((n, r) => n + r.columns, 0);
  const keys = relations.filter((r) => r.sourceTable !== r.targetTable).length;
  return (
    <>
      <h2 className="text-heading font-semibold tracking-tight text-fg">Structure</h2>
      <p className="mt-0.5 text-body text-fg-subtle tabular-nums">
        {rows.length} tables · {columns} columns · {keys} keys between them
      </p>
      <p className="mt-3 mb-4 text-body text-fg-subtle">Choose a table to see its columns, keys and indexes.</p>
      <Box>
        <table className="w-full border-collapse text-body">
          <caption className="sr-only">Every table</caption>
          <thead>
            <tr>
              <th scope="col" className={TH}>Table</th>
              <th scope="col" className={cx(TH, "text-right")}>Columns</th>
              <th scope="col" className={cx(TH, "text-right")}>Points to</th>
              <th scope="col" className={cx(TH, "text-right")}>Pointed to by</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="hover:bg-sunk">
                <th scope="row" className="border-t border-line p-0 text-left font-normal">
                  <TableLink
                    table={r.name}
                    hrefFor={hrefFor}
                    onSelectTable={onSelectTable}
                    className="block w-full px-3 py-2.5 font-mono font-medium text-fg hover:text-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
                    {r.name}
                  </TableLink>
                </th>
                {[r.columns, r.pointsTo, r.pointedToBy].map((n, i) => (
                  <td key={i} className="border-t border-line px-3 py-2.5 text-right align-middle text-label text-fg-muted tabular-nums">
                    {n || "–"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    </>
  );
}

function CopyButton({ text, label, variant }: { text: string | undefined; label: string; variant?: "ghost" }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant={variant}
      disabled={!text}
      onClick={async () => {
        if (!text) return;
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}>
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {copied ? "Copied" : label}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied to the clipboard" : ""}
      </span>
    </Button>
  );
}

function RuleTag({ rule, onSelectTable, hrefFor }: { rule: Rule; onSelectTable: (t: string) => void; hrefFor: (t: string) => string }) {
  const tag = "inline-flex h-5.5 items-center gap-1.5 rounded-control border border-line-strong px-2 text-label whitespace-nowrap text-fg-muted";
  switch (rule.kind) {
    case "generated":
      return <span className={cx(tag, "border-dashed")}>generated by the database</span>;
    case "unique":
      return <span className={tag}>unique</span>;
    case "indexed":
      return <span className={tag}>indexed</span>;
    case "check":
      return (
        <span className={cx(tag, "h-auto min-h-5.5 py-0.5 whitespace-normal")}>
          check{" "}
          <code translate="no" className="font-mono break-words text-fg">
            {rule.expr}
          </code>
        </span>
      );
    case "oneOf":
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="text-label text-fg-subtle">one of</span>
          {rule.values.map((v) => (
            <span key={v} translate="no" className="inline-flex h-5 items-center rounded-sm bg-sunk px-1.5 font-mono text-label text-fg">
              {v}
            </span>
          ))}
        </span>
      );
    case "references": {
      const effect = deleteEffect(rule.onDelete, "out", rule.table);
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <TableLink
            table={rule.table}
            hrefFor={hrefFor}
            onSelectTable={onSelectTable}
            className={cx(tag, "border-relation-faint bg-relation-tint font-mono text-relation hover:border-relation-line focus-visible:outline-2 focus-visible:outline-accent")}>
            <span aria-hidden>→</span>
            <span className="sr-only">references </span>
            {rule.table}.{rule.column}
          </TableLink>
          <span className={cx(tag, effect.warn && "border-warn/40 text-warn")}>{effect.text}</span>
        </span>
      );
    }
  }
}

function TableStructure({ table, relations, onSelectTable, onOpenData, hrefFor }: { table: Table; relations: Relation[]; onSelectTable: (t: string) => void; onOpenData: (t: string) => void; hrefFor: (t: string) => string }) {
  const ddl = useQuery(tableDdlQueryOptions(table.name, true));
  const [wrap, setWrap] = useState(false);
  const rules = columnRules(table, relations);
  const keys = tableKeys(table, relations).filter((k) => k.kind !== "FOREIGN KEY");
  const out = relations.filter((r) => r.sourceTable === table.name);
  const into = relations.filter((r) => r.targetTable === table.name && r.sourceTable !== table.name);

  return (
    <>
      <header className="mb-4 flex flex-wrap items-end gap-2.5">
        <div className="mr-auto min-w-0">
          <h2 translate="no" className="truncate text-heading font-semibold tracking-tight text-fg">
            {table.name}
          </h2>
          <p className="mt-0.5 text-body text-fg-subtle tabular-nums">
            {table.fields.length} {table.fields.length === 1 ? "column" : "columns"}
          </p>
        </div>
        <CopyButton text={ddl.data} label="Copy DDL" />
        <Button size="sm" onClick={() => onOpenData(table.name)}>
          <Table2 aria-hidden />
          Open data
        </Button>
      </header>

      <section aria-labelledby="structure-columns">
        <Heading title="Columns" count={table.fields.length} />
        <Box className="overflow-x-auto">
          <table className="w-full border-collapse text-body">
            <thead>
              <tr>
                <th scope="col" className={cx(TH, "w-9 pr-0")}>
                  <span className="sr-only">Key</span>
                </th>
                <th scope="col" className={TH}>Column</th>
                <th scope="col" className={TH}>Type</th>
                <th scope="col" className={TH}>Null</th>
                <th scope="col" className={TH}>Default</th>
                <th scope="col" className={TH}>Keys and rules</th>
              </tr>
            </thead>
            <tbody>
              {table.fields.map((f) => (
                <tr key={f.name} className="hover:bg-sunk">
                  <td className={cx(TD, "pr-0 font-mono text-caption leading-5 font-semibold")}>
                    {f.isPrimaryKey ? (
                      <abbr title="primary key" className="text-accent no-underline">PK</abbr>
                    ) : f.isForeignKey ? (
                      <abbr title="foreign key" className="text-relation no-underline">FK</abbr>
                    ) : null}
                  </td>
                  <th scope="row" translate="no" className={cx(TD, "text-left font-mono leading-5 font-medium whitespace-nowrap text-fg")}>
                    {f.name}
                  </th>
                  <td translate="no" className={cx(TD, "font-mono text-label leading-5 whitespace-nowrap text-fg-muted")}>
                    {f.nativeType || f.type}
                  </td>
                  <td className={cx(TD, "text-label leading-5 whitespace-nowrap", f.nullable ? "text-fg-subtle" : "text-fg-muted")}>
                    {f.nullable ? "nullable" : "required"}
                  </td>
                  <td translate={f.defaultValue ? "no" : undefined} className={cx(TD, "text-label leading-5 whitespace-nowrap", f.defaultValue ? "font-mono text-fg-muted" : "text-fg-subtle")}>
                    {f.defaultValue ?? "none"}
                  </td>
                  <td className={TD}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {rules[f.name].map((r, i) => (
                        <RuleTag key={i} rule={r} onSelectTable={onSelectTable} hrefFor={hrefFor} />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      </section>

      <section aria-labelledby="structure-relationships" className="mt-5">
        <Heading title="Relationships" count={out.length + into.length} />
        <Box>
          {out.length + into.length === 0 ? (
            <p className="px-3 py-2.5 text-label text-fg-subtle">No foreign keys either way.</p>
          ) : (
            <>
              <Links label="Points to" direction="out" relations={out} onSelectTable={onSelectTable} hrefFor={hrefFor} />
              <Links label="Pointed to by" direction="in" relations={into} onSelectTable={onSelectTable} hrefFor={hrefFor} />
            </>
          )}
        </Box>
      </section>

      <section aria-labelledby="structure-keys-indexes-and-checks" className="mt-5">
        <Heading title="Keys, indexes and checks" count={keys.length} />
        <Box>
          {keys.length === 0 ? (
            <p className="px-3 py-2.5 text-label text-fg-subtle">No keys, indexes or checks.</p>
          ) : (
            <ul>
              {keys.map((k, i) => (
                <li key={i} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-2.5 border-t border-line px-3 py-2.5 first:border-t-0">
                  <span className="font-mono text-caption font-semibold tracking-wide text-fg-subtle">{k.kind === "PRIMARY KEY" ? "PRIMARY" : k.kind}</span>
                  <span translate="no" className="min-w-0 font-mono text-label break-words text-fg">
                    {k.detail}
                    {k.name && <span className="block font-sans text-fg-subtle">{k.name}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Box>
      </section>

      <section aria-labelledby="structure-create-statement" className="mt-5">
        <Box>
          <div className="flex items-center gap-2 border-b border-line bg-sunk py-1.5 pr-2 pl-3">
            <h3 id="structure-create-statement" className="mr-auto text-label font-medium text-fg-subtle">CREATE statement</h3>
            <Button size="sm" variant="ghost" aria-pressed={wrap} className="aria-pressed:bg-panel aria-pressed:text-fg" onClick={() => setWrap((w) => !w)}>
              <WrapText aria-hidden />
              Wrap
            </Button>
            <CopyButton text={ddl.data} label="Copy" />
          </div>
          {ddl.data ? (
            <div translate="no">
              <SqlCode sql={ddl.data} wrap={wrap} className="[&>pre]:bg-panel! [&>pre]:px-3.5" />
            </div>
          ) : (
            <p className="px-3.5 py-3 font-mono text-label text-fg-subtle">{ddl.error ? ddl.error.message : "Loading…"}</p>
          )}
        </Box>
      </section>
    </>
  );
}

function Links({ label, direction, relations, onSelectTable, hrefFor }: { label: string; direction: "out" | "in"; relations: Relation[]; onSelectTable: (t: string) => void; hrefFor: (t: string) => string }) {
  if (relations.length === 0) return null;
  return (
    <div role="group" aria-label={label}>
      <p className="border-t border-line bg-sunk px-3 py-1.5 text-label font-medium text-fg-subtle first:border-t-0">{label}</p>
      {relations.map((r) => {
        const other = direction === "out" ? r.targetTable : r.sourceTable;
        const effect = deleteEffect(r.onDelete, direction, other);
        return (
          <div key={r.constraintName + direction} className="grid grid-cols-[1rem_minmax(0,1fr)_auto] items-baseline gap-2 border-t border-line px-3 py-2.5">
            <span aria-hidden className="font-mono text-label text-relation">{direction === "out" ? "→" : "←"}</span>
            <span className="min-w-0">
              <TableLink
                table={other}
                hrefFor={hrefFor}
                onSelectTable={onSelectTable}
                className="font-mono font-medium text-relation hover:underline focus-visible:outline-2 focus-visible:outline-accent">
                {other}
              </TableLink>
              <span translate="no" className="block truncate font-mono text-label text-fg-subtle">
                {r.sourceFields.join(", ")} → {r.targetFields.join(", ")}
              </span>
            </span>
            <span className={cx("text-label whitespace-nowrap", effect.warn ? "text-warn" : "text-fg-muted")}>{effect.text}</span>
          </div>
        );
      })}
    </div>
  );
}
