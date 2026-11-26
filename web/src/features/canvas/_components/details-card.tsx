"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { codeToHtml } from "shiki";
import { ArrowRight, Check, Code2, Copy, Key, Link2, Table2, X } from "lucide-react";
import { tableDdlQueryOptions } from "@/shared/hooks/use-export";
import { linkedTables, type LinkedTable } from "@/shared/lib/linked-tables";
import { cx } from "@/shared/lib/cx";
import type { Relation, Table } from "@/shared/types/schema";
import { Button, IconButton } from "@/shared/ui/button";
import { tableKeys, type KeyKind } from "../lib/table-keys";

export interface DetailsCardProps {
  table: Table | null;
  relation: Relation | null;
  tables: Table[];
  relations: Relation[];
  onSelectTable: (table: string) => void;
  onOpenData: (table: string) => void;
  onClose: () => void;
}

const KIND_LABEL: Record<KeyKind, string> = {
  "PRIMARY KEY": "PK",
  "FOREIGN KEY": "FK",
  UNIQUE: "UNIQUE",
  INDEX: "INDEX",
  CHECK: "CHECK",
};

/** The selected table or relationship, floating over the diagram's right edge. */
export function DetailsCard(props: DetailsCardProps) {
  const { table, relation, onClose } = props;
  if (!table && !relation) return null;
  return (
    <aside
      aria-label="Details"
      data-export-exclude="true"
      className="absolute top-3 right-3 bottom-3 z-10 flex w-76 flex-col overflow-hidden rounded-panel border border-line-strong bg-panel shadow-float">
      <header className="flex items-start gap-2 border-b border-line py-3 pr-2 pl-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-heading font-semibold tracking-tight text-fg">{relation ? relation.constraintName : table!.name}</h2>
          <p className="text-label text-fg-subtle">
            {relation ? "Foreign key" : `${table!.fields.length} ${table!.fields.length === 1 ? "column" : "columns"}`}
          </p>
        </div>
        <IconButton label="Close details" size="sm" onClick={onClose}>
          <X aria-hidden />
        </IconButton>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {relation ? <RelationDetails {...props} relation={relation} /> : <TableDetails {...props} table={table!} />}
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-3 last:border-b-0">
      <h3 className="mb-1.5 text-body font-semibold text-fg">{title}</h3>
      {children}
    </section>
  );
}

function LinkRows({ label, links, onSelect }: { label: string; links: LinkedTable[]; onSelect: (t: string) => void }) {
  if (links.length === 0) return null;
  return (
    <div role="group" aria-label={label} className="mt-1.5 first:mt-0">
      <p className="mb-0.5 text-label text-fg-subtle">{label}</p>
      {links.map((l) => (
        <button
          key={l.key + l.direction}
          type="button"
          onClick={() => onSelect(l.table)}
          className="-mx-2 flex h-7 w-[calc(100%+1rem)] cursor-pointer items-center gap-2 rounded-control px-2 text-left text-body hover:bg-sunk focus-visible:outline-2 focus-visible:outline-accent">
          <span className="truncate font-medium text-relation">{l.table}</span>
          <span className="ml-auto truncate font-mono text-label text-fg-subtle">{l.via}</span>
        </button>
      ))}
    </div>
  );
}

