import type { Relation, Table } from "@/shared/types/schema";

export type KeyKind = "PRIMARY KEY" | "FOREIGN KEY" | "UNIQUE" | "INDEX" | "CHECK";

/** One row of the inspector's Indexes tab; name is "" when the database gives none. */
export interface KeyEntry {
  kind: KeyKind;
  name: string;
  detail: string;
}

const cols = (names: string[]) => `(${names.join(", ")})`;

/** The keys, indexes and checks the server introspected for table, in DDL order. */
export function tableKeys(table: Table, relations: Relation[]): KeyEntry[] {
  const out: KeyEntry[] = [];
  const pk = table.fields.filter((f) => f.isPrimaryKey).map((f) => f.name);
  if (pk.length) out.push({ kind: "PRIMARY KEY", name: "", detail: cols(pk) });

  for (const r of relations) {
    if (r.sourceTable !== table.name) continue;
    const actions = [
      r.onDelete !== "NO ACTION" && `ON DELETE ${r.onDelete}`,
      r.onUpdate !== "NO ACTION" && `ON UPDATE ${r.onUpdate}`,
    ].filter(Boolean);
    const target = `${cols(r.sourceFields)} → ${r.targetTable} ${cols(r.targetFields)}`;
    out.push({
      kind: "FOREIGN KEY",
      name: r.constraintName,
      detail: [target, ...actions].join(" · "),
    });
  }
  for (const u of table.unique ?? []) out.push({ kind: "UNIQUE", name: "", detail: cols(u) });
  for (const i of table.indexes ?? []) out.push({ kind: "INDEX", name: i.name, detail: cols(i.columns) });
  for (const c of table.checks ?? []) out.push({ kind: "CHECK", name: c.name, detail: c.expr });
  return out;
}
