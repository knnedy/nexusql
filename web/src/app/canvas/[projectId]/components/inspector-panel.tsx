"use client";

import {
  Table2,
  Hash,
  Key,
  Link,
  Code2,
  ChevronRight,
  List,
  ArrowRight,
  Copy,
  Check,
} from "lucide-react";
import { useState } from "react";
import type { Table, Field, Relation, DatabaseProvider } from "@/lib/types";
import { FIELD_TYPE_BADGE_MAP } from "@/lib/types";
import { useSchema } from "@/hooks/use-schema";

interface InspectorPanelProps {
  table: Table | null;
  provider: DatabaseProvider | null;
  relation: Relation | null;
  projectId: string;
}

type InspectorTab = "columns" | "indexes" | "ddl";

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-[0.75rem] font-bold uppercase tracking-[0.08em] text-text-tertiary px-3 mb-1.5 antialiased">
      {label}
    </p>
  );
}

function NullabilityBadge({ nullable }: { nullable: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wider border ${
        nullable
          ? "bg-badge-gray-bg/50 text-text-tertiary border-black/3 dark:border-white/3"
          : "bg-coral/10 text-coral border-coral/20 dark:bg-coral/20"
      }`}>
      {nullable ? "null" : "not null"}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const variant = FIELD_TYPE_BADGE_MAP[type] ?? "gray";
  const styles = {
    teal: "bg-badge-teal-bg/15 text-badge-teal-text dark:bg-badge-teal-bg/20 dark:text-teal",
    coral:
      "bg-badge-coral-bg/15 text-badge-coral-text dark:bg-badge-coral-bg/20 dark:text-coral",
    gray: "bg-badge-gray-bg/50 text-badge-gray-text dark:bg-badge-gray-bg/20 dark:text-text-secondary",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold font-mono tracking-wide border border-black/3 dark:border-white/3 ${styles[variant]}`}>
      {type}
    </span>
  );
}

function FieldRow({ field }: { field: Field }) {
  const isKey = field.isPrimaryKey || field.isForeignKey;

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 border-t-[0.5px] border-node-row-border/60 hover:bg-black/1 dark:hover:bg-white/1 transition-colors">
      <div className="w-3.5 shrink-0 flex items-center justify-center">
        {field.isPrimaryKey && <Key size={10} className="text-coral" />}
        {field.isForeignKey && !field.isPrimaryKey && (
          <Link size={10} className="text-teal" />
        )}
        {!isKey && <Hash size={10} className="text-text-tertiary/50" />}
      </div>
      <span
        className={`text-[11px] flex-1 truncate font-mono tracking-tight ${
          isKey ? "text-text-primary font-semibold" : "text-text-secondary/90"
        }`}>
        {field.name}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        <NullabilityBadge nullable={field.nullable} />
        <TypeBadge type={field.type} />
      </div>
    </div>
  );
}

interface IndexEntry {
  name: string;
  kind: "PRIMARY KEY" | "FOREIGN KEY" | "UNIQUE" | "INDEX";
  fields: string[];
}

function deriveIndexes(table: Table): IndexEntry[] {
  const entries: IndexEntry[] = [];

  const pkFields = table.fields.filter((f) => f.isPrimaryKey);
  if (pkFields.length > 0) {
    entries.push({
      name: `pk_${table.name}`,
      kind: "PRIMARY KEY",
      fields: pkFields.map((f) => f.name),
    });
  }

  table.fields
    .filter((f) => f.isForeignKey)
    .forEach((f) => {
      entries.push({
        name: `fk_${table.name}_${f.name}`,
        kind: "FOREIGN KEY",
        fields: [f.name],
      });
    });

  return entries;
}

const INDEX_KIND_STYLES: Record<IndexEntry["kind"], string> = {
  "PRIMARY KEY": "bg-coral/10 text-coral border-coral/20 dark:bg-coral/20",
  "FOREIGN KEY":
    "bg-badge-teal-bg/15 text-badge-teal-text border-badge-teal-text/10 dark:bg-badge-teal-bg/20 dark:text-teal dark:border-teal/20",
  UNIQUE:
    "bg-indigo-500/5 text-indigo-500 border-indigo-500/20 dark:bg-indigo-400/10 dark:text-indigo-400",
  INDEX:
    "bg-badge-gray-bg/50 text-badge-gray-text border-black/3 dark:border-white/3 dark:bg-badge-gray-bg/20",
};