function TableDetails({ table, relations, onSelectTable, onOpenData }: DetailsCardProps & { table: Table }) {
  const [showDdl, setShowDdl] = useState(false);
  const links = linkedTables(table.name, relations);
  const out = links.filter((l) => l.direction === "out");
  const into = links.filter((l) => l.direction === "in");
  const keys = tableKeys(table, relations);

  return (
    <>
      <dl className="grid grid-cols-3 border-b border-line">
        {[
          [table.fields.length, "columns"],
          [out.length, "points to"],
          [into.length, "pointed to by"],
        ].map(([n, label], i) => (
          <div key={label} className={cx("flex flex-col-reverse py-2.5 pl-4", i > 0 && "border-l border-line pl-3")}>
            <dt className="text-caption whitespace-nowrap text-fg-subtle">{label}</dt>
            <dd className="text-subheading font-semibold text-fg tabular-nums">{n}</dd>
          </div>
        ))}
      </dl>

      <Section title="Relationships">
        {links.length === 0 ? (
          <p className="text-label text-fg-subtle">No foreign keys either way.</p>
        ) : (
          <>
            <LinkRows label="Points to" links={out} onSelect={onSelectTable} />
            <LinkRows label="Pointed to by" links={into} onSelect={onSelectTable} />
          </>
        )}
      </Section>

      <Section title="Columns">
        <ul>
          {table.fields.map((f) => (
            <li key={f.name} className="flex h-6.5 items-center gap-2 text-label">
              {f.isPrimaryKey ? (
                <Key aria-label="primary key" className="size-3 shrink-0 text-accent" />
              ) : f.isForeignKey ? (
                <Link2 aria-label="foreign key" className="size-3 shrink-0 text-relation" />
              ) : (
                <span className="size-3 shrink-0" />
              )}
              <span className="truncate font-mono text-fg">{f.name}</span>
              <span className="ml-auto shrink-0 font-mono text-fg-subtle">
                {f.nativeType || f.type}
                {!f.nullable && !f.isPrimaryKey && " · not null"}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Keys and checks">
        {keys.length === 0 ? (
          <p className="text-label text-fg-subtle">This table has no keys, indexes or checks.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {keys.map((k, i) => (
              <li key={`${k.kind}-${k.name}-${i}`} className="flex items-baseline gap-2 text-label">
                <span className="shrink-0 rounded-sm border border-line bg-sunk px-1 py-px text-caption font-semibold text-fg-muted">
                  {KIND_LABEL[k.kind]}
                </span>
                <span className="min-w-0 font-mono break-words">
                  {k.name && <span className="block text-fg">{k.name}</span>}
                  <span className={k.name ? "text-fg-subtle" : "text-fg"}>{k.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {showDdl && <Ddl table={table.name} />}

      <div className="flex gap-2 px-4 py-3">
        <Button size="sm" aria-expanded={showDdl} onClick={() => setShowDdl((s) => !s)}>
          <Code2 aria-hidden />
          {showDdl ? "Hide DDL" : "Show DDL"}
        </Button>
        <Button size="sm" onClick={() => onOpenData(table.name)}>
          <Table2 aria-hidden />
          Open data
        </Button>
      </div>
    </>
  );
}

function Ddl({ table }: { table: string }) {
  const ddl = useQuery(tableDdlQueryOptions(table, true));
  const { resolvedTheme } = useTheme();
  const [html, setHtml] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!ddl.data) return;
    const theme = resolvedTheme === "dark" ? "github-dark-default" : "github-light-default";
    codeToHtml(ddl.data, { lang: "sql", theme }).then(setHtml, () => setHtml(""));
  }, [ddl.data, resolvedTheme]);

  return (
    <Section title="DDL">
      {ddl.data ? (
        <div className="relative">
          <IconButton
            label={copied ? "Copied" : "Copy DDL"}
            size="sm"
            className="absolute top-1 right-1 bg-panel"
            onClick={async () => {
              await navigator.clipboard.writeText(ddl.data);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}>
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          </IconButton>
          {html ? (
            <div
              className="overflow-x-auto rounded-control border border-line text-label select-text [&>pre]:bg-sunk! [&>pre]:p-3"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <pre className="overflow-x-auto rounded-control border border-line bg-sunk p-3 font-mono text-label text-fg">{ddl.data}</pre>
          )}
        </div>
      ) : (
        <p className="font-mono text-label text-fg-subtle">{ddl.error ? ddl.error.message : "Loading…"}</p>
      )}
    </Section>
  );
}

function cardinality(relation: Relation, tables: Table[]): string {
  const source = tables.find((t) => t.name === relation.sourceTable);
  if (source && source.fields.length > 0 && source.fields.every((f) => f.isPrimaryKey && f.isForeignKey)) {
    return `Many-to-many through ${relation.sourceTable}`;
  }
  const field = source?.fields.find((f) => f.name === relation.sourceField);
  if (field?.isPrimaryKey && field.isForeignKey) return "One-to-one";
  return `Many ${relation.sourceTable} per ${relation.targetTable}`;
}

function End({ table, columns, onSelect }: { table: string; columns: string[]; onSelect: (t: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(table)}
      className="min-w-0 flex-1 cursor-pointer rounded-control border border-line px-2.5 py-2 text-left hover:border-relation-line focus-visible:outline-2 focus-visible:outline-accent">
      <span className="block truncate text-body font-medium text-relation">{table}</span>
      <span className="block truncate font-mono text-label text-fg-subtle">.{columns.join(", ")}</span>
    </button>
  );
}

function RelationDetails({ relation, tables, onSelectTable }: DetailsCardProps & { relation: Relation }) {
  const actions = [
    relation.onDelete !== "NO ACTION" && `ON DELETE ${relation.onDelete}`,
    relation.onUpdate !== "NO ACTION" && `ON UPDATE ${relation.onUpdate}`,
  ].filter(Boolean);
  return (
    <>
      <Section title="Columns">
        <div className="flex items-center gap-2">
          <End table={relation.sourceTable} columns={relation.sourceFields} onSelect={onSelectTable} />
          <ArrowRight aria-label="references" className="size-3.5 shrink-0 text-fg-subtle" />
          <End table={relation.targetTable} columns={relation.targetFields} onSelect={onSelectTable} />
        </div>
      </Section>
      <Section title="Cardinality">
        <p className="text-label text-fg-muted">
          {relation.sourceTable === relation.targetTable ? "Points at its own table" : cardinality(relation, tables)}
        </p>
      </Section>
      <Section title="On change">
        <p className="font-mono text-label text-fg-muted">{actions.length ? actions.join(" · ") : "NO ACTION"}</p>
      </Section>
    </>
  );
}