function IndexRow({ entry }: { entry: IndexEntry }) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 border-t-[0.5px] border-node-row-border/60 hover:bg-black/1 dark:hover:bg-white/1 transition-colors">
      <span
        className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wider border shrink-0 mt-0.5 ${INDEX_KIND_STYLES[entry.kind]}`}>
        {entry.kind}
      </span>
      <div className="flex flex-col min-w-0 gap-0.5">
        <span className="text-[11px] font-mono text-text-primary truncate tracking-tight">
          {entry.name}
        </span>
        <span className="text-[10px] font-mono text-text-tertiary truncate">
          ({entry.fields.join(", ")})
        </span>
      </div>
    </div>
  );
}

function buildDdl(table: Table, provider: DatabaseProvider | null): string {
  const q = provider === "mysql" ? "`" : '"';
  const schemaPrefix =
    table.schema && table.schema !== "public" ? `${q}${table.schema}${q}.` : "";

  const lines = table.fields.map((f) => {
    const parts: string[] = [`  ${q}${f.name}${q}`, f.type.toUpperCase()];
    if (f.isPrimaryKey) parts.push("PRIMARY KEY");
    if (!f.nullable && !f.isPrimaryKey) parts.push("NOT NULL");
    if (f.defaultValue) parts.push(`DEFAULT ${f.defaultValue}`);
    return parts.join(" ");
  });

  const fkLines = table.fields
    .filter((f) => f.isForeignKey)
    .map(
      (f) =>
        `  FOREIGN KEY (${q}${f.name}${q}) REFERENCES -- target (${f.name})`,
    );

  return `CREATE TABLE ${schemaPrefix}${q}${table.name}${q} (\n${[...lines, ...fkLines].join(",\n")}\n);`;
}

function deriveCardinality(
  relation: Relation,
  tables: Table[],
): { label: string; description: string } {
  const sourceTable = tables.find((t) => t.name === relation.sourceTable);
  const sourceField = sourceTable?.fields.find(
    (f) => f.name === relation.sourceField,
  );

  const isManyToMany =
    sourceTable?.fields.every((f) => f.isPrimaryKey && f.isForeignKey) ?? false;

  if (isManyToMany)
    return { label: "many-to-many", description: "Junction table" };
  if (sourceField?.isPrimaryKey && sourceField?.isForeignKey)
    return { label: "one-to-one", description: "Unique reference" };
  return {
    label: "many-to-one",
    description: `Many ${relation.sourceTable} per ${relation.targetTable}`,
  };
}

function RelationView({
  relation,
  tables,
}: {
  relation: Relation;
  tables: Table[];
}) {
  const { label, description } = deriveCardinality(relation, tables);
  const isSelfRef = relation.sourceTable === relation.targetTable;

  return (
    <div className="flex flex-col gap-4 p-3 pb-6 animate-in fade-in duration-150">
      <div className="flex flex-col gap-1.5 pt-1">
        <SectionLabel label="Constraint" />
        <div className="mx-3 px-3 py-2.5 rounded-xl bg-black/5 dark:bg-black/30 border border-node-border/60 dark:border-node-border/40">
          <span className="text-[11px] font-mono text-text-primary tracking-tight">
            {relation.constraintName}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <SectionLabel label="Field Mapping" />
        <div className="mx-3 flex items-center gap-2 px-3 py-3 rounded-xl bg-black/5 dark:bg-black/30 border border-node-border/60 dark:border-node-border/40">
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-0.5">
              source
            </span>
            <span className="text-[11px] font-mono text-coral font-semibold truncate">
              {relation.sourceTable}
            </span>
            <span className="text-[10px] font-mono text-text-secondary truncate">
              .{relation.sourceField}
            </span>
          </div>
          <ArrowRight
            size={14}
            className="text-text-tertiary shrink-0"
            aria-hidden
          />
          <div className="flex flex-col min-w-0 flex-1 items-end text-right">
            <span className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-0.5">
              target
            </span>
            <span className="text-[11px] font-mono text-teal font-semibold truncate">
              {relation.targetTable}
            </span>
            <span className="text-[10px] font-mono text-text-secondary truncate">
              .{relation.targetField}
            </span>
          </div>
        </div>
        {isSelfRef && (
          <p className="text-[10px] text-text-tertiary font-mono px-3 mt-0.5">
            ↻ self-referential
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <SectionLabel label="Cardinality" />
        <div className="mx-3 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-black/5 dark:bg-black/30 border border-node-border/60 dark:border-node-border/40">
          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-bold tracking-wider border bg-badge-teal-bg/15 text-badge-teal-text border-badge-teal-text/10 dark:bg-badge-teal-bg/20 dark:text-teal dark:border-teal/20">
            {label}
          </span>
          <span className="text-[11px] text-text-tertiary">{description}</span>
        </div>
      </div>
    </div>
  );
}

function IdleState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center animate-in fade-in duration-200">
      <div className="w-9 h-9 rounded-xl bg-node-border/20 dark:bg-node-border/10 flex items-center justify-center">
        <Table2 size={16} className="text-text-tertiary" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[12px] font-semibold text-text-secondary antialiased">
          No table or relation selected
        </span>
        <span className="text-[11px] text-text-tertiary leading-relaxed">
          Click any table or relation on the canvas to inspect it
        </span>
      </div>
      <div className="flex items-center gap-1.5 mt-1 text-text-tertiary/60">
        <ChevronRight size={10} />
        <span className="text-[10px] font-mono">select a node to begin</span>
      </div>
    </div>
  );
}

export default function InspectorPanel({
  table,
  provider,
  relation,
  projectId,
}: InspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>("columns");
  const [copied, setCopied] = useState(false);
  const { data: schema } = useSchema(projectId);
  const tables = schema?.tables ?? [];

  const pkFields = table?.fields.filter((f) => f.isPrimaryKey) ?? [];
  const fkFields = table?.fields.filter((f) => f.isForeignKey) ?? [];
  const indexes = table ? deriveIndexes(table) : [];

  const tabs: { id: InspectorTab; icon: React.ReactNode; label: string }[] = [
    { id: "columns", icon: <Hash size={11} aria-hidden />, label: "Columns" },
    { id: "indexes", icon: <List size={11} aria-hidden />, label: "Indexes" },
    { id: "ddl", icon: <Code2 size={11} aria-hidden />, label: "DDL" },
  ];

  const headerTitle = relation
    ? relation.constraintName
    : table
      ? table.name
      : "Inspector";
  const headerSub = relation
    ? `${relation.sourceTable} → ${relation.targetTable}`
    : table
      ? `${table.fields.length} fields · ${pkFields.length} pk · ${fkFields.length} fk`
      : "table inspector";

  const headerIcon = relation ? (
    <Link size={13} className="text-teal" />
  ) : (
    <Table2 size={13} className="text-text-secondary" />
  );

  const handleCopyDdl = () => {
    if (!table) return;
    navigator.clipboard.writeText(buildDdl(table, provider));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="absolute top-0 right-0 h-full w-72 z-10 flex flex-col border-l border-node-border/80 dark:border-node-border/40 bg-node-bg/95 dark:bg-node-bg/98 backdrop-blur-md">
      <div className="flex items-center gap-2.5 px-4 py-4 bg-node-header-bg/40 border-b border-node-border/60 dark:border-node-border/30 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-node-border/20 flex items-center justify-center shrink-0 border border-black/3 dark:border-white/3">
          {headerIcon}
        </div>
        <div className="flex flex-col min-w-0 justify-center">
          <span className="text-[12px] font-bold text-text-primary tracking-tight truncate antialiased">
            {headerTitle}
          </span>
          <span className="text-[9px] font-medium font-mono text-text-tertiary mt-0.5 uppercase tracking-wider truncate">
            {headerSub}
          </span>
        </div>
      </div>

      {!table && !relation ? (
        <IdleState />
      ) : relation ? (
        <div className="flex-1 overflow-y-auto min-h-0">
          <RelationView relation={relation} tables={tables} />
        </div>
      ) : table ? (
        <>
          <div className="flex items-center gap-0.5 px-2.5 pt-3 pb-2 shrink-0">
            {tabs.map(({ id, icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 border-none cursor-pointer ${
                  activeTab === id
                    ? "bg-node-border/40 dark:bg-node-border/30 text-text-primary"
                    : "bg-transparent text-text-tertiary hover:text-text-secondary hover:bg-node-border/20"
                }`}>
                {icon}
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {activeTab === "columns" && (
              <div className="flex flex-col pt-1 pb-4 animate-in fade-in duration-150">
                <SectionLabel label="Fields" />
                <div className="flex flex-col">
                  {table.fields.map((field) => (
                    <FieldRow key={field.name} field={field} />
                  ))}
                </div>
              </div>
            )}

            {activeTab === "indexes" && (
              <div className="flex flex-col pt-1 pb-4 animate-in fade-in duration-150">
                <SectionLabel label="Indexes" />
                {indexes.length === 0 ? (
                  <p className="text-[11px] text-text-tertiary px-3 py-4">
                    No indexes found for this table.
                  </p>
                ) : (
                  <div className="flex flex-col">
                    {indexes.map((entry) => (
                      <IndexRow key={entry.name} entry={entry} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "ddl" && (
              <div className="p-3 flex flex-col gap-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <SectionLabel label="Create Statement" />
                  <button
                    onClick={handleCopyDdl}
                    className="flex items-center gap-1 text-[10px] font-medium text-text-secondary hover:text-text-primary transition-colors bg-transparent border-none cursor-pointer px-1.5 py-0.5 rounded mb-1">
                    {copied ? (
                      <>
                        <Check size={11} className="text-teal" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={11} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="rounded-xl bg-black/40 dark:bg-black/60 border border-node-border/60 dark:border-node-border/40 p-3.5 font-mono text-[10.5px] text-zinc-300 whitespace-pre leading-relaxed select-text tracking-normal overflow-x-auto">
                  {buildDdl(table, provider)}
                </div>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
